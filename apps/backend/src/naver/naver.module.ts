import { Module } from "@nestjs/common";
import { NaverController } from "./naver.controller";
import { NaverSearchService } from "./naver-search.service";

@Module({
  controllers: [NaverController],
  providers: [NaverSearchService],
  exports: [NaverSearchService],
})
export class NaverModule {}
