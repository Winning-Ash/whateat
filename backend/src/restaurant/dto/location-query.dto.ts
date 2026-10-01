import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, Matches, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { FOOD_CATEGORIES, FoodCategory } from '../restaurant.categories';

export class LocationQueryDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  @IsArray() @ArrayMaxSize(100)
  @Matches(/^\d{1,20}$/, { each: true })
  excludeIds?: string[];

  // Korean Local API coverage; also avoids polar/dateline rectangle ambiguity.
  @Type(() => Number) @IsNumber() @Min(33) @Max(39.5)
  lat!: number;

  @Type(() => Number) @IsNumber() @Min(124) @Max(132)
  lng!: number;

  @Type(() => Number) @IsInt() @Min(100) @Max(500)
  radius!: number;

  @IsOptional() @IsIn(FOOD_CATEGORIES)
  category?: FoodCategory;

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  cacheOnly?: boolean;
}
