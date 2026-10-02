import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { LikeSchema } from './likes.schema';
import { LikesService } from './likes.service';
import { LikesController } from './likes.controller';

@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: 'Like', schema: LikeSchema }])],
  providers: [LikesService], controllers: [LikesController], exports: [LikesService],
})
export class LikesModule {}
