import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { KakaoModule } from '../kakao/kakao.module';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
@Module({ imports: [CacheModule, KakaoModule], controllers: [RestaurantController], providers: [RestaurantService] })
export class RestaurantModule {}
