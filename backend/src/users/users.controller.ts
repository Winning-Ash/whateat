import { Controller, Delete, ForbiddenException, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { cookie } from '../auth/auth-cookie';
import { WithdrawalService } from './withdrawal.service';

@Controller('users')
export class UsersController {
  constructor(private readonly withdrawal: WithdrawalService, private readonly config: ConfigService) {}

  @Delete('me')
  async withdraw(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers.origin !== this.config.getOrThrow<string>('FRONTEND_ORIGIN')) throw new ForbiddenException('Invalid request origin');
    await this.withdrawal.withdraw(cookie(req, 'whateat_session'));
    res.clearCookie('whateat_session', { httpOnly: true, secure: this.config.get<boolean>('AUTH_COOKIE_SECURE'),
      sameSite: this.config.get<'lax' | 'none'>('AUTH_COOKIE_SAME_SITE'), path: '/' });
    res.clearCookie('whateat_oauth_state', { httpOnly: true, secure: this.config.get<boolean>('AUTH_COOKIE_SECURE'), sameSite: 'lax', path: '/auth/kakao' });
    res.status(204).send();
  }
}
