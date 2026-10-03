import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class RestaurantIdDto {
  @Matches(/^\d{1,20}$/)
  restaurantId!: string;
}
export class AddExclusionDto extends RestaurantIdDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 300)
  restaurantName!: string;
}
