import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { cookie } from '../auth/auth-cookie';
import { ExclusionsService } from '../exclusions/exclusions.service';
import { LocationQueryDto } from './dto/location-query.dto';
import { RestaurantService } from './restaurant.service';
import { FOOD_CATEGORIES } from './restaurant.categories';

@Controller('restaurants')
export class RestaurantController {
  constructor(private readonly restaurants: RestaurantService, private readonly auth: AuthService,
    private readonly exclusions: ExclusionsService) {}
  private async withExclusions(query: LocationQueryDto, req: Request) {
    const token = cookie(req, 'whateat_session');
    if (token === undefined) return query;
    const user = await this.auth.me(token);
    return { ...query, excludeIds: [...new Set([...(query.excludeIds ?? []), ...await this.exclusions.ids(user.id)])] };
  }
  @Get('categories')
  categories() { return { categories: FOOD_CATEGORIES }; }
  @Get('random')
  @Header('Cache-Control', 'no-store')
  async random(@Query() query: LocationQueryDto, @Req() req: Request) {
    return this.restaurants.random(await this.withExclusions(query, req));
  }
  @Get('candidates')
  @Header('Cache-Control', 'no-store')
  async candidates(@Query() query: LocationQueryDto, @Req() req: Request) {
    return this.restaurants.candidates(await this.withExclusions(query, req));
  }
}
