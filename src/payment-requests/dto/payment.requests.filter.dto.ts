import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsEnum, IsDate } from 'class-validator';
import { PaginatedDto } from '@Common';
import { PaymentRequestStatus, PaymentRequestType } from '@prisma/client';
import { Type } from 'class-transformer';

export class GetPaymentRequestsQueryOptionsDto extends PaginatedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(PaymentRequestType)
  type: PaymentRequestType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(PaymentRequestStatus)
  status: PaymentRequestStatus;

  @ApiPropertyOptional({
    description: 'date in ISO format (e.g., 2024-07-01T00:00:00.000Z)',
    required: false,
    type: String,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({
    description: 'date in ISO format (e.g., 2024-07-31T23:59:59.999Z)',
    required: false,
    type: String,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
