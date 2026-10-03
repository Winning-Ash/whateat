import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ExclusionSchema } from './exclusions.schema';
import { ExclusionsService } from './exclusions.service';
import { ExclusionsController } from './exclusions.controller';

@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: 'Exclusion', schema: ExclusionSchema }])],
  providers: [ExclusionsService], controllers: [ExclusionsController], exports: [ExclusionsService],
})
export class ExclusionsModule {}
