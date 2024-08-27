import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as configs from '@Config';
import { validateEnvironmentVariables } from './utils';
import { StorageService, UtilsService } from './providers';
import { JwtStrategy } from './strategies';
import { PrismaModule } from 'src/prisma';

const providers = [StorageService, UtilsService, JwtStrategy];

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: Object.values(configs),
      validate: validateEnvironmentVariables,
    }),
    PrismaModule,
  ],
  providers: providers,
  exports: providers,
})
export class CommonModule {}
