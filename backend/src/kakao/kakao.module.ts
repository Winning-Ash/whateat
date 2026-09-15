import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { KakaoService } from './kakao.service';
@Module({ imports: [CacheModule], providers: [KakaoService], exports: [KakaoService] })
export class KakaoModule {}
