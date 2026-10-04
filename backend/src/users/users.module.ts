import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { MemberSchema, LoginSessionSchema } from '../auth/auth.schemas';
import { LikeSchema } from '../likes/likes.schema';
import { ExclusionSchema } from '../exclusions/exclusions.schema';
import { UsersController } from './users.controller';
import { WithdrawalService } from './withdrawal.service';

@Module({
  imports: [AuthModule, MongooseModule.forFeature([
    { name: 'Member', schema: MemberSchema }, { name: 'LoginSession', schema: LoginSessionSchema },
    { name: 'Like', schema: LikeSchema }, { name: 'Exclusion', schema: ExclusionSchema },
  ])],
  controllers: [UsersController], providers: [WithdrawalService],
})
export class UsersModule {}
