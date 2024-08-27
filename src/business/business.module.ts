import { Module } from '@nestjs/common';
import { BusinessService } from './business.service';
import { PrismaModule } from 'src/prisma';
import { BusinessController } from './business.controller';

@Module({
  controllers: [BusinessController],
  imports: [PrismaModule],
  providers: [BusinessService],
})
export class BusinessModule {}
