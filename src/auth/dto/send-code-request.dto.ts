import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsPhoneNumber } from 'class-validator';

export enum SendCodeRequestType {
  Register = 'register',
  Login = 'login',
}

export class SendCodeRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message:
      'The mobile number you entered is invalid, please provide a valid mobile number',
  })
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    enum: SendCodeRequestType,
    default: SendCodeRequestType.Register,
  })
  @IsEnum(SendCodeRequestType)
  type: SendCodeRequestType;
}
