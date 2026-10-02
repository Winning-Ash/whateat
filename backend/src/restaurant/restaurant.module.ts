import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { KakaoModule } from '../kakao/kakao.module';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { AuthModule } from '../auth/auth.module';
import { ExclusionsModule } from '../exclusions/exclusions.module';
@Module({ imports: [CacheModule, KakaoModule, AuthModule, ExclusionsModule], controllers: [RestaurantController], providers: [RestaurantService] })
export class RestaurantModule {}
