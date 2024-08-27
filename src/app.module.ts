import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { CommonModule, StorageService } from '@Common';
import { AppController } from './app.controller';
import { AppCacheInterceptor } from './app-cache.interceptor';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth';
import { RedisModule } from './redis';
import { SeedService } from './seed';
import { GamesModule } from './games';
import { GameGateway, GamesGatewayModule } from './gateways';
import { SheetsModule } from './sheets/sheets.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletModule } from './wallet/wallet.module';
import { WalletTransactionsModule } from './wallet-transactions/wallet-transactions.module';
import { BusinessModule } from './business/business.module';
import { PaymentRequestsModule } from './payment-requests/payment-requests.module';

@Module({
  imports: [
    MulterModule.registerAsync({
      useFactory: (storageService: StorageService) => ({
        ...storageService.defaultMulterOptions,
      }),
      inject: [StorageService],
    }),
    CacheModule.register({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    CommonModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    GamesModule,
    GamesGatewayModule,
    SheetsModule,
    PaymentsModule,
    WalletModule,
    WalletTransactionsModule,
    BusinessModule,
    PaymentRequestsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AppCacheInterceptor,
    },
    SeedService,
    GameGateway,
  ],
})
export class AppModule {}
