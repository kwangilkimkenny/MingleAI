import { Injectable, Inject, ForbiddenException, BadRequestException, NotFoundException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { SafetyService } from "../safety/safety.service";
import { REPLY_SUGGESTER, type ReplySuggester } from "../ai/reply-suggester.interface";
import { NotificationService } from "../notification/notification.service";
import { MESSENGER_EMITTER, type MessengerEmitter } from "./messenger.emitter";
import { normalizeUploadUrl } from "../common/uploads-url";
import type { DirectMessage } from "@mingle/shared";

@Injectable()
export class MessengerService {
  private readonly log = new Logger(MessengerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationService,
    @Inject(MESSENGER_EMITTER) private readonly emitter: MessengerEmitter,
    @Inject(REPLY_SUGGESTER) private readonly suggester: ReplySuggester,
  ) {}

  /** Public authz check for the Socket.IO gateway — returns the caller's profile id, or null if not a member. */
  async assertMember(userId: string, roomId: string): Promise<string | null> {
    try { const { me } = await this.memberContext(userId, roomId); return me; } catch { return null; }
  }

  private maxLen(): number {
    const n = Number(this.config.get("MESSAGE_MAX_LEN"));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2000;
  }

  /** Resolves the caller's profile, asserts membership, returns { me, peer } profile ids. */
  private async memberContext(userId: string, roomId: string): Promise<{ me: string; peer: string }> {
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me || me.status !== "active") throw new NotFoundException("사용할 수 있는 프로필이 없습니다");
    const room = await this.prisma.directMessageRoom.findUnique({
      where: { id: roomId },
      include: { match: true },
    });
    if (!room) throw new NotFoundException("대화방을 찾을 수 없습니다");
    const { profileId1, profileId2 } = room.match;
    if (me.id !== profileId1 && me.id !== profileId2) throw new ForbiddenException("이 대화방의 멤버가 아닙니다");
    const peer = me.id === profileId1 ? profileId2 : profileId1;
    // F2: block enforcement lives here so it covers history / markRead / gateway join+typing
    // (via assertMember), not just send. Bidirectional check.
    if (await this.safety.isBlockedBetween(me.id, peer)) throw new ForbiddenException("차단된 상대입니다");
    return { me: me.id, peer };
  }

  private toDto(m: {
    id: string;
    roomId: string;
    senderProfileId: string;
    content: string;
    imageUrl?: string | null;
    readAt: Date | null;
    createdAt: Date;
  }): DirectMessage {
    return {
      id: m.id,
      roomId: m.roomId,
      senderProfileId: m.senderProfileId,
      content: m.content,
      imageUrl: m.imageUrl ?? null,
      readAt: m.readAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    };
  }

  async send(
    userId: string,
    roomId: string,
    content: string,
    imageUrl?: string,
  ): Promise<DirectMessage> {
    // Guard order: member + block (both in memberContext) → length (authz before content validation)
    const { me, peer } = await this.memberContext(userId, roomId);
    const trimmed = (content ?? "").trim();
    const image = normalizeAttachmentUrl(imageUrl);
    if (imageUrl && !image) throw new BadRequestException("첨부할 수 없는 이미지입니다");
    // 사진만 보내는 게 흔하다 — 텍스트나 이미지 중 하나만 있으면 된다.
    if (!trimmed && !image) throw new BadRequestException("메시지 길이가 올바르지 않습니다");
    if (trimmed.length > this.maxLen()) throw new BadRequestException("메시지 길이가 올바르지 않습니다");

    const row = await this.prisma.directMessage.create({
      data: { roomId, senderProfileId: me, content: trimmed, imageUrl: image },
    });
    const dto = this.toDto(row);

    // Emit is best-effort — REST persists regardless; a throwing gateway must not 500 the request
    try { this.emitter.emitNewMessage({ roomId, message: dto }); } catch { /* best-effort */ }

    // Notify the peer's user (non-fatal — write + broadcast already happened)
    const peerProfile = await this.prisma.profile.findUnique({ where: { id: peer } });
    try {
      if (peerProfile)
        await this.notifications.create({
          userId: peerProfile.userId,
          type: "message_received",
          title: "새 메시지",
          message: trimmed ? trimmed.slice(0, 80) : "사진을 보냈어요",
          data: { roomId },
        });
    } catch (notifyErr) {
      this.log.warn(`message_received notification failed for room ${roomId}: ${notifyErr}`);
    }

    return dto;
  }

  async markRead(userId: string, roomId: string): Promise<{ lastReadAt: string }> {
    const { me } = await this.memberContext(userId, roomId);
    const now = new Date();
    // Room-level read: mark all peer's unread messages as read
    await this.prisma.directMessage.updateMany({
      where: { roomId, senderProfileId: { not: me }, readAt: null },
      data: { readAt: now },
    });
    const lastReadAt = now.toISOString();
    try { this.emitter.emitRead({ roomId, readerProfileId: me, lastReadAt }); } catch { /* best-effort */ }
    return { lastReadAt };
  }

  /**
   * 다음에 보낼 만한 문장 3개. LLM이 최근 대화를 읽고 만든다(미설정·실패 시 규칙 폴백).
   *
   * 프라이버시: 이름·profileId는 프롬프트에 넣지 않고 "나/상대" 역할로만 보낸다. 최근 12줄,
   * 줄당 300자까지만 — 대화 전체를 외부로 흘리지 않는다. 차단 상태면 애초에 막힌다.
   */
  async suggestReplies(userId: string, roomId: string): Promise<{ suggestions: string[]; source: "ai" | "fallback" }> {
    const { me } = await this.memberContext(userId, roomId);
    const rows = await this.prisma.directMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    const turns = rows
      .reverse()
      .map((m) => ({
        role: (m.senderProfileId === me ? "me" : "peer") as "me" | "peer",
        content: m.content.slice(0, 300),
      }));

    try {
      const suggestions = await this.suggester.suggest({ turns });
      if (suggestions.length > 0) return { suggestions, source: this.suggester.kind === "ai" ? "ai" : "fallback" };
    } catch (e) {
      this.log.warn(`reply suggestion failed for room ${roomId}: ${(e as Error).message}`);
    }
    const { suggestReplies: ruleSuggest } = await import("@mingle/shared");
    return {
      suggestions: ruleSuggest({
        myProfileId: "me",
        messages: turns.map((t) => ({ senderProfileId: t.role === "me" ? "me" : "peer", content: t.content })),
      }),
      source: "fallback",
    };
  }

  async history(userId: string, roomId: string, before: string | undefined, limit: number): Promise<DirectMessage[]> {
    await this.memberContext(userId, roomId);
    const rows = await this.prisma.directMessage.findMany({
      where: { roomId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, limit), 100),
    });
    return rows.reverse().map((m) => this.toDto(m));
  }
}

/**
 * 첨부 이미지 URL 검증. `POST /uploads/photo`가 돌려준 **우리 업로드 URL**만 통과시킨다 —
 * 임의 URL을 허용하면 채팅이 외부 이미지를 불러오는 통로가 되어 상대의 IP·열람 시각이 새고
 * (추적 픽셀), 우리와 무관한 콘텐츠가 대화창에 뜬다. 호스트 검증은 `normalizeUploadUrl`가 한다
 * (2026-08-11 이전에는 경로만 봐서 `https://evil.example.com/uploads/x.png`가 통과했다).
 */
export function normalizeAttachmentUrl(raw?: string | null): string | null {
  return normalizeUploadUrl(raw);
}
