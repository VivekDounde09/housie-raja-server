import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AccessGuard,
  AuthenticatedRequest,
  JwtAuthGuard,
  PaginatedDto,
  Roles,
  RolesGuard,
  UserType,
} from '@Common';
import {
  CreateGameDto,
  GameOfferDto,
  GetGamesQueryOptionsDto,
  UpdateGameDto,
  UpdateGameOfferDto,
} from './dto';
import { GetGamesByTimeQueryDto } from './dto/game-search-params.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
// import { Cron, CronExpression } from '@nestjs/schedule';

@ApiTags('Games')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Roles(UserType.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async newGame(@Body() createGameDto: CreateGameDto) {
    return await this.gamesService.createGame(createGameDto);
  }

  @Roles(UserType.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('offer')
  async newOffer(@Body() gameOfferDto: GameOfferDto) {
    return await this.gamesService.createOffer(gameOfferDto);
  }

  @Get('/modes')
  getModes() {
    return this.gamesService.getModes();
  }

  @Get('/offer-types')
  getOfferTypes() {
    return this.gamesService.getOfferTypes();
  }

  @Get('/offers')
  getOffers() {
    return this.gamesService.getOffers();
  }

  @Get()
  async getGames(@Query() query: GetGamesQueryOptionsDto) {
    return await this.gamesService.getAllGames(query);
  }

  @Get('by-time')
  async getGamesByTime(@Query() query: GetGamesByTimeQueryDto) {
    return await this.gamesService.getGamesGroupedByTime({
      from: query.from,
      to: query.to,
      searchParams: {
        date: query.date,
        month: query.month,
        time: query.time,
      },
    });
  }

  @Get('by-time-init')
  async getGamesByTimeInit() {
    return await this.gamesService.getFormattedGameData({});
  }

  @Get('all')
  async getGamesAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetGamesQueryOptionsDto,
  ) {
    return await this.gamesService.getAllGamesApp(query, false);
  }

  @Get('available')
  async getGamesAllAvailable(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetGamesQueryOptionsDto,
  ) {
    return await this.gamesService.getAllGamesApp(
      query,
      true,
      Number(req.user.id),
    );
  }

  @Get('me/entries')
  async getMyActiveEntries(
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginatedDto,
  ) {
    return await this.gamesService.getActiveEntries(query, Number(req.user.id));
  }

  @Get('bumper')
  async getBumperGame() {
    return await this.gamesService.getBumperPrizeGame();
  }

  @Get('live')
  async getLiveGame() {
    return await this.gamesService.getActiveGameApp();
  }

  @Get(':id')
  async getGame(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseIntPipe()) id: number,
  ) {
    return await this.gamesService.getGame(BigInt(id), req.user.type);
  }

  @Get('start-time/:id')
  async getGameStartTime(@Param('id', new ParseIntPipe()) id: number) {
    return await this.gamesService.getGameStartTimeById(BigInt(id));
  }

  @Get('numbers/:id')
  async getGameDealtNumbers(@Param('id', new ParseIntPipe()) id: number) {
    return await this.gamesService.getGameDealtNumbers(BigInt(id));
  }

  @Get('/hall-of-fame/:id')
  async getHallFame(@Param('id', new ParseIntPipe()) id: number) {
    return this.gamesService.getHallOfFame(id);
  }

  @Roles(UserType.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('game/start/:id')
  async startGame(@Param('id', new ParseIntPipe()) id: number) {
    return await this.gamesService.startGame(id);
  }

  @Roles(UserType.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('game/stop/:id')
  async stopGame(@Param('id', new ParseIntPipe()) id: number) {
    return await this.gamesService.stopGame(id);
  }

  // end game
  @Roles(UserType.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('game/end/:id')
  async endGame(@Param('id', new ParseIntPipe()) id: number) {
    return await this.gamesService.endGame(BigInt(id));
  }

  @Patch('offer')
  async editOffer(@Body() updateGameOfferDto: UpdateGameOfferDto) {
    return await this.gamesService.updateOffer({
      ...updateGameOfferDto,
    });
  }

  @Patch(':id')
  async editGame(
    @Body() updateGameDto: UpdateGameDto,
    @Param('id', new ParseIntPipe()) id: number,
  ) {
    return await this.gamesService.updateGameDetails({ id, ...updateGameDto });
  }

  @Delete(':id')
  async deleteGame(@Param('id', new ParseIntPipe()) id: number) {
    return await this.gamesService.deleteGame(BigInt(id));
  }

  @Delete('offer/:id')
  async deleteOffer(@Param('id', new ParseIntPipe()) id: number) {
    return await this.gamesService.deleteOffer(id);
  }

  // @Cron(CronExpression.EVERY_SECOND)
  // async resumeGames() {
  //   await this.gamesService.resumeGamesHandle();
  // }

  // @Cron(CronExpression.EVERY_SECOND)
  // async emitSecondsUntilNext() {
  //   await this.gamesService.emitSecondsUntilNextHandle();
  // }

  // @Cron(CronExpression.EVERY_MINUTE)
  // async updatePriceBand() {
  //   await this.gamesService.updatePricesHandler();
  // }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanAbandonedGames() {
    await this.gamesService.GamesCleanerHandle();
  }
}
