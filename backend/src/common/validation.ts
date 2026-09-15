import { ValidationPipe } from '@nestjs/common';

export const createValidationPipe = () => new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
