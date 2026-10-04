import { Injectable } from '@nestjs/common';

export abstract class DailyCounter {
  // Must atomically check and reserve BEFORE sending an HTTP request.
  abstract reserve(date: string, limit: number): Promise<boolean>;
}

@Injectable()
// Test adapter; production uses MongoDailyCounter.
export class MemoryDailyCounter extends DailyCounter {
  private date = '';
  private count = 0;
  async reserve(date: string, limit: number): Promise<boolean> {
    if (this.date !== date) { this.date = date; this.count = 0; }
    if (this.count >= limit) return false;
    this.count++;
    return true;
  }
}
