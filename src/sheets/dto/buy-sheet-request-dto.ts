import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
export class RowClass {
  @ApiProperty({ type: Number, isArray: true })
  @IsNumber({}, { each: true })
  @ArrayMinSize(9)
  row: number[];
}

export class MatrixClass {
  @ApiProperty({ type: RowClass, isArray: true })
  @ValidateNested({ each: true })
  @Type(() => RowClass)
  @ArrayMinSize(3)
  matrix: RowClass[];
}

export class SheetClass {
  @ApiProperty({ type: MatrixClass, isArray: true })
  @ValidateNested({ each: true })
  @Type(() => MatrixClass)
  @ArrayMinSize(6)
  sheet: MatrixClass[];

  @ApiProperty()
  @IsString()
  uid: string;
}

export class BuySheetRequest {
  // @ApiProperty({ type: [SheetClass], description: 'Array of sheets to buy' })
  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => SheetClass)
  // sheets: SheetClass[];

  @ApiProperty()
  @IsNumber()
  gameId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  offerId?: number;

  @ApiProperty()
  @Min(1)
  @IsNumber()
  count: number;
}
