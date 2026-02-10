import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ReservationService } from "./reservation.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";

@ApiTags("reservations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reservations")
export class ReservationController {
  constructor(private reservationService: ReservationService) {}

  @Post()
  @ApiOperation({ summary: "예약 생성" })
  create(@Body() dto: CreateReservationDto) {
    return this.reservationService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "내 예약 목록" })
  @ApiQuery({ name: "profileId", required: true })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  findAll(
    @Query("profileId") profileId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.reservationService.findAllByProfile(
      profileId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Get("upcoming")
  @ApiOperation({ summary: "다가오는 예약 목록" })
  @ApiQuery({ name: "profileId", required: true })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getUpcoming(
    @Query("profileId") profileId: string,
    @Query("limit") limit?: string,
  ) {
    return this.reservationService.getUpcoming(
      profileId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "예약 상세" })
  findOne(@Param("id") id: string) {
    return this.reservationService.findOne(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "예약 취소" })
  @ApiQuery({ name: "profileId", required: true })
  cancel(
    @Param("id") id: string,
    @Query("profileId") profileId: string,
  ) {
    return this.reservationService.cancel(id, profileId);
  }
}
