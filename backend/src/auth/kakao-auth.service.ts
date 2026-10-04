import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KakaoAuthService {
  constructor(private readonly config: ConfigService) {}

  async unlink(kakaoId: string): Promise<void> {
    const key = this.config.get<string>('KAKAO_ADMIN_KEY')?.trim();
    if (!key) throw new ServiceUnavailableException('Account withdrawal requires KAKAO_ADMIN_KEY');
    try {
      const response = await fetch('https://kapi.kakao.com/v1/user/unlink', {
        method: 'POST',
        headers: { Authorization: `KakaoAK ${key}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams({ target_id_type: 'user_id', target_id: kakaoId }),
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.json() as { id?: number; code?: number };
      // A retry may encounter an account already unlinked by the preceding attempt.
      if (response.status === 400 && body.code === -101) return;
      if (!response.ok || String(body.id) !== kakaoId) throw new Error();
    } catch {
      throw new BadGatewayException('Kakao unlink failed. Please retry account withdrawal.');
    }
  }

  private settings() {
    const key = this.config.get<string>('KAKAO_REST_API_KEY')?.trim();
    const secret = this.config.get<string>('KAKAO_CLIENT_SECRET')?.trim();
    const redirect = this.config.get<string>('KAKAO_REDIRECT_URI');
    if (!key || !secret || !redirect) throw new ServiceUnavailableException('Kakao login is not configured');
    return { key, secret, redirect };
  }

  authorizeUrl(state: string) {
    const { key, redirect } = this.settings();
    const url = new URL('https://kauth.kakao.com/oauth/authorize');
    url.search = new URLSearchParams({ client_id: key, redirect_uri: redirect, response_type: 'code', state }).toString();
    return url.toString();
  }

  async profile(code: string): Promise<{ kakaoId: string; nickname: string }> {
    const { key, secret, redirect } = this.settings();
    try {
      const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams({ grant_type: 'authorization_code', client_id: key,
          client_secret: secret, redirect_uri: redirect, code }),
        signal: AbortSignal.timeout(10000),
      });
      if (!tokenResponse.ok) throw new Error();
      const token = await tokenResponse.json() as { access_token?: unknown };
      if (typeof token.access_token !== 'string' || !token.access_token) throw new Error();
      const response = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error();
      const profile = await response.json() as { id?: unknown; kakao_account?: { profile?: { nickname?: unknown } } };
      if (typeof profile.id !== 'number' || !Number.isSafeInteger(profile.id) || profile.id <= 0) throw new Error();
      const nickname = profile.kakao_account?.profile?.nickname;
      return { kakaoId: String(profile.id), nickname: typeof nickname === 'string' && nickname.trim()
        ? nickname.trim().slice(0, 100) : '회원' };
    } catch {
      // Never log or return authorization codes, Kakao tokens or upstream response bodies.
      throw new BadGatewayException('Kakao login failed. Please start login again.');
    }
  }
}
