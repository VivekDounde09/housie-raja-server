import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  NotFoundException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PaymentRequestsService } from './payment-requests.service';
import {
  EditPaymentRequestDto,
  GetPaymentRequestsQueryOptionsDto,
  NewPaymentRequestDto,
} from './dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AccessGuard,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  UserType,
} from '@Common';

@ApiTags('payment-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('payment-requests')
export class PaymentRequestsController {
  constructor(
    private readonly paymentRequestsService: PaymentRequestsService,
  ) {}

  @Roles(UserType.User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPaymentRequest(
    @Body()
    body: NewPaymentRequestDto,
  ) {
    return await this.paymentRequestsService.createPaymentRequest(body);
  }

  @Get()
  async getAllPaymentRequests(
    @Query('type') options: GetPaymentRequestsQueryOptionsDto,
  ) {
    return this.paymentRequestsService.getAllPaymentRequests(options);
  }

  @Get(':id')
  async getPaymentRequestById(@Param('id', ParseIntPipe) id: number) {
    const paymentRequest =
      await this.paymentRequestsService.getPaymentRequestById(id);
    if (!paymentRequest) {
      throw new NotFoundException(`PaymentRequest with ID ${id} not found`);
    }
    return paymentRequest;
  }

  @Roles(UserType.Admin, UserType.User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put(':id')
  async updatePaymentRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: EditPaymentRequestDto,
  ) {
    const updatedPaymentRequest =
      await this.paymentRequestsService.updatePaymentRequest(id, body);
    if (!updatedPaymentRequest) {
      throw new NotFoundException(`PaymentRequest with ID ${id} not found`);
    }
    return updatedPaymentRequest;
  }

  @Roles(UserType.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  async deletePaymentRequest(@Param('id', ParseIntPipe) id: number) {
    const deleted = await this.paymentRequestsService.deletePaymentRequest(id);
    if (!deleted) {
      throw new NotFoundException(`PaymentRequest with ID ${id} not found`);
    }
    return { message: `PaymentRequest with ID ${id} deleted successfully` };
  }
}
