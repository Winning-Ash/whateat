import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { RestaurantIdDto } from './likes.dto';

export class LikeListNameDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 30)
  name!: string;
}
export class LikeListIdDto {
  @Matches(/^(default|[a-f0-9]{24})$/)
  listId!: string;
}
export class LikeListRestaurantDto extends RestaurantIdDto {
  @Matches(/^(default|[a-f0-9]{24})$/)
  listId!: string;
}
