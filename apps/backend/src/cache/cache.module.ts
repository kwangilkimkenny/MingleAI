import { Module } from "@nestjs/common";
import { CacheModule as NestCacheModule } from "@nestjs/cache-manager";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createKeyv } from "@keyv/redis";

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get("REDIS_URL");
        if (redisUrl) {
          return {
            stores: [createKeyv(redisUrl, { namespace: "mingle" })],
            ttl: 60_000,
          };
        }
        // 로컬 개발: 인메모리 캐시 (Redis 미설정 시)
        return { ttl: 60_000 };
      },
    }),
  ],
})
export class CacheConfigModule {}
