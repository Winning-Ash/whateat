import { Module } from '@nestjs/common';
import { CandidateCache } from './cache.service';
import { MongooseModule } from '@nestjs/mongoose';
import { CandidateCacheSchema, MongoCacheService } from './mongo-cache.service';
import { DailyCounter } from './daily-counter.service';
import { DailyUsageSchema, MongoDailyCounter } from './mongo-daily-counter.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: 'CandidateCacheEntry', schema: CandidateCacheSchema },
    { name: 'KakaoDailyUsage', schema: DailyUsageSchema },
  ])],
  providers: [
    { provide: CandidateCache, useClass: MongoCacheService },
    { provide: DailyCounter, useClass: MongoDailyCounter },
  ],
  exports: [CandidateCache, DailyCounter],
})
export class CacheModule {}
