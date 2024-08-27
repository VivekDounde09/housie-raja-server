import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class DeleteGameDto {
  @ApiProperty()
  @IsNumber()
  id: number;
}
