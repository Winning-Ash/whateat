import { Module } from '@nestjs/common';
import { CandidateCache } from './cache.service';
import { MongooseModule } from '@nestjs/mongoose';
import { CandidateCacheSchema, MongoCacheService } from './mongo-cache.service';
import { DailyCounter, MemoryDailyCounter } from './daily-counter.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'CandidateCacheEntry', schema: CandidateCacheSchema }])],
  providers: [
    { provide: CandidateCache, useClass: MongoCacheService },
    { provide: DailyCounter, useClass: MemoryDailyCounter },
  ],
  exports: [CandidateCache, DailyCounter],
})
export class CacheModule {}
