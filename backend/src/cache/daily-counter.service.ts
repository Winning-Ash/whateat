import { Injectable } from '@nestjs/common';

export abstract class DailyCounter {
  // Must atomically check and reserve BEFORE sending an HTTP request.
  // Redis adapter: implement with a Lua check/increment/expiry transaction.
  abstract reserve(date: string, limit: number): Promise<boolean>;
}

@Injectable()
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
