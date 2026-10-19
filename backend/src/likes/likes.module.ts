import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { LikeSchema } from './likes.schema';
import { LikesService } from './likes.service';
import { LikesController } from './likes.controller';
import { MemberSchema } from '../auth/auth.schemas';
import { LikeListsService } from './like-lists.service';
import { LikeListsController } from './like-lists.controller';

@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: 'Like', schema: LikeSchema }, { name: 'Member', schema: MemberSchema }])],
  providers: [LikesService, LikeListsService], controllers: [LikesController, LikeListsController], exports: [LikesService],
})
export class LikesModule {}
