import { ApiProperty } from '@nestjs/swagger';
import { ClaimType } from '@prisma/client';
import { IsEnum, IsNumber, IsPositive, Min } from 'class-validator';

export class GameModeClaimDto {
  @ApiProperty()
  @IsEnum(ClaimType)
  mode: ClaimType;

  @ApiProperty()
  @IsNumber()
  @IsPositive({
    message: 'amount must be a positive number',
  })
  @Min(0, {
    message: 'amount must be non-negative',
  })
  amount: number;
}
