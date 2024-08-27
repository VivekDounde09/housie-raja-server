import { UtilsService } from '@Common';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma';
import { BusinessStatsType, BusinessTrends, TrendType } from './dto';

@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utilsService: UtilsService,
  ) {}

  async getBusinessAnalytics(query: {
    stats?: boolean;
    trends?: {
      type: TrendType;
    };
  }) {
    if (!Object.values(query).filter(Boolean).length) {
      throw new BadRequestException('No query params provided');
    }
    if (query.stats) {
      const stats: BusinessStatsType = {
        totalActiveGames: 0,
        totalActiveUsers: 0,
        totalCollection: 0,
        totalGames: 0,
        totalProfit: 0,
        totalUsers: 0,
        walletBalance: 0,
      };
      let {
        totalActiveGames,
        totalActiveUsers,
        totalCollection,
        totalGames,
        totalProfit,
        totalUsers,
        walletBalance,
      } = stats;

      totalActiveGames = await this.prisma.game.count({
        where: {
          isActive: true,
          isDeleted: false,
          isEnded: false,
        },
      });

      totalGames = await this.prisma.game.count({
        where: { isDeleted: false },
      });

      totalUsers = await this.prisma.user.count({
        where: { isDeleted: false, isBot: false },
      });

      totalActiveUsers = await this.prisma.user.count({
        where: { isDeleted: false, isBot: false, status: 'Active' },
      });

      totalCollection = await this.prisma.game
        .aggregate({
          _sum: {
            collection: true,
          },
        })
        .then((data) => Number(data._sum.collection || 0));

      walletBalance = await this.prisma.adminWallet
        .findFirst({
          select: {
            amount: true,
          },
        })
        .then((data) => Number(data?.amount || 0));

      // TODO
      totalProfit = await this.prisma.sheetPurchase
        .aggregate({
          where: {},
          _sum: {
            total: true,
          },
        })
        .then((data) => Number(data._sum.total || 0));

      Object.assign(stats, {
        totalActiveGames,
        totalActiveUsers,
        totalCollection,
        totalGames,
        totalProfit,
        totalUsers,
        walletBalance,
      });
      return stats;
    } else {
      const trends: BusinessTrends = {
        prizePool: [],
        sheetPrice: [],
        weekly: [],
      };
      let { prizePool, sheetPrice, weekly } = trends;
      if (query.trends?.type === 'prizePool') {
        prizePool = await this.getPoolPrizeTrends();
        return prizePool;
      } else if (query.trends?.type === 'weekly') {
        weekly = await this.getWeeklyTrends();
        return weekly;
      } else {
        sheetPrice = await this.getSheetPriceTrends();
        return sheetPrice;
      }
      //   return Object.assign(trends, {
      //     prizePool,
      //     sheetPrice,
      //     weekly,
      //   }) as BusinessTrends;
    }
  }

  async getWeeklyTrends() {
    const { currentWeek } = this.utilsService.getCurrentWeekAndLastWeekDates();
    const [weekStart] = currentWeek;
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      return date;
    });
    const getDayName = (date: Date) => {
      const days = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      return days[date.getDay()];
    };
    const dailyData = await Promise.all(
      weekDays.map(async (day) => {
        const startOfDay = new Date(day);
        startOfDay.setHours(0, 0, 0, 0); // Set to start of day
        const endOfDay = new Date(day);
        endOfDay.setHours(23, 59, 59, 999); // Set to end of day

        const result = await this.prisma.sheetPurchase
          .findMany({
            where: {
              createdAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
            select: {
              sheets: {
                select: {
                  _count: true,
                },
              },
            },
          })
          .then((data) => {
            return data.map((i) => i.sheets.length);
          })
          .then((data) => {
            return data.reduce((a, b) => a + b, 0);
          });

        return {
          day: getDayName(day), // Get the name of the day
          total: result,
        };
      }),
    );
    return dailyData;
  }

  async getPoolPrizeTrends() {
    const games = await this.prisma.game.findMany({
      select: {
        id: true,
        poolPrize: true,
      },
    });

    // Using string keys to store Decimal values
    const groupedGames = games.reduce(
      (acc, game) => {
        const prizeKey = game.poolPrize.toString(); // Convert Decimal to string

        if (!acc[prizeKey]) {
          acc[prizeKey] = {
            prize: game.poolPrize,
            games: [],
          };
        }
        acc[prizeKey].games.push(Number(game.id));
        return acc;
      },
      {} as Record<string, { prize: Decimal; games: number[] }>,
    );

    // Converting the keys back to Decimal if needed
    const result = Object.values(groupedGames).map((group) => ({
      prize: new Decimal(group.prize), // Convert back to Decimal if necessary
      games: group.games,
    }));

    const trends = await Promise.all(
      result.map(async (res) => {
        const { games, prize } = res;
        const c = await Promise.all(
          games.map(async (gameId) => {
            return await this.getGameSheetCount(gameId);
          }),
        );
        return {
          prize,
          count: c.reduce((a, b) => a + b, 0),
        };
      }),
    );
    return trends;
  }

  async getSheetPriceTrends() {
    const games = await this.prisma.game.findMany({
      select: {
        id: true,
        price: true,
      },
    });

    // Using string keys to store Decimal values
    const groupedGames = games.reduce(
      (acc, game) => {
        const prizeKey = game.price.toString(); // Convert Decimal to string

        if (!acc[prizeKey]) {
          acc[prizeKey] = {
            prize: game.price,
            games: [],
          };
        }
        acc[prizeKey].games.push(Number(game.id));
        return acc;
      },
      {} as Record<string, { prize: Decimal; games: number[] }>,
    );

    // Converting the keys back to Decimal if needed
    const result = Object.values(groupedGames).map((group) => ({
      prize: new Decimal(group.prize), // Convert back to Decimal if necessary
      games: group.games,
    }));

    const trends = await Promise.all(
      result.map(async (res) => {
        const { games, prize } = res;
        const c = await Promise.all(
          games.map(async (gameId) => {
            return await this.getGameSheetCount(gameId);
          }),
        );
        return {
          prize,
          count: c.reduce((a, b) => a + b, 0),
        };
      }),
    );
    return trends;
  }

  async getGameSheetCount(id: number) {
    const count = await this.prisma.sheet.count({
      where: {
        gameId: id,
      },
    });
    return count;
  }
}
