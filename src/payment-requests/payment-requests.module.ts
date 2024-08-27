import { Module } from '@nestjs/common';
import { PaymentRequestsService } from './payment-requests.service';
import { PaymentRequestsController } from './payment-requests.controller';
import { PrismaModule } from 'src/prisma';
import { WalletModule } from 'src/wallet/wallet.module';

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [PaymentRequestsController],
  providers: [PaymentRequestsService],
})
export class PaymentRequestsModule {}
