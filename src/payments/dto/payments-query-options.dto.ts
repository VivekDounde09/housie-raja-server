import { PaginatedDto } from '@Common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsDate, IsEnum, IsOptional } from 'class-validator';

export class GetPaymentsOptionsDto extends PaginatedDto {
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
  @IsEnum(Prisma.SortOrder)
  order?: Prisma.SortOrder;
}
