import { Body, Controller, Delete, ForbiddenException, Get, Header, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { cookie } from '../auth/auth-cookie';
import { AddExclusionDto, RestaurantIdDto } from './exclusions.dto';
import { ExclusionsService } from './exclusions.service';

@Controller('users/me/exclusions')
export class ExclusionsController {
  constructor(private readonly exclusions: ExclusionsService, private readonly auth: AuthService,
    private readonly config: ConfigService) {}

  private async user(req: Request, mutation = false) {
    const user = await this.auth.me(cookie(req, 'whateat_session'));
    if (mutation && req.headers.origin !== this.config.getOrThrow<string>('FRONTEND_ORIGIN')) {
      throw new ForbiddenException('Invalid request origin');
    }
    return user;
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() req: Request) {
    return { exclusions: await this.exclusions.list((await this.user(req)).id) };
  }

  @Post()
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async add(@Req() req: Request, @Body() body: AddExclusionDto) {
    await this.exclusions.add((await this.user(req, true)).id, body);
  }

  @Delete(':restaurantId')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async remove(@Req() req: Request, @Param() params: RestaurantIdDto) {
    await this.exclusions.remove((await this.user(req, true)).id, params.restaurantId);
  }
}
