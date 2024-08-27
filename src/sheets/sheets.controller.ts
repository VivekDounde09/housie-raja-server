import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SheetsService } from './sheets.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BuySheetRequest } from './dto';
import {
  AccessGuard,
  AuthenticatedRequest,
  JwtAuthGuard,
  PaginatedDto,
  Roles,
  RolesGuard,
  UserType,
} from '@Common';

@ApiTags('Sheets')
@ApiBearerAuth()
@Controller('sheets')
export class SheetsController {
  constructor(private readonly sheetsService: SheetsService) {}

  @Post('new/:count')
  async reqNewSheet(@Param('count', new ParseIntPipe()) count: number) {
    return await this.sheetsService.getNewSheet(count);
  }

  @Roles(UserType.User)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('buy/:count')
  async reqAndPurchaseNewSheet(
    @Req() req: AuthenticatedRequest,
    @Body() data: BuySheetRequest,
  ) {
    return await this.sheetsService.generateAndBuySheet({
      count: data.count,
      gameId: data.gameId,
      offerId: data.offerId,
      userId: Number(req.user.id),
    });
  }

  @Post('new/house/:id')
  async reqNewSheetHouse(@Param('id', new ParseIntPipe()) id: number) {
    return await this.sheetsService.getGameHouseSheets(id);
  }

  @Roles(UserType.User)
  @UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
  @Get('me')
  async getMySheets(
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginatedDto,
  ) {
    const userId = BigInt(req.user.id);
    return await this.sheetsService.getUserSheets(userId, query);
  }

  @Roles(UserType.User)
  @UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
  @Get(':gameId')
  async getGameSheets(
    @Req() req: AuthenticatedRequest,
    @Param('gameId', new ParseIntPipe()) id: number,
  ) {
    const userId = BigInt(req.user.id);
    return await this.sheetsService.getUserGameSheets(BigInt(id), userId);
  }
}
