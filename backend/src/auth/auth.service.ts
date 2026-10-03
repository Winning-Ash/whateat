import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Model } from 'mongoose';
import { LoginSession, LoginState, Member } from './auth.schemas';
import { KakaoAuthService } from './kakao-auth.service';

const validToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly config: ConfigService, private readonly kakao: KakaoAuthService,
    @InjectModel('Member') private readonly members: Model<Member>,
    @InjectModel('LoginSession') private readonly sessions: Model<LoginSession>,
    @InjectModel('LoginState') private readonly states: Model<LoginState>) {}

  async onModuleInit() {
    // Ensure unique identities and TTL indexes exist before accepting sign-ins.
    await Promise.all([this.members.init(), this.sessions.init(), this.states.init()]);
  }

  async start() {
    const state = randomBytes(32).toString('hex');
    const url = this.kakao.authorizeUrl(state);
    await this.states.create({ tokenHash: hash(state), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    return { state, url };
  }

  async finish(state: unknown, cookieState: unknown, code: unknown, providerError: unknown, previousSession?: string) {
    if (!validToken(state) || !validToken(cookieState) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(cookieState))) throw new BadRequestException('Invalid login state');
    // Expiry is checked even before MongoDB's asynchronous TTL deletion runs. Atomic consumption prevents replay.
    const consumed = await this.states.findOneAndDelete({ tokenHash: hash(state), expiresAt: { $gt: new Date() } });
    if (!consumed) throw new BadRequestException('Login state expired or already used');
    if (providerError !== undefined) throw new BadRequestException('Kakao login was cancelled or rejected');
    if (typeof code !== 'string' || !code || code.length > 2048) throw new BadRequestException('Invalid authorization code');
    const profile = await this.kakao.profile(code);
    let member;
    try {
      member = await this.members.findOneAndUpdate({ kakaoId: profile.kakaoId }, { $set: profile },
        { upsert: true, new: true, runValidators: true });
    } catch (error) {
      // A simultaneous first login can race the unique kakaoId index.
      if ((error as { code?: number }).code !== 11000) throw error;
      member = await this.members.findOne({ kakaoId: profile.kakaoId });
    }
    if (!member) throw new UnauthorizedException();
    await this.logout(previousSession);
    const token = randomBytes(32).toString('hex');
    const maxAge = this.config.getOrThrow<number>('AUTH_SESSION_TTL_SECONDS') * 1000;
    await this.sessions.create({ tokenHash: hash(token), userId: member._id, expiresAt: new Date(Date.now() + maxAge) });
    return { token, maxAge };
  }

  async me(token?: string) {
    if (!validToken(token)) throw new UnauthorizedException();
    const session = await this.sessions.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
    if (!session) throw new UnauthorizedException();
    const member = await this.members.findById(session.userId);
    if (!member) throw new UnauthorizedException();
    return { id: member._id.toString(), nickname: member.nickname, createdAt: member.createdAt };
  }

  async logout(token?: string) {
    if (validToken(token)) await this.sessions.deleteOne({ tokenHash: hash(token) });
  }
}
