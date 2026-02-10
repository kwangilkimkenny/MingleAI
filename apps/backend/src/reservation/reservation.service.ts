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
    // 파티 확인
    const party = await this.prisma.party.findUnique({
      where: { id: dto.partyId },
      include: { _count: { select: { reservations: true } } },
    });

    if (!party) {
      throw new NotFoundException("파티를 찾을 수 없습니다");
    }

    if (party.status !== "scheduled") {
      throw new BadRequestException("예약 가능한 파티가 아닙니다");
    }

    // 정원 체크
    if (party._count.reservations >= party.maxParticipants) {
      throw new BadRequestException("파티 정원이 가득 찼습니다");
    }

    // 프로필 확인
    const profile = await this.prisma.profile.findUnique({
      where: { id: dto.profileId },
      include: { user: true },
    });

    if (!profile) {
      throw new NotFoundException("프로필을 찾을 수 없습니다");
    }

    // 나이 제한 확인
    if (party.ageMin && profile.age < party.ageMin) {
      throw new BadRequestException(
        `이 파티는 ${party.ageMin}세 이상만 참여 가능합니다`,
      );
    }

    if (party.ageMax && profile.age > party.ageMax) {
      throw new BadRequestException(
        `이 파티는 ${party.ageMax}세 이하만 참여 가능합니다`,
      );
    }

    // 중복 예약 체크
    const existing = await this.prisma.partyReservation.findUnique({
      where: {
        partyId_profileId: {
          partyId: dto.partyId,
          profileId: dto.profileId,
        },
      },
    });

    if (existing) {
      throw new ConflictException("이미 예약한 파티입니다");
    }

    const reservation = await this.prisma.partyReservation.create({
      data: {
        partyId: dto.partyId,
        profileId: dto.profileId,
        status: "confirmed",
      },
      include: {
        party: true,
        profile: true,
      },
    });

    // 예약 확인 알림 생성
    await this.notificationService.create({
      userId: profile.userId,
      type: "reservation",
      title: "파티 예약 완료",
      message: `${party.name} 파티 예약이 완료되었습니다.`,
      data: {
        partyId: party.id,
        partyName: party.name,
        scheduledAt: party.scheduledAt.toISOString(),
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
