import { Controller, Get, Query } from '@nestjs/common';
import { LocationQueryDto } from './dto/location-query.dto';
import { RestaurantService } from './restaurant.service';

@Controller('restaurants')
export class RestaurantController {
  constructor(private readonly restaurants: RestaurantService) {}
  @Get('random')
  random(@Query() query: LocationQueryDto) { return this.restaurants.random(query); }
  @Get('candidates')
  candidates(@Query() query: LocationQueryDto) { return this.restaurants.candidates(query); }
}
