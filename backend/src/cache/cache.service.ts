import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Async contract allows a Redis GET / SET EX adapter without changing callers.
export abstract class CandidateCache {
  abstract get<T>(key: string): Promise<T | undefined>;
  abstract set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

@Injectable()
export class MemoryCacheService extends CandidateCache {
  private readonly entries = new Map<string, { value: unknown; expires: number }>();
  constructor(private readonly config: ConfigService) { super(); }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) { this.entries.delete(key); return undefined; }
    return structuredClone(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    for (const [id, entry] of this.entries) {
      if (entry.expires <= Date.now()) this.entries.delete(id);
    }
    this.entries.delete(key);
    if (this.entries.size >= this.config.get<number>('RESTAURANT_CACHE_MAX_ENTRIES')!) {
      this.entries.delete(this.entries.keys().next().value!);
    }
    this.entries.set(key, { value: structuredClone(value), expires: Date.now() + ttlSeconds * 1000 });
  }
}
