import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AccessGuard,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  UserType,
} from '@Common';
import { BusinessService } from './business.service';
import { BusinessQueryDto } from './dto';

@ApiTags('Business')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Roles(UserType.Business)
  @UseGuards(RolesGuard)
  @Get()
  async getBusinessAnalytics(@Query() data: BusinessQueryDto) {
    return await this.businessService.getBusinessAnalytics({
      stats: data.stats === 'true',
      trends: { type: data.trendType },
    });
  }
}
