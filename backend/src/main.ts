import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/validation';
import { serveFrontend } from './common/serve-frontend';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  app.useGlobalPipes(createValidationPipe());
  app.enableCors({ origin: config.getOrThrow<string>('FRONTEND_ORIGIN'), credentials: true });
  serveFrontend(app, config);
  app.enableShutdownHooks();
  await app.listen(config.get<number>('PORT')!, '0.0.0.0');
}
void bootstrap();
