import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentRequestStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';

export class EditPaymentRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(PaymentRequestStatus)
  status?: PaymentRequestStatus;

  @ApiProperty()
  @IsNumber()
  userId: number;
}
