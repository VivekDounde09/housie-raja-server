import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma';
import { OtpModule } from '../otp';
import { WalletModule } from 'src/wallet/wallet.module';
import { SystemModule } from 'src/system';

@Module({
  imports: [PrismaModule, OtpModule, WalletModule, SystemModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
