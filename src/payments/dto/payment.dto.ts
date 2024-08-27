import { ApiProperty } from '@nestjs/swagger';
import { PaymentContext, PaymentMode } from '@prisma/client';
import { IsEnum, IsNumber, IsPositive, Min } from 'class-validator';

export class PaymentDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  @IsPositive()
  amount: number;

  @ApiProperty()
  @IsEnum(PaymentContext)
  ctx: PaymentContext;

  @ApiProperty()
  @IsNumber()
  entityId: number;

  @ApiProperty()
  @IsEnum(PaymentMode)
  mode: PaymentMode;

  @ApiProperty()
  @IsNumber()
  purchaseId: number;

  @ApiProperty()
  @IsNumber()
  userId: number;
}
