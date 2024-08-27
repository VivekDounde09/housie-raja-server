import { Module } from '@nestjs/common';
import { SheetsService } from './sheets.service';
import { SheetsController } from './sheets.controller';
import { PrismaModule } from 'src/prisma';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [SheetsController],
  providers: [SheetsService],
  exports: [SheetsService],
})
export class SheetsModule {}
