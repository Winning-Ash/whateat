import { BadGatewayException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DailyCounter } from '../cache/daily-counter.service';

export interface KakaoPlace {
  id: string; place_name: string; address_name: string; road_address_name: string;
  x: string; y: string; category_name: string; place_url: string;
}
export interface KakaoResult {
  meta: { total_count: number; pageable_count: number; is_end: boolean };
  documents: KakaoPlace[];
}
export class DailyLimitException extends HttpException {
  constructor() { super('Daily Kakao API limit reached. Retry with existing cached candidates.', 429); }
}

@Injectable()
export class KakaoService {
  constructor(private readonly config: ConfigService, private readonly counter: DailyCounter) {}

  async search(area: Record<string, string | number>, page = 1): Promise<KakaoResult> {
    const key = this.config.get<string>('KAKAO_REST_API_KEY')?.trim();
    if (!key) throw new ServiceUnavailableException('Set KAKAO_REST_API_KEY in backend/.env');
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.config.get<string>('KAKAO_COUNTER_TIMEZONE'),
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    if (!await this.counter.reserve(date, this.config.get<number>('KAKAO_DAILY_LIMIT')!)) {
      throw new DailyLimitException();
    }
    const url = new URL('https://dapi.kakao.com/v2/local/search/category.json');
    for (const [name, value] of Object.entries({ ...area, category_group_code: 'FD6', size: 15, page })) {
      url.searchParams.set(name, String(value));
    }
    try {
      const response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${key}` },
        signal: AbortSignal.timeout(this.config.get<number>('KAKAO_TIMEOUT_MS')!),
      });
      if (!response.ok) throw new Error('upstream failure');
      const result = await response.json() as KakaoResult;
      if (!Array.isArray(result.documents) || !result.meta ||
          !Number.isInteger(result.meta.total_count) || result.meta.total_count < 0 ||
          !Number.isInteger(result.meta.pageable_count) || result.meta.pageable_count < 0 ||
          typeof result.meta.is_end !== 'boolean') throw new Error('invalid upstream response');
      return result;
    } catch {
      // Never expose upstream response bodies, headers, or keys. No automatic paid retries.
      throw new BadGatewayException('Kakao search failed or timed out');
    }
  }
}
