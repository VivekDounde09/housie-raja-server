import { PaginatedDto } from '@Common';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  WalletTransactionContext,
  WalletTransactionType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsOptional } from 'class-validator';

export class TransactionFilters {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  fromDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  toDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(WalletTransactionContext)
  context?: WalletTransactionContext;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(WalletTransactionType)
  type?: WalletTransactionType;
}

export enum SortOrder {
  Desc = 'desc',
  Asc = 'asc',
}

export class WalletTransactionsQueryDto extends PartialType(PaginatedDto) {
  @ApiPropertyOptional({ type: TransactionFilters })
  @IsOptional()
  @Type(() => TransactionFilters)
  filters?: TransactionFilters;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
