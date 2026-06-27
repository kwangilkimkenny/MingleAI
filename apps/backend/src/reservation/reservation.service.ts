import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";

@Injectable()
export class ReservationService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async create(dto: CreateReservationDto) {
    // Serializable 트랜잭션으로 정원 초과 레이스 컨디션 방지
    let reservation: Awaited<ReturnType<typeof this.prisma.partyReservation.create>>;
    let partyName: string;
    let scheduledAt: Date;
    let userId: string;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.prisma.$transaction(async (tx: any) => {
        const [party, profile] = await Promise.all([
          tx.party.findUnique({ where: { id: dto.partyId } }),
          tx.profile.findUnique({ where: { id: dto.profileId }, include: { user: true } }),
        ]);

        if (!party) throw new NotFoundException("파티를 찾을 수 없습니다");
        if (!profile) throw new NotFoundException("프로필을 찾을 수 없습니다");
        if (party.status !== "scheduled") throw new BadRequestException("예약 가능한 파티가 아닙니다");

        if (party.ageMin && profile.age < party.ageMin)
          throw new BadRequestException(`이 파티는 ${party.ageMin}세 이상만 참여 가능합니다`);
        if (party.ageMax && profile.age > party.ageMax)
          throw new BadRequestException(`이 파티는 ${party.ageMax}세 이하만 참여 가능합니다`);

        const [existing, count] = await Promise.all([
          tx.partyReservation.findUnique({
            where: { partyId_profileId: { partyId: dto.partyId, profileId: dto.profileId } },
          }),
          tx.partyReservation.count({ where: { partyId: dto.partyId, status: "confirmed" } }),
        ]);

        if (existing) throw new ConflictException("이미 예약한 파티입니다");
        if (count >= party.maxParticipants) throw new BadRequestException("파티 정원이 가득 찼습니다");

        const res = await tx.partyReservation.create({
          data: { partyId: dto.partyId, profileId: dto.profileId, status: "confirmed" },
          include: { party: true, profile: true },
        });

        return { res, party, userId: profile.userId };
      }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });

      reservation = result.res;
      partyName = result.party.name;
      scheduledAt = result.party.scheduledAt;
      userId = result.userId;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "P2034") throw new ConflictException("잠시 후 다시 시도해주세요");
      if (code === "P2002") throw new ConflictException("이미 예약한 파티입니다");
      throw e;
    }

    // 트랜잭션 외부에서 알림 전송 (알림 실패가 예약을 롤백하지 않도록)
    await this.notificationService.create({
      userId,
      type: "reservation",
      title: "파티 예약 완료",
      message: `${partyName} 파티 예약이 완료되었습니다.`,
      data: {
        partyId: dto.partyId,
        partyName,
        scheduledAt: scheduledAt.toISOString(),
        reservationId: reservation.id,
      },
    });

    return reservation;
  }

  async findAllByProfile(profileId: string, limit = 20, offset = 0) {
    const [reservations, total] = await Promise.all([
      this.prisma.partyReservation.findMany({
        where: { profileId },
        include: {
          party: {
            include: { _count: { select: { reservations: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.partyReservation.count({ where: { profileId } }),
    ]);

    return {
      reservations: reservations.map((r) => ({
        ...r,
        party: {
          ...r.party,
          participantCount: r.party._count.reservations,
          _count: undefined,
        },
      })),
      total,
      limit,
      offset,
    };
  }

  async findOne(id: string) {
    const reservation = await this.prisma.partyReservation.findUnique({
      where: { id },
      include: {
        party: {
          include: { _count: { select: { reservations: true } } },
        },
        profile: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException("예약을 찾을 수 없습니다");
    }

    return {
      ...reservation,
      party: {
        ...reservation.party,
        participantCount: reservation.party._count.reservations,
        _count: undefined,
      },
    };
  }

  async cancel(id: string, profileId: string) {
    const reservation = await this.prisma.partyReservation.findUnique({
      where: { id },
      include: { party: true, profile: { include: { user: true } } },
    });

    if (!reservation) {
      throw new NotFoundException("예약을 찾을 수 없습니다");
    }

    if (reservation.profileId !== profileId) {
      throw new BadRequestException("본인의 예약만 취소할 수 있습니다");
    }

    if (reservation.status === "cancelled") {
      throw new BadRequestException("이미 취소된 예약입니다");
    }

    if (reservation.party.status !== "scheduled") {
      throw new BadRequestException("진행 중이거나 완료된 파티의 예약은 취소할 수 없습니다");
    }

    const updated = await this.prisma.partyReservation.update({
      where: { id },
      data: { status: "cancelled" },
      include: { party: true },
    });

    // 예약 취소 알림
    await this.notificationService.create({
      userId: reservation.profile.userId,
      type: "reservation",
      title: "파티 예약 취소",
      message: `${reservation.party.name} 파티 예약이 취소되었습니다.`,
      data: {
        partyId: reservation.party.id,
        partyName: reservation.party.name,
        reservationId: id,
      },
    });

    return updated;
  }

  async getUpcoming(profileId: string, limit = 5) {
    const now = new Date();
    return this.prisma.partyReservation.findMany({
      where: {
        profileId,
        status: "confirmed",
        party: {
          scheduledAt: { gte: now },
          status: "scheduled",
        },
      },
      include: {
        party: {
          include: { _count: { select: { reservations: true } } },
        },
      },
      orderBy: { party: { scheduledAt: "asc" } },
      take: limit,
    });
  }
}
