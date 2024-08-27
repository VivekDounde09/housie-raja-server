import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginatedDto {
  @ApiPropertyOptional({
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Max(1000)
  take?: number;
}
