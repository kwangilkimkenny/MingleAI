import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { ProfileService } from "./profile.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";

@ApiTags("Profiles")
@Controller("profiles")
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProfileDto) {
    return this.profileService.create(user.userId, dto);
  }

  @Get()
  findAll(
    @Query("location") location?: string,
    @Query("ageMin") ageMin?: string,
    @Query("ageMax") ageMax?: string,
    @Query("relationshipGoal") relationshipGoal?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.profileService.findAll({
      location,
      ageMin: ageMin ? Number(ageMin) : undefined,
      ageMax: ageMax ? Number(ageMax) : undefined,
      relationshipGoal,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(":id")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30_000)
  findOne(@Param("id") id: string) {
    return this.profileService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.update(id, user.userId, dto);
  }
}
