import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Schema } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { CandidateCache } from './cache.service';

interface CacheEntry { _id: string; value: unknown; expiresAt: Date; writtenAt: Date; revision: string }
export const CandidateCacheSchema = new Schema<CacheEntry>({
  _id: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  writtenAt: { type: Date, required: true },
  revision: { type: String, required: true },
}, { collection: 'restaurant_cache', versionKey: false });
CandidateCacheSchema.index({ writtenAt: -1, _id: 1 });

@Injectable()
export class MongoCacheService extends CandidateCache implements OnModuleInit {
  constructor(@InjectModel('CandidateCacheEntry') private readonly entries: Model<CacheEntry>,
    private readonly config: ConfigService) { super(); }

  async onModuleInit() { await this.entries.init(); }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      // TTL deletion is asynchronous: expired rows must never be returned to callers.
      const entry = await this.entries.findOne({ _id: key, expiresAt: { $gt: new Date() } }).lean();
      return entry ? entry.value as T : undefined;
    } catch { throw new ServiceUnavailableException('Restaurant cache unavailable. Please retry later.'); }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const now = new Date();
      const update = { $set: { value, writtenAt: now, expiresAt: new Date(now.getTime() + ttlSeconds * 1000), revision: randomUUID() } };
      try { await this.entries.updateOne({ _id: key }, update, { upsert: true, runValidators: true }); }
      catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        await this.entries.updateOne({ _id: key }, update, { runValidators: true });
      }
      await this.entries.deleteMany({ expiresAt: { $lte: now } });
      const overflow = await this.entries.find({}).sort({ writtenAt: -1, _id: 1 })
        .skip(this.config.getOrThrow<number>('RESTAURANT_CACHE_MAX_ENTRIES'))
        .select('_id revision').lean();
      if (overflow.length) {
        // Do not delete entries another server refreshed after the scan.
        await this.entries.deleteMany({ $or: overflow.map(entry => ({ _id: entry._id, revision: entry.revision })) });
      }
    } catch { throw new ServiceUnavailableException('Restaurant cache unavailable. Please retry later.'); }
  }
}
