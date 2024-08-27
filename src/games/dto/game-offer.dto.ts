import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { OfferType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';

export class GameOfferDto {
  @ApiProperty()
  @IsEnum(OfferType)
  type: OfferType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPositive()
  @IsNumber()
  @Min(1)
  buy?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(1)
  get?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(100)
  discount?: number;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

export class UpdateGameOfferDto extends PartialType(GameOfferDto) {
  @ApiProperty()
  @IsNumber()
  id: number;
}
