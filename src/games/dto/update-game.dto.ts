import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { CreateGameDto, IsUniqueMode } from './create-game.dto';
import { UpdateGameOfferDto } from './game-offer.dto';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBooleanString,
  IsDefined,
  IsOptional,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GameModeClaimDto } from './game-mode-claim-prize-map.dto';

class CreateGameDtoWithoutOffers extends OmitType(CreateGameDto, [
  'offers',
] as const) {}
export class UpdateGameDto extends PartialType(CreateGameDtoWithoutOffers) {
  @ApiPropertyOptional({ type: [UpdateGameOfferDto] })
  @IsOptional()
  @Type(() => UpdateGameOfferDto)
  @IsArray({ message: 'offers must be an array' })
  @ArrayMaxSize(3, {
    message: 'offers array must contain maximum 3 offers',
  })
  @ValidateNested({ each: true })
  offers?: UpdateGameOfferDto[];

  @ApiPropertyOptional({ type: [GameModeClaimDto] })
  @IsOptional()
  @Type(() => GameModeClaimDto)
  @IsArray({ message: 'Modes must be an array' })
  @ArrayNotEmpty({ message: 'Modes array should not be empty' })
  @ArrayMinSize(1, { message: 'Modes array must contain at least one mode' })
  @ArrayMaxSize(7, {
    message: 'Modes array must contain seven modes',
  })
  @ValidateNested({ each: true })
  @IsDefined({ each: true, message: 'Each mode must be defined' })
  @Validate(IsUniqueMode, {
    message: 'Modes array must contain unique mode values',
  })
  modes?: GameModeClaimDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  isSoldOut?: string;
}

// import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
// import { CreateGameDto } from './create-game.dto';
// import {
//   ArrayMaxSize,
//   ArrayMinSize,
//   ArrayNotEmpty,
//   IsArray,
//   IsBooleanString,
//   IsDefined,
//   IsOptional,
//   ValidateNested,
// } from 'class-validator';
// import { Type } from 'class-transformer';
// import { GameModeClaimDto } from './game-mode-claim-prize-map.dto';

// export class UpdateGameDto extends PartialType(CreateGameDto) {
//   @ApiPropertyOptional({ type: [GameModeClaimDto] })
//   @IsOptional()
//   @Type(() => GameModeClaimDto)
//   @IsArray({ message: 'Modes must be an array' })
//   @ArrayNotEmpty({ message: 'Modes array should not be empty' })
//   @ArrayMinSize(1, { message: 'Modes array must contain at least one mode' })
//   @ArrayMaxSize(9, {
//     message: 'Modes array must contain nine modes',
//   })
//   @ValidateNested({ each: true })
//   @IsDefined({ each: true, message: 'Each mode must be defined' })
//   modes?: GameModeClaimDto[];

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsBooleanString()
//   isActive?: string;

//   @ApiPropertyOptional()
//   @IsOptional()
//   @IsBooleanString()
//   isSoldOut?: string;
// }
