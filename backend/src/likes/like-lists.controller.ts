import { Body, Controller, Delete, ForbiddenException, Get, Header, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { cookie } from '../auth/auth-cookie';
import { LikeListsService } from './like-lists.service';
import { LikesService } from './likes.service';
import { LikeListIdDto, LikeListNameDto, LikeListRestaurantDto } from './like-lists.dto';
import { AddLikeDto } from './likes.dto';

@Controller('users/me/like-lists')
export class LikeListsController {
  constructor(private readonly lists: LikeListsService, private readonly likes: LikesService,
    private readonly auth: AuthService, private readonly config: ConfigService) {}

  private async user(req: Request, mutation = false) {
    const user = await this.auth.me(cookie(req, 'whateat_session'));
    if (mutation && req.headers.origin !== this.config.getOrThrow<string>('FRONTEND_ORIGIN')) {
      throw new ForbiddenException('Invalid request origin');
    }
    return user;
  }

  @Get() @Header('Cache-Control', 'no-store')
  async list(@Req() req: Request) {
    return { lists: await this.lists.list((await this.user(req)).id) };
  }

  @Post() @Header('Cache-Control', 'no-store')
  async create(@Req() req: Request, @Body() body: LikeListNameDto) {
    const user = await this.user(req, true);
    return { list: await this.auth.withMemberWrite(user.id, session => this.lists.create(user.id, body.name, session)) };
  }

  @Patch(':listId') @HttpCode(204) @Header('Cache-Control', 'no-store')
  async rename(@Req() req: Request, @Param() params: LikeListIdDto, @Body() body: LikeListNameDto) {
    const user = await this.user(req, true);
    await this.auth.withMemberWrite(user.id, session => this.lists.rename(user.id, params.listId, body.name, session));
  }

  @Delete(':listId') @HttpCode(204) @Header('Cache-Control', 'no-store')
  async remove(@Req() req: Request, @Param() params: LikeListIdDto) {
    const user = await this.user(req, true);
    await this.auth.withMemberWrite(user.id, session => this.lists.remove(user.id, params.listId, session));
  }

  @Get(':listId/likes') @Header('Cache-Control', 'no-store')
  async items(@Req() req: Request, @Param() params: LikeListIdDto) {
    const user = await this.user(req);
    await this.lists.requireList(user.id, params.listId);
    return { likes: await this.likes.listInList(user.id, params.listId) };
  }

  @Post(':listId/likes') @HttpCode(204) @Header('Cache-Control', 'no-store')
  async add(@Req() req: Request, @Param() params: LikeListIdDto, @Body() body: AddLikeDto) {
    const user = await this.user(req, true);
    await this.auth.withMemberWrite(user.id, async session => {
      await this.lists.requireList(user.id, params.listId, session);
      await this.likes.addToList(user.id, params.listId, body, session);
    });
  }

  @Delete(':listId/likes/:restaurantId') @HttpCode(204) @Header('Cache-Control', 'no-store')
  async removeItem(@Req() req: Request, @Param() params: LikeListRestaurantDto) {
    const user = await this.user(req, true);
    await this.auth.withMemberWrite(user.id, async session => {
      await this.lists.requireList(user.id, params.listId, session);
      await this.likes.removeFromList(user.id, params.listId, params.restaurantId, session);
    });
  }
}
