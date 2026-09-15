import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class LocationQueryDto {
  // Korean Local API coverage; also avoids polar/dateline rectangle ambiguity.
  @Type(() => Number) @IsNumber() @Min(33) @Max(39.5)
  lat!: number;

  @Type(() => Number) @IsNumber() @Min(124) @Max(132)
  lng!: number;

  @Type(() => Number) @IsInt() @Min(100) @Max(500)
  radius!: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  cacheOnly?: boolean;
}
