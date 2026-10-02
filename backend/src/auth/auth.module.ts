import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { KakaoAuthService } from './kakao-auth.service';
import { LoginSessionSchema, LoginStateSchema, MemberSchema } from './auth.schemas';

@Module({
  imports: [MongooseModule.forFeature([
    { name: 'Member', schema: MemberSchema },
    { name: 'LoginSession', schema: LoginSessionSchema },
    { name: 'LoginState', schema: LoginStateSchema },
  ])],
  controllers: [AuthController], providers: [AuthService, KakaoAuthService], exports: [AuthService],
})
export class AuthModule {}
