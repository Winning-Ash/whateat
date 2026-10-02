import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.useGlobalPipes(createValidationPipe());
  app.enableCors({ origin: config.getOrThrow<string>('FRONTEND_ORIGIN'), credentials: true });
  app.enableShutdownHooks();
  await app.listen(config.get<number>('PORT')!);
}
void bootstrap();
