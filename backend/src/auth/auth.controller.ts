import { Controller, ForbiddenException, Get, Header, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, CookieOptions } from 'express';
import { AuthService } from './auth.service';

import { cookie } from './auth-cookie';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}
  private options(state = false): CookieOptions {
    return { httpOnly: true, secure: this.config.get<boolean>('AUTH_COOKIE_SECURE'),
      sameSite: state ? 'lax' : this.config.get<'lax' | 'none'>('AUTH_COOKIE_SAME_SITE'),
      path: state ? '/auth/kakao' : '/' };
  }

  @Get('kakao')
  async start(@Res() res: Response) {
    const { state, url } = await this.auth.start();
    res.setHeader('Cache-Control', 'no-store');
    res.cookie('whateat_oauth_state', state, { ...this.options(true), maxAge: 600000 });
    res.redirect(url);
  }

  @Get('kakao/callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.clearCookie('whateat_oauth_state', this.options(true));
    try {
      const session = await this.auth.finish(req.query.state, cookie(req, 'whateat_oauth_state'),
        req.query.code, req.query.error, cookie(req, 'whateat_session'));
      res.cookie('whateat_session', session.token, { ...this.options(), maxAge: session.maxAge });
      res.redirect(this.config.getOrThrow<string>('FRONTEND_ORIGIN'));
    } catch {
      // Redirect only to a configured origin, never to an arbitrary callback query parameter.
      res.redirect(`${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/?login=failed`);
    }
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  async me(@Req() req: Request) {
    return { user: await this.auth.me(cookie(req, 'whateat_session')) };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    if (req.headers.origin !== this.config.getOrThrow<string>('FRONTEND_ORIGIN')) throw new ForbiddenException('Invalid request origin');
    await this.auth.logout(cookie(req, 'whateat_session'));
    res.clearCookie('whateat_session', this.options());
    res.setHeader('Cache-Control', 'no-store');
    res.status(204).send();
  }
}
