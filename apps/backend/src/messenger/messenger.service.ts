import { Injectable, Inject, ForbiddenException, BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { SafetyService } from "../safety/safety.service";
import { NotificationService } from "../notification/notification.service";
import { MESSENGER_EMITTER, type MessengerEmitter } from "./messenger.emitter";
import type { DirectMessage } from "@mingle/shared";

@Injectable()
export class MessengerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationService,
    @Inject(MESSENGER_EMITTER) private readonly emitter: MessengerEmitter,
  ) {}

  private maxLen(): number {
    const n = Number(this.config.get("MESSAGE_MAX_LEN"));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2000;
  }

  /** Resolves the caller's profile, asserts membership, returns { me, peer } profile ids. */
  private async memberContext(userId: string, roomId: string): Promise<{ me: string; peer: string }> {
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me) throw new NotFoundException("프로필이 없습니다");
    const room = await this.prisma.directMessageRoom.findUnique({
      where: { id: roomId },
      include: { match: true },
    });
    if (!room) throw new NotFoundException("대화방을 찾을 수 없습니다");
    const { profileId1, profileId2 } = room.match;
    if (me.id !== profileId1 && me.id !== profileId2) throw new ForbiddenException("이 대화방의 멤버가 아닙니다");
    return { me: me.id, peer: me.id === profileId1 ? profileId2 : profileId1 };
  }

  private toDto(m: {
    id: string;
    roomId: string;
    senderProfileId: string;
    content: string;
    readAt: Date | null;
    createdAt: Date;
  }): DirectMessage {
    return {
      id: m.id,
      roomId: m.roomId,
      senderProfileId: m.senderProfileId,
      content: m.content,
      readAt: m.readAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    };
  }

  async send(userId: string, roomId: string, content: string): Promise<DirectMessage> {
    // Guard order: member → block → length (authz before content validation)
    const { me, peer } = await this.memberContext(userId, roomId);
    if (await this.safety.isBlockedBetween(me, peer)) throw new ForbiddenException("차단된 상대입니다");
    const trimmed = (content ?? "").trim();
    if (!trimmed || trimmed.length > this.maxLen()) throw new BadRequestException("메시지 길이가 올바르지 않습니다");

    const row = await this.prisma.directMessage.create({
      data: { roomId, senderProfileId: me, content: trimmed },
    });
    const dto = this.toDto(row);

    // Emit is best-effort — REST persists regardless; a throwing gateway must not 500 the request
    try { this.emitter.emitNewMessage({ roomId, message: dto }); } catch { /* best-effort */ }

    // Notify the peer's user (non-fatal)
    const peerProfile = await this.prisma.profile.findUnique({ where: { id: peer } });
    if (peerProfile)
      await this.notifications.create({
        userId: peerProfile.userId,
        type: "message_received",
        title: "새 메시지",
        message: trimmed.slice(0, 80),
        data: { roomId },
      });

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
