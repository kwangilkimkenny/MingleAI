import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { socketCorsOrigin } from "./common/socket-cors";
import { UPLOADS_DIR } from "./upload/upload.controller";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const supplied = request.header("x-request-id");
    const requestId = supplied && /^[A-Za-z0-9._-]{1,80}$/.test(supplied) ? supplied : randomUUID();
    response.setHeader("x-request-id", requestId);
    next();
  });

  // Serve uploaded profile photos as static files at /uploads/<name>.
  app.useStaticAssets(UPLOADS_DIR, { prefix: "/uploads/" });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  // Production validation rejects an empty/wildcard allowlist before the app starts.
  app.enableCors({ origin: socketCorsOrigin() });

  if (process.env.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true") {
    const config = new DocumentBuilder()
      .setTitle("MingleAI API")
      .setDescription("Another I 소셜 매칭 플랫폼 API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api", app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
