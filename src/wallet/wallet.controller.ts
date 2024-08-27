import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import {
  AccessGuard,
  AuthenticatedRequest,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  UserType,
} from '@Common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WalletTransactionsQueryDto } from './dto';
@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('/me/balance')
  async getMyBalance(@Req() req: AuthenticatedRequest) {
    const userId = BigInt(req.user.id);
    return req.user.type === UserType.Admin
      ? await this.walletService.getBalance(userId, req.user.type)
      : await this.walletService.getBalanceUser(userId, UserType.User);
  }

  @Roles(UserType.User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('me/transactions')
  async getMyTransactions(
    @Query() options: WalletTransactionsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.walletService.getAll(
      options,
      req.user.type === UserType.Admin ? undefined : Number(req.user.id),
    );
  }
}
