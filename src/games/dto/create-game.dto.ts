import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsPositive,
  Min,
  IsDate,
  ValidationOptions,
  registerDecorator,
  IsArray,
  ArrayNotEmpty,
  IsDefined,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
  IsOptional,
} from 'class-validator';
import { GameModeClaimDto } from './game-mode-claim-prize-map.dto';
import { GameOfferDto } from './game-offer.dto';

export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'isFutureDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!(value instanceof Date)) {
            return false;
          }
          const now = new Date();
          return value > now;
        },
        defaultMessage() {
          return 'Date must be in the future';
        },
      },
    });
  };
}
@ValidatorConstraint({ name: 'customPlayerLimit', async: false })
class CustomPlayerLimit implements ValidatorConstraintInterface {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validate(value: number[], _args: ValidationArguments) {
    if (!Array.isArray(value)) return false;
    if (value.length > 2) return false;
    if (value[0] < 1) return false;
    if (typeof value[0] !== 'number' && typeof value[1] !== 'number')
      return false;
    if (value.some((num) => num < 0)) return false;
    return true;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  defaultMessage(_args: ValidationArguments) {
    return 'playerLimit array must have at most 2 elements, the first element must be 1 or greater, and all elements must be non-negative.';
  }
}

@ValidatorConstraint({ name: 'IsUniqueMode', async: false })
export class IsUniqueMode implements ValidatorConstraintInterface {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validate(modes: any[], args: ValidationArguments) {
    const uniqueModes = new Set(modes.map((mode) => mode.mode));
    return uniqueModes.size === modes.length;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  defaultMessage(args: ValidationArguments) {
    return 'Modes array must contain unique mode values';
  }
}

export class PriceBand {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  @Min(1)
  price: number;

  @ApiProperty()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  dates: Date[];
}

export class CreateGameDto {
  @ApiProperty()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  @IsFutureDate({
    message: 'Start date must be a future date',
  })
  startDate: Date;

  @ApiProperty({ type: [GameModeClaimDto] })
  @Type(() => GameModeClaimDto)
  @IsArray({ message: 'Modes must be an array' })
  @ArrayNotEmpty({ message: 'Modes array should not be empty' })
  @ArrayMinSize(4, { message: 'Modes array must contain at least four modes' })
  @ArrayMaxSize(9, {
    message: 'Modes array must contain nine modes',
  })
  @ValidateNested({ each: true })
  @IsDefined({ each: true, message: 'Each mode must be defined' })
  @Validate(IsUniqueMode, {
    message: 'Modes array must contain unique mode values',
  })
  modes: GameModeClaimDto[];

  // @ApiPropertyOptional()
  // @IsArray({ message: 'offers must be an array' })
  // offers?: number[];

  @ApiProperty({ type: [GameOfferDto] })
  @Type(() => GameOfferDto)
  @IsArray({ message: 'offers must be an array' })
  @ArrayMaxSize(3, {
    message: 'offers array must contain maximum 3 offers',
  })
  @ValidateNested({ each: true })
  offers?: GameOfferDto[];

  @ApiProperty()
  @IsArray()
  @ArrayMaxSize(2)
  @Validate(CustomPlayerLimit)
  playerLimit: number[];

  @ApiProperty()
  @IsPositive()
  @IsNumber()
  @Min(1)
  purchaseLimit: number;

  @ApiProperty()
  @IsPositive()
  @IsNumber()
  @Min(1)
  price: number;

  @ApiPropertyOptional({ type: [PriceBand] })
  @IsOptional()
  @Type(() => PriceBand)
  priceBand?: PriceBand[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  purchaseStopsAt?: Date;
}
