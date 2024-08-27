import { Controller } from '@nestjs/common';
import { WalletTransactionsService } from './wallet-transactions.service';

@Controller('wallet-transactions')
export class WalletTransactionsController {
  constructor(
    private readonly walletTransactionsService: WalletTransactionsService,
  ) {}
}
