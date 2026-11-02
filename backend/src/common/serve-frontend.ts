import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Only frontend/dist is public. Missing API routes continue to return JSON 404s.
export function serveFrontend(app: NestExpressApplication, config: ConfigService,
  directory = join(__dirname, '..', '..', '..', 'frontend', 'dist')) {
  if (!config.get<boolean>('SERVE_FRONTEND')) return;
  if (!existsSync(join(directory, 'index.html'))) {
    throw new Error('Frontend build is missing. Run the build from the repository root before starting the combined service.');
  }
  app.useStaticAssets(directory, {
    dotfiles: 'deny',
    index: 'index.html',
    setHeaders(response, filePath) {
      if (filePath.endsWith('index.html')) response.setHeader('Cache-Control', 'no-store');
    },
  });
}
