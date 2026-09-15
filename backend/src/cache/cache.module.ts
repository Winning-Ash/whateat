import { Module } from '@nestjs/common';
import { CandidateCache, MemoryCacheService } from './cache.service';
import { DailyCounter, MemoryDailyCounter } from './daily-counter.service';

@Module({
  providers: [
    { provide: CandidateCache, useClass: MemoryCacheService },
    { provide: DailyCounter, useClass: MemoryDailyCounter },
  ],
  exports: [CandidateCache, DailyCounter],
})
export class CacheModule {}
