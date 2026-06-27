/**
 * PM2 클러스터 설정 — 프로덕션 다중 프로세스
 *
 * 사용법:
 *   pnpm -w run build          # 빌드
 *   pm2 start ecosystem.config.js --env production
 *   pm2 monit                  # 모니터링
 *
 * 주의: 백엔드 클러스터 모드(instances > 1) 사용 시
 *   Socket.io 멀티-프로세스 지원을 위해 Redis 어댑터가 필요합니다.
 *   pnpm add @socket.io/redis-adapter --filter @mingle/backend
 *   그 전까지는 instances: 1 로 유지하세요.
 */
module.exports = {
  apps: [
    {
      name: "mingle-backend",
      script: "dist/main.js",
      cwd: "./apps/backend",
      // Socket.io 단일 인스턴스 (Redis 어댑터 설치 전)
      // Redis 어댑터 설치 후 'max' 또는 원하는 숫자로 변경
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "development",
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4000,
      },
    },
    {
      name: "mingle-web",
      script: "node_modules/.bin/next",
      args: "start -p 3100",
      cwd: "./apps/web",
      // Next.js는 stateless — 코어 수만큼 클러스터 가능
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "development",
        PORT: 3100,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3100,
      },
    },
  ],
};
