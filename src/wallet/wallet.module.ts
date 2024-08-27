import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaModule } from 'src/prisma';
import { WalletTransactionsModule } from 'src/wallet-transactions';

@Module({
  imports: [PrismaModule, WalletTransactionsModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
