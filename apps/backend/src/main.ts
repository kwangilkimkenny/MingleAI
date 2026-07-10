import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { socketCorsOrigin } from "./common/socket-cors";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  // REST CORS shares the WebSocket allowlist (SOCKET_CORS_ORIGINS). Unset → reflect any origin
  // (dev default, unchanged). Warn if left open in production.
  if (process.env.NODE_ENV === "production" && !process.env.SOCKET_CORS_ORIGINS?.trim()) {
    new Logger("Bootstrap").warn(
      "SOCKET_CORS_ORIGINS is unset in production — HTTP/WebSocket CORS reflects ANY origin. Set an allowlist.",
    );
  }
  app.enableCors({ origin: socketCorsOrigin() });

  const config = new DocumentBuilder()
    .setTitle("MingleAI API")
    .setDescription("Another I 소셜 매칭 플랫폼 API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
