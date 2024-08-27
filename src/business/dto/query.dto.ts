import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';
import { IsBooleanString, IsEnum, IsOptional } from 'class-validator';
import { EmptyObject } from 'type-fest';

export type BusinessTrends = {
  weekly: {
    day: string;
    total: number;
  }[];
  prizePool: {
    prize: Decimal;
    count: number;
  }[];
  sheetPrice: {
    prize: Decimal;
    count: number;
  }[];
};

export type BusinessStatsType = {
  totalGames: number;
  totalActiveGames: number;
  totalCollection: number;
  totalProfit: number;
  walletBalance: number;
  totalUsers: number;
  totalActiveUsers: number;
};

export type BusinessResponseType = {
  stats?: BusinessStatsType | EmptyObject;
  trends?: BusinessTrends | EmptyObject;
};

export enum TrendType {
  Weekly = 'weekly',
  PrizePool = 'prizePool',
  SheetPrice = 'sheetPrice',
}

export class TrendsQueryDto {
  @ApiProperty({ enum: TrendType })
  @IsEnum(TrendType)
  type: TrendType;
}

export class BusinessQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBooleanString()
  stats?: string;

  @ApiProperty({ enum: TrendType })
  @IsEnum(TrendType)
  trendType: TrendType;
}
