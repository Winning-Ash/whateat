import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Schema } from 'mongoose';
import { DailyCounter } from './daily-counter.service';

interface DailyUsage { _id: string; count: number }
export const DailyUsageSchema = new Schema<DailyUsage>({
  _id: { type: String, required: true },
  count: { type: Number, required: true },
}, { collection: 'kakao_daily_usage', versionKey: false });

@Injectable()
export class MongoDailyCounter extends DailyCounter implements OnModuleInit {
  constructor(@InjectModel('KakaoDailyUsage') private readonly usage: Model<DailyUsage>) { super(); }

  async onModuleInit() { await this.usage.init(); }

  async reserve(date: string, limit: number): Promise<boolean> {
    if (!Number.isSafeInteger(limit) || limit <= 0) return false;
    const filter = { _id: date, count: { $lt: limit } };
    const update = { $inc: { count: 1 } };
    try {
      try {
        const result = await this.usage.updateOne(filter, update, { upsert: true });
        return result.modifiedCount === 1 || result.upsertedCount === 1;
      } catch (error) {
        // A full counter cannot match the filter; its unique date prevents insertion.
        // Also handle concurrent creation by retrying the guarded increment only.
        if ((error as { code?: number }).code !== 11000) throw error;
        const result = await this.usage.updateOne(filter, update);
        return result.modifiedCount === 1;
      }
    } catch {
      // Never send an upstream request when the reservation cannot be confirmed.
      throw new ServiceUnavailableException('Kakao usage counter unavailable. Please retry later.');
    }
  }
}
