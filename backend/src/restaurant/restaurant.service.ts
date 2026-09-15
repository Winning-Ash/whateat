import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { CandidateCache } from '../cache/cache.service';
import { bounds, distance, grid, Point, Rect, split } from '../common/utils/distance.util';
import { DailyLimitException, KakaoService } from '../kakao/kakao.service';
import { LocationQueryDto } from './dto/location-query.dto';
import { CandidateSet, Restaurant } from './restaurant.types';

@Injectable()
export class RestaurantService {
  private readonly pending = new Map<string, Promise<CandidateSet>>();
  constructor(private readonly config: ConfigService, private readonly cache: CandidateCache,
    private readonly kakao: KakaoService) {}

  async candidates(query: LocationQueryDto) {
    const cell = grid(query, this.config.get<number>('RESTAURANT_GRID_METERS')!);
    const key = `restaurants:v1:${cell.key}:${query.radius}`;
    let value = await this.cache.get<CandidateSet>(key);
    let cached = value !== undefined;
    if (!value) {
      if (query.cacheOnly) throw new NotFoundException('Candidates are not cached or have expired');
      let pending = this.pending.get(key);
      if (pending) cached = true;
      else {
        // 같은 격자 내 사용자와 캐시 공유를 위한 검색 반경 확장
        const radius = Math.ceil(query.radius + distance(query, cell.center) +
          this.config.get<number>('RESTAURANT_GRID_METERS')!);
        pending = this.collect(query, radius).then(async result => {
          await this.cache.set(key, result, this.config.get<number>('RESTAURANT_CACHE_TTL')!);
          return result;
        });
        this.pending.set(key, pending);
      }
      try { value = await pending; }
      finally { if (this.pending.get(key) === pending) this.pending.delete(key); }
    }
    const restaurants = value.restaurants.filter(place => distance(query, place) <= query.radius);
    return { restaurants, candidateCount: restaurants.length, cached, partial: value.partial };
  }

  async random(query: LocationQueryDto) {
    const { restaurants, ...meta } = await this.candidates(query);
    if (!restaurants.length) throw new NotFoundException('No restaurant candidates within the requested radius');
    return { restaurant: restaurants[randomInt(restaurants.length)], ...meta };
  }

  private async collect(center: Point, radius: number): Promise<CandidateSet> {
    const places = new Map<string, Restaurant>();
    const target = this.config.get<number>('RESTAURANT_TARGET_COUNT')!;
    const maxCalls = this.config.get<number>('RESTAURANT_MAX_CALLS')!;
    const maxDepth = this.config.get<number>('RESTAURANT_MAX_DEPTH')!;
    type Task = { rect?: Rect; page: number; depth: number };
    const queue: Task[] = [{ page: 1, depth: 0 }];
    let calls = 0, partial = false;
    while (queue.length && places.size < target && calls < maxCalls) {
      const task = queue.shift()!;
      const area: Record<string, string | number> = task.rect
        ? { rect: task.rect.join(',') } : { x: center.lng, y: center.lat, radius };
      let result;
      try {
        calls++;
        result = await this.kakao.search(area, task.page);
      } catch (error) {
        if (!(error instanceof DailyLimitException) || places.size === 0) throw error;
        partial = true;
        break;
      }
      for (const place of result.documents) {
        const point = { lat: Number(place.y), lng: Number(place.x) };
        if (!place.id || !place.x || !place.y || !Number.isFinite(point.lat) ||
            !Number.isFinite(point.lng) || distance(center, point) > radius) continue;
        places.set(place.id, {
          id: place.id, name: place.place_name, address: place.address_name,
          roadAddress: place.road_address_name, ...point,
          category: place.category_name, placeUrl: place.place_url,
        });
        if (places.size >= target) { partial = true; break; }
      }
      const capped = result.meta.total_count > Math.min(result.meta.pageable_count, 45 * 15);
      if (capped && task.page === 1 && task.depth < maxDepth) {
        for (const rect of split(task.rect ?? bounds(center, radius))) {
          // 검색 원 밖에 완전히 벗어난 사각형 제외
          const middle = { lng: (rect[0] + rect[2]) / 2, lat: (rect[1] + rect[3]) / 2 };
          const cornerRadius = Math.max(...[
            { lng: rect[0], lat: rect[1] }, { lng: rect[2], lat: rect[1] },
            { lng: rect[0], lat: rect[3] }, { lng: rect[2], lat: rect[3] },
          ].map(corner => distance(middle, corner)));
          if (distance(center, middle) <= radius + cornerRadius) {
            queue.push({ rect, page: 1, depth: task.depth + 1 });
          }
        }
      } else {
        if (capped) partial = true;
        if (!result.meta.is_end && task.page < Math.min(45, Math.ceil(result.meta.pageable_count / 15))) {
          queue.push({ ...task, page: task.page + 1 });
        }
      }
    }
    return { restaurants: [...places.values()], partial: partial || queue.length > 0 };
  }
}
