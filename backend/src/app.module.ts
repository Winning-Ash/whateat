import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { RestaurantModule } from './restaurant/restaurant.module';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }), RestaurantModule] })
export class AppModule {}
