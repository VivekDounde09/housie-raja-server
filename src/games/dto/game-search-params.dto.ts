import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';

export class GetGamesByTimeQueryDto {
  @ApiPropertyOptional({
    description: 'Start date in ISO format (e.g., 2024-07-01T00:00:00.000Z)',
    required: false,
    type: String,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({
    description: 'End date in ISO format (e.g., 2024-07-31T23:59:59.999Z)',
    required: false,
    type: String,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({
    description: 'Month in the format YYYY-MM',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional({
    description: 'Date in the format YYYY-MM-DD',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Time in the format HH:MM',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  time?: string;
}
