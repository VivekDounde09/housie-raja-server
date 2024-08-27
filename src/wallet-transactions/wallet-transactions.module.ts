import { Module } from '@nestjs/common';
import { WalletTransactionsService } from './wallet-transactions.service';
import { WalletTransactionsController } from './wallet-transactions.controller';
import { PrismaModule } from 'src/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [WalletTransactionsController],
  providers: [WalletTransactionsService],
  exports: [WalletTransactionsService],
})
export class WalletTransactionsModule {}
