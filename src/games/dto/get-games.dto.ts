import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsNumber, IsDate, IsBooleanString } from 'class-validator';
import { PaginatedDto } from '@Common';

export class GetGamesQueryOptionsDto extends PaginatedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minPoolPrize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxPoolPrize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  startDateFrom?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  startDateTo?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  purchaseStopsAt?: Date;
}
