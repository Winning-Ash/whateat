import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { RestaurantModule } from './restaurant/restaurant.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { LikesModule } from './likes/likes.module';
import { UsersModule } from './users/users.module';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }), DatabaseModule, RestaurantModule, AuthModule, LikesModule, UsersModule] })
export class AppModule {}
