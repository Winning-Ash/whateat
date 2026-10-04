import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { AuthService } from '../auth/auth.service';
import { KakaoAuthService } from '../auth/kakao-auth.service';
import { Member, LoginSession } from '../auth/auth.schemas';
import { Like } from '../likes/likes.schema';
import { Exclusion } from '../exclusions/exclusions.schema';

@Injectable()
export class WithdrawalService {
  constructor(private readonly auth: AuthService, private readonly kakao: KakaoAuthService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel('Member') private readonly members: Model<Member>,
    @InjectModel('LoginSession') private readonly sessions: Model<LoginSession>,
    @InjectModel('Like') private readonly likes: Model<Like>,
    @InjectModel('Exclusion') private readonly exclusions: Model<Exclusion>) {}

  async withdraw(token?: string) {
    const user = await this.auth.me(token);
    const member = await this.members.findById(user.id);
    if (!member) throw new UnauthorizedException();
    // Do not destroy the local identity if unlink fails or admin credentials are missing.
    await this.kakao.unlink(member.kakaoId);
    try {
      await this.connection.transaction(async session => {
        await this.members.deleteOne({ _id: member._id }, { session });
        await this.likes.deleteMany({ userId: member._id }, { session });
        await this.exclusions.deleteMany({ userId: member._id }, { session });
        await this.sessions.deleteMany({ userId: member._id }, { session });
      });
    } catch {
      // All local deletes roll back together. Preserve cookie so the caller can retry.
      throw new ServiceUnavailableException('Account cleanup failed. Please retry withdrawal.');
    }
  }
}
