import { ApiProperty } from '@nestjs/swagger';
import { PaymentRequestType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
} from 'class-validator';

export class NewPaymentRequestDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty()
  @IsEnum(PaymentRequestType)
  type: PaymentRequestType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  utr: string;

  @ApiProperty()
  @IsNumber()
  userId: number;
}
