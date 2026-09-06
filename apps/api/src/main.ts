import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT', 3000);
  const uploadRoot = resolve(configService.get<string>('UPLOAD_ROOT') || 'uploads');

  app.enableCors();
  app.useStaticAssets(uploadRoot, { prefix: '/uploads/' });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  await app.listen(port);
}

void bootstrap();
