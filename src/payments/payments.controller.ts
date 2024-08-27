import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { GetPaymentsOptionsDto, PaymentDto } from './dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AccessGuard,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  UserType,
} from '@Common';
@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles(UserType.User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('pay')
  async pay(@Body() paymentDto: PaymentDto) {
    return await this.paymentsService.createPayment(paymentDto);
  }

  @Roles(UserType.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async getAllPayments(@Query() options: GetPaymentsOptionsDto) {
    return await this.paymentsService.getAllPayments(options);
  }

  @Roles(UserType.Admin, UserType.User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':userId')
  async getUserAllPayments(
    @Query() options: GetPaymentsOptionsDto,
    @Param('userId', new ParseIntPipe()) id: number,
  ) {
    return await this.paymentsService.getAllPayments({
      userId: BigInt(id),
      ...options,
    });
  }
}
