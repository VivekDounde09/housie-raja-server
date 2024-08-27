import { Decimal } from '@prisma/client/runtime/library';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { ClaimType, Offers, OfferType, Prisma } from '@prisma/client';
import { GetGamesQueryOptionsDto, PriceBand } from './dto';
import { UserType, UtilsService } from '@Common';
import { SheetsService } from 'src/sheets';
import { EventEmitter2 } from '@nestjs/event-emitter';
import _ from 'lodash';
import { EmptyObject } from 'type-fest';

@Injectable()
export class GamesService
  implements OnApplicationShutdown, OnApplicationBootstrap
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly utilsService: UtilsService,
    private readonly sheetService: SheetsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onApplicationBootstrap() {
    await this.resumeGamesHandle();
  }

  async onApplicationShutdown(signal?: string) {
    console.log({ signal });
    const gameIds = await this.getActiveGame();
    if (gameIds.length) {
      for (let i = 0; i < gameIds.length; i++) {
        const id = gameIds[i];
        const update = await this.prisma
          .$executeRaw`UPDATE public.games SET resumable=${true} WHERE id=${id} AND is_started=${true} AND "isEnded"=${false};`;
        console.log({ update });
      }
    }
  }

  async delay(ms: number) {
    await this.utilsService.sleep(ms);
  }

  getSeconds(date: Date, nth: number) {
    return this.utilsService.getNthDateTime(date, nth);
  }

  getModes(): ClaimType[] {
    return [
      ClaimType.Early7,
      ClaimType.Early10,
      ClaimType.Corners,
      ClaimType.Bottom,
      ClaimType.House,
      ClaimType.Middle,
      ClaimType.Top,
      ClaimType.House1,
      ClaimType.House2,
    ];
  }

  getOfferTypes(): OfferType[] {
    return [OfferType.BuyGet, OfferType.Discount];
  }

  async getOffers() {
    const offers = await this.prisma.offers.findMany({
      orderBy: {
        id: 'desc',
      },
    });
    return this.getActiveOffers(offers);
  }

  async getHallOfFame(id: number) {
    const game = await this.getGameById(BigInt(id));

    // Fetch prize information
    const prizes = await this.prisma.claimPrizeMap.findMany({
      where: { gameId: id },
      select: {
        type: true,
        amount: true,
      },
    });

    // Fetch valid claims
    const claims = await this.prisma.claim.findMany({
      where: {
        isValid: true,
        gameId: game.id,
      },
      select: {
        Ticket: {
          select: {
            id: true,
          },
        },
        type: true,
      },
    });

    // Define the claim types
    const types: ClaimType[] = [
      ClaimType.Bottom,
      ClaimType.Corners,
      ClaimType.Early10,
      ClaimType.Early7,
      ClaimType.House,
      ClaimType.House1,
      ClaimType.House2,
      ClaimType.Middle,
      ClaimType.Top,
    ];

    // Initialize the result object with default values
    const result: Record<ClaimType, { price: number; id: bigint }> =
      types.reduce(
        (acc, type) => {
          acc[type] = { price: 0, id: BigInt(0) };
          return acc;
        },
        {} as Record<ClaimType, { price: number; id: bigint }>,
      );
    // Map prize information to claim types
    const prizeMap = new Map<ClaimType, number>();
    prizes.forEach((prize) => {
      prizeMap.set(prize.type, Number(prize.amount));
    });
    // Populate the result object with claim data
    if (claims.length) {
      claims.forEach((claim) => {
        const claimType = claim.type;
        if (!result[claimType].id) {
          result[claimType] = {
            price: prizeMap.get(claimType) || 0,
            id: claim?.Ticket?.id || BigInt(0),
          };
        }
      });
    } else {
      types.forEach((claim) => {
        const claimType = claim;
        result[claimType] = {
          price: prizeMap.get(claimType) || 0,
          id: BigInt(0),
        };
      });
    }

    return result;
  }

  async getActiveOffer(id: bigint) {
    const offer = await this.prisma.offers.findFirst({
      where: {
        gameId: id,
        isActive: true,
      },
    });
    return offer;
  }

  private getActiveOffers(_offers: Offers[]) {
    let offers: {
      id: bigint;
      type: OfferType;
      buy?: number | null;
      get?: number | null;
      discount?: number | null;
      isActive: boolean;
    }[] = [];
    if (_offers.length) {
      offers = _offers.map((offer) => {
        if (offer.type == 'BuyGet') {
          return {
            id: offer.id,
            type: offer.type,
            buy: offer.buy,
            get: offer.get,
            isActive: offer.isActive,
          };
        }
        if (offer.type === 'Discount') {
          return {
            id: offer.id,
            discount: offer.discount,
            type: offer.type,
            isActive: offer.isActive,
          };
        }
        if (offer.type == 'Free') {
          return {
            id: offer.id,
            type: offer.type,
            isActive: offer.isActive,
          };
        }
        return offer;
      });
    }
    return offers;
  }

  // private validOfferPayload(
  //   offers: {
  //     type: OfferType;
  //     buy?: number;
  //     get?: number;
  //     discount?: number;
  //     isActive: boolean;
  //   }[],
  // ) {
  //   if (offers) {
  //     const _offers = offers.map((o) => o.type);
  //     const _uqoffers = [...new Set(_offers)] as typeof _offers;

  //     if (_offers.length !== _uqoffers.length) {
  //       throw new BadRequestException('Offers can not be duplicate');
  //     }
  //     const active = offers.filter((o) => o.isActive);
  //     if (active.length > 1) {
  //       throw new BadRequestException(
  //         'Only one offer can be applied at a time',
  //       );
  //     }
  //   }
  // }

  async getUser(id: number) {
    return await this.prisma.user.findUnique({
      where: { id },
      select: {
        fullname: true,
      },
    });
  }

  async joinGameUser(data: { gameId: number; userId: number }) {
    await this.prisma.joinGame.update({
      where: {
        userId_gameId: {
          gameId: data.gameId,
          userId: data.userId,
        },
      },
      data: {
        joined_at: new Date(),
        joined: true,
      },
    });
    return true;
  }

  async createOffer(data: {
    type: OfferType;
    buy?: number;
    get?: number;
    discount?: number;
    isActive: boolean;
  }) {
    await this.prisma.offers.create({ data: { ...data } });
    return 'Offer created successfully';
  }

  async createGame(data: {
    startDate: Date;
    purchaseLimit: number;
    price: number;
    modes: {
      mode: ClaimType;
      amount: number;
    }[];
    // offers?: number[];
    offers?: {
      type: OfferType;
      buy?: number;
      get?: number;
      discount?: number;
      isActive: boolean;
    }[];
    playerLimit: number[];
    priceBand?: {
      price: number;
      dates: Date[];
    }[];
    purchaseStopsAt?: Date;
  }) {
    const {
      startDate,
      modes,
      offers,
      playerLimit,
      price,
      purchaseLimit,
      priceBand,
      purchaseStopsAt,
    } = data;
    const numbers = this.utilsService.getRandomUniqueNumbers();
    const poolPrize = modes.map((m) => m.amount).reduce((x, y) => x + y, 0);
    const _purchaseStopsAt = purchaseStopsAt
      ? new Date(purchaseStopsAt)
      : undefined;
    const _startDate = new Date(startDate);
    // if (!(await this.isWindowAvailable(_startDate))) {
    //   throw new BadRequestException(
    //     'Can not create a game unless last scheduled ends',
    //   );
    // }
    try {
      console.log({ n: numbers.join(',') });
      await this.prisma.$transaction(async (tx) => {
        const game = await tx.game.create({
          data: {
            poolPrize: poolPrize,
            startDate: _startDate,
            purchaseStopsAt: _purchaseStopsAt,
            collection: 0,
            playerLimit,
            purchaseLimit,
            price: new Decimal(price),
            priceBand: priceBand,
            numbers: numbers.join(','),
            settings: {
              create: {
                delay: 45000,
              },
            },
          },
        });
        if (game && modes) {
          await Promise.all(
            modes.map(async (mode) => {
              await tx.claimPrizeMap.create({
                data: {
                  amount: mode.amount,
                  type: mode.mode,
                  gameId: game.id,
                },
              });
            }),
          );
        }
        if (game && offers) {
          await Promise.all(
            offers.map(async (offer) => {
              await tx.offers.create({
                data: {
                  ...offer,
                  gameId: game.id,
                },
              });
            }),
          );
        }
        // if (game && offers) {
        //   await Promise.all(
        //     offers.map(async (offer) => {
        //       await tx.offers.update({
        //         where: {
        //           id: offer,
        //         },
        //         data: {
        //           games: {
        //             connect: { id: game.id },
        //           },
        //         },
        //       });
        //     }),
        //   );
        // }
      });
    } catch (error) {
      throw error;
    }
    return 'Game Created successfully';
  }

  async getGameStartTimeById(id: bigint) {
    const game = await this.prisma.game.findUnique({
      where: { id, isDeleted: false },
      select: {
        id: true,
        startDate: true,
        isStarted: true,
      },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return game;
  }

  async getGame(id: bigint, type: UserType = UserType.Admin) {
    if (type === UserType.Admin) {
      return await this.getGameById(id);
    } else {
      const game = await this.prisma.game.findUnique({
        where: { id, isDeleted: false },
        select: {
          id: true,
          poolPrize: true,
          isActive: true,
          startDate: true,
          createdAt: true,
          isStarted: true,
          isEnded: true,
          claimPrizeMap: {
            select: {
              type: true,
              amount: true,
            },
          },
          offers: true,
          isSoldOut: true,
          price: true,
          priceBand: true,
          purchaseStopsAt: true,
        },
      });
      return game
        ? Object.assign(game, {
            isRunning: game.isStarted && !game.isEnded,
          })
        : null;
    }
  }

  async getGameById(id: bigint) {
    const game = await this.prisma.game.findUnique({
      where: { id, isDeleted: false },
      select: {
        id: true,
        poolPrize: true,
        isActive: true,
        startDate: true,
        createdAt: true,
        updatedAt: true,
        isStarted: true,
        isEnded: true,
        dealt_numbers: true,
        claimPrizeMap: {
          select: {
            type: true,
            amount: true,
          },
        },
        offers: true,
        isSoldOut: true,
        playerLimit: true,
        collection: true,
        purchaseLimit: true,
        price: true,
        settings: {
          select: {
            delay: true,
          },
        },
        numbers: true,
        startedAt: true,
        priceBand: true,
        purchaseStopsAt: true,
      },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    const offers: {
      id: bigint;
      type: OfferType;
      buy?: number | null;
      get?: number | null;
      discount?: number | null;
      isActive: boolean;
    }[] = this.getActiveOffers(game.offers);
    const soldSheets = await this.getTotalSoldSheetCount(Number(game.id));
    return Object.assign(game, { offers, soldSheets });
  }

  async getGameDealtNumbers(id: bigint) {
    const game = await this.prisma.game.findUnique({
      where: { id, isDeleted: false },
      select: {
        dealt_numbers: true,
      },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return game.dealt_numbers;
  }

  async isGameExists(id: bigint) {
    const game = await this.prisma.game.count({
      where: { id, isDeleted: false },
    });
    return game > 0;
  }

  async isWindowAvailable(start: Date) {
    const count = await this.prisma.$queryRaw<
      { id: number }[]
    >`SELECT id FROM public.games WHERE start_date<=${start} AND "isDeleted"=false AND "isEnded"=false;`;
    return !Boolean(count.length);
  }

  async getTotalSoldSheetCount(gameId: number) {
    return await this.prisma.sheet.count({
      where: {
        gameId,
        isPaid: true,
        isDeleted: false,
      },
    });
  }

  async getFormattedGameData(data: {
    from?: Date;
    to?: Date;
    searchParams?: {
      month?: string;
      date?: string;
      time?: string;
    };
  }) {
    const games = await this.getGamesGroupedByTime(data);
    const transformData = (data: any) => {
      const result: { [month: string]: { [date: string]: string[] } } = {};

      Object.entries(data).forEach(([month, monthData]) => {
        result[month] = {};
        Object.entries(monthData as EmptyObject).forEach(
          ([date, dateData]: [any, any]) => {
            result[month][date] = Object.keys(dateData.games);
          },
        );
      });

      return result;
    };
    return transformData(games);
  }

  async getGamesGroupedByTime(data: {
    from?: Date;
    to?: Date;
    searchParams?: {
      month?: string;
      date?: string;
      time?: string;
    };
  }) {
    const { from, searchParams, to } = data;
    let query = Prisma.sql`SELECT id, start_date as "startDate", pool_prize as "poolPrize", collection FROM public.games`;
    if (from && to) {
      query = Prisma.sql`SELECT id, start_date as "startDate", pool_prize as "poolPrize", collection FROM public.games WHERE start_date BETWEEN ${from} AND ${to};`;
    }
    if (searchParams) {
      if (searchParams.month) {
        query = Prisma.sql`${query} WHERE TO_CHAR(start_date, 'YYYY-MM') = ${searchParams.month}`;
      }
      if (searchParams.date) {
        query = Prisma.sql`${query} AND TO_CHAR(start_date, 'YYYY-MM-DD') = ${searchParams.date}`;
      }
      if (searchParams.time) {
        query = Prisma.sql`${query} AND TO_CHAR(start_date, 'HH24:MI') = ${searchParams.time}`;
      }
    }

    // UTILS
    const prevAndCurWeek = this.utilsService.getCurrentWeekAndLastWeekDates();

    const games = await this.prisma.$queryRaw<
      { id: number; startDate: Date; poolPrize: number; collection: number }[]
    >`${query}`.catch((e) => console.log({ e }));

    if (!games || !games.length) {
      throw new NotFoundException('Game not found');
    }
    // get players and append
    const _games = await Promise.all(
      games.map(async (game) => {
        const prevGames = await this.prisma.game.findMany({
          where: {
            startDate: {
              lt: game.startDate,
            },
          },
          select: {
            id: true,
          },
          orderBy: {
            startDate: 'desc',
          },
          take: 1,
        });
        const players = await this.prisma.joinGame.findMany({
          where: {
            gameId: game.id,
          },
          select: {
            user: {
              select: {
                id: true,
                sheets: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        });

        const _players = await Promise.all(
          players.map(async (player) => {
            const uid = player.user.id;
            const prevSheets = prevGames.length
              ? await this.prisma.sheet.count({
                  where: {
                    userId: uid,
                    gameId: prevGames[0].id,
                  },
                })
              : 0;
            const lastWeekSheets = await this.prisma.sheet.count({
              where: {
                userId: uid,
                createdAt: {
                  gte: prevAndCurWeek.prevWeek[0],
                  lte: prevAndCurWeek.prevWeek[1],
                },
              },
            });
            // Current week sheets count
            const currentWeekSheets = await this.prisma.sheet.count({
              where: {
                userId: uid,
                createdAt: {
                  gte: prevAndCurWeek.currentWeek[0],
                  lte: prevAndCurWeek.currentWeek[1],
                },
              },
            });
            return {
              id: uid,
              currentSheets: player.user.sheets.length,
              prevSheets,
              lastWeekSheets,
              currentWeekSheets,
              currentGameSheet: player.user.sheets.length,
            };
          }),
        );
        return Object.assign(game, {
          players: _players,
        });
      }),
    );

    const groupedByMonth = _.groupBy(_games, (game) => {
      return game.startDate.toISOString().slice(0, 7); // Get YYYY-MM format
    });

    const groupedByMonthAndDateAndTime = _.mapValues(
      groupedByMonth,
      (monthGames) => {
        const groupedByDate = _.groupBy(monthGames, (game) => {
          return game.startDate.toISOString().slice(0, 10); // Get YYYY-MM-DD format
        });

        const groupedWithCount = _.mapValues(groupedByDate, (dateGames) => {
          const groupedByTime = _.groupBy(dateGames, (game) => {
            return game.startDate.toISOString().slice(11, 16); // Get HH:MM format
          });

          return {
            games: groupedByTime,
            count: dateGames.length,
          };
        });

        return groupedWithCount;
      },
    );
    return groupedByMonthAndDateAndTime;
  }

  async getAllGamesApp(
    options: GetGamesQueryOptionsDto,
    onlyAvailable: boolean = false,
    userId?: number,
  ) {
    let excludeIds: number[] = [];
    if (onlyAvailable && userId) {
      const purchases = await this.prisma.$queryRaw<
        { id: number; game_id: number }[]
      >`SELECT id, game_id FROM public.sheet_purchases WHERE user_id=${userId};`;
      excludeIds = [...new Set(purchases.map((p) => p.game_id))];
    }
    const pagination = { skip: options?.skip || 0, take: options?.take || 10 };
    let where: Prisma.GameWhereInput = {
      isDeleted: false,
      isActive: true,
      isEnded: false,
      startDate: {
        gt: new Date(Date.now()),
      },
    };

    if (excludeIds.length) {
      where = {
        ...where,
        id: {
          notIn: excludeIds,
        },
      };
    }

    if (options) {
      where = {
        startDate: options.startDate,
        isActive: options.isActive ? options.isActive === 'true' : true,
        ...where,
      };
      if (options.minPoolPrize && options.maxPoolPrize) {
        where = {
          poolPrize: {
            gt: new Decimal(options.minPoolPrize),
            lt: new Decimal(options.maxPoolPrize),
          },
          ...where,
        };
      }
      if (options.startDateFrom && options.startDateTo) {
        where = {
          ...where,
          startDate: {
            gte: new Date(options.startDateFrom).toISOString(),
            lte: new Date(options.startDateTo).toISOString(),
          },
        };
      }
    }
    const count = await this.prisma.game.count({ where });
    const games = await this.prisma.game.findMany({
      where,
      select: {
        id: true,
        poolPrize: true,
        startDate: true,
        claimPrizeMap: {
          select: {
            type: true,
            amount: true,
          },
        },
        offers: true,
        isSoldOut: true,
        price: true,
        purchaseStopsAt: true,
        isStarted: true,
        isEnded: true,
      },
      orderBy: {
        startDate: 'asc',
      },
      skip: options.skip,
      take: options.take,
    });
    return {
      count,
      data: await Promise.all(
        games.map(async (game) => {
          const offers: {
            id: bigint;
            type: OfferType;
            buy?: number | null;
            get?: number | null;
            discount?: number | null;
            isActive: boolean;
          }[] = this.getActiveOffers(game.offers);
          const isRunning = game.isStarted && !game.isEnded;
          return Object.assign(game, { offers, isRunning });
        }),
      ),
      ...pagination,
    };
  }

  async getAllGames(options: GetGamesQueryOptionsDto) {
    const pagination = { skip: options?.skip || 0, take: options?.take || 10 };
    let where: Prisma.GameWhereInput = { isDeleted: false };
    if (options) {
      if (options.startDate) {
        where = {
          startDate: options.startDate,
          ...where,
        };
      }
      if (options.isActive) {
        where = {
          isActive: options.isActive ? options.isActive === 'true' : true,
          ...where,
        };
      }
      if (options.minPoolPrize && options.maxPoolPrize) {
        where = {
          poolPrize: {
            gt: new Decimal(options.minPoolPrize),
            lt: new Decimal(options.maxPoolPrize),
          },
          ...where,
        };
      }
      if (options.startDateFrom && options.startDateTo) {
        where = {
          ...where,
          startDate: {
            gte: new Date(options.startDateFrom).toISOString(),
            lte: new Date(options.startDateTo).toISOString(),
          },
        };
      }
    }
    const count = await this.prisma.game.count({ where });
    const games = await this.prisma.game.findMany({
      where,
      select: {
        id: true,
        poolPrize: true,
        isActive: true,
        isStarted: true,
        startDate: true,
        createdAt: true,
        updatedAt: true,
        claimPrizeMap: {
          select: {
            type: true,
            amount: true,
          },
        },
        offers: true,
        isSoldOut: true,
        isEnded: true,
        playerLimit: true,
        collection: true,
        purchaseLimit: true,
        price: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      count,
      data: await Promise.all(
        games.map(async (game) => {
          const offers: {
            id: bigint;
            type: OfferType;
            buy?: number | null;
            get?: number | null;
            discount?: number | null;
            isActive: boolean;
          }[] = this.getActiveOffers(game.offers);
          const soldSheets = await this.getTotalSoldSheetCount(Number(game.id));
          return Object.assign(game, { offers, soldSheets });
        }),
      ),
      ...pagination,
    };
  }

  // async getActiveOffer(id: bigint) {
  //   const offer = await this.prisma.offers.findFirst({
  //     where: {
  //       gameId: id,
  //       isActive: true,
  //     },
  //   });
  //   return offer;
  // }

  async deactivateOffer(id: bigint, tx: Prisma.TransactionClient) {
    await tx.offers.update({
      where: {
        id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  }

  async isOfferExists(type: OfferType, gameId: bigint, id?: bigint) {
    const count = await this.prisma.offers.findUnique({
      where: {
        id,
        type,
      },
      select: {
        id: true,
      },
    });
    return count;
  }

  async getOfferById(id: bigint) {
    return await this.prisma.offers.findFirst({ where: { id } });
  }

  async endGame(id: bigint) {
    const game = await this.prisma.game.update({
      where: { id },
      data: { isEnded: true, isStarted: false, isActive: false },
      select: { isEnded: true },
    });
    if (game.isEnded) {
      this.eventEmitter.emit('game.ended', { id: Number(id) });
    }
  }

  async dealNumber(data: { id: bigint; number: number; index: number }) {
    const game = await this.getGameById(data.id);
    if (!game) {
      return 'Game not found';
    }
    const dealt = game.dealt_numbers || [];
    if (dealt.length) {
      if (dealt.includes(data.number)) {
        return;
      }
    }
    await this.prisma.game.update({
      where: { id: data.id },
      data: {
        dealt_numbers: {
          push: data.number,
        },
        lastDealIndex: data.index,
      },
    });
    const _game = await this.getGameById(data.id);
    await this.prisma.game.update({
      where: { id: data.id },
      data: {
        dealt_numbers: [...new Set(_game.dealt_numbers || [])],
        lastDealIndex: data.index,
      },
    });
    return dealt;
  }

  async deleteOffer(id: number) {
    const offer = await this.prisma.offers.findUnique({
      where: { id },
      select: {
        gameId: true,
      },
    });
    if (offer?.gameId) {
      throw new BadRequestException('Offer is in use');
    }
    await this.prisma.offers.delete({
      where: {
        id,
      },
    });
    return 'Success';
  }

  async updateOffer(data: {
    id: number;
    buy?: number;
    get?: number;
    discount?: number;
    isActive?: boolean;
  }) {
    const { id, buy, discount, get, isActive } = data;
    await this.prisma.offers.update({
      where: {
        id,
      },
      data: {
        buy,
        get,
        discount,
        isActive,
      },
    });
    return 'Success';
  }

  async updateGameDetails(data: {
    id: number;
    poolPrize?: number;
    startDate?: Date;
    isActive?: string;
    isSoldOut?: string;
    purchaseLimit?: number;
    price?: number;
    modes?: {
      mode: ClaimType;
      amount: number;
    }[];
    offers?: {
      id: number;
      type?: OfferType;
      buy?: number;
      get?: number;
      discount?: number;
      isActive?: boolean;
    }[];
    playerLimit?: number[];
    purchaseStopsAt?: Date;
    priceBand?: {
      price: number;
      dates: Date[];
    }[];
  }) {
    const {
      id,
      modes,
      poolPrize,
      startDate,
      isActive,
      offers,
      playerLimit,
      isSoldOut,
      purchaseLimit,
      price,
      purchaseStopsAt,
      priceBand,
    } = data;
    const game = await this.getGameById(BigInt(id));
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    const active = this.utilsService.parseBoolean(isActive);
    const soldOut = this.utilsService.parseBoolean(isSoldOut);
    if (new Date(game.startDate) < new Date(Date.now()) && startDate) {
      throw new BadRequestException(
        'Game is already started can not change start time',
      );
    }
    if (new Date(game.startDate) < new Date(Date.now()) && isActive) {
      throw new BadRequestException(
        'Game is already started can not change active status',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id, isDeleted: false },
        data: {
          isActive: active,
          isSoldOut: soldOut,
          poolPrize,
          startDate: startDate ? new Date(startDate).toISOString() : startDate,
          purchaseStopsAt: purchaseStopsAt
            ? new Date(purchaseStopsAt)
            : purchaseStopsAt,
          playerLimit,
          price: price ? new Decimal(price) : undefined,
          purchaseLimit,
          priceBand,
        },
      });
      offers &&
        offers.length &&
        (await Promise.all(
          offers.map(async (offer) => {
            const _offer = await this.getActiveOffer(BigInt(id));
            if (
              offer.isActive &&
              _offer &&
              _offer.isActive &&
              BigInt(offer.id) !== _offer.id
            ) {
              await this.deactivateOffer(_offer.id, tx);
            }
            const exists = await this.isOfferExists(
              offer.type as OfferType,
              BigInt(id),
            );
            const found = await this.getOfferById(BigInt(offer.id));
            if (exists && !found) {
              throw new BadRequestException(
                'Offer with this type already exists',
              );
            }
            if (found?.type !== offer.type) {
              throw new BadRequestException('Can not change type once added');
            }
            await tx.offers.upsert({
              where: {
                id: offer.id,
                type_gameId: {
                  type: offer.type as OfferType,
                  gameId: id,
                },
              },
              create: {
                ...offer,
                type: offer.type as OfferType,
                isActive: offer.isActive ?? false,
                gameId: id,
              },
              update: {
                ...offer,
              },
            });
          }),
        ));
      // offers &&
      //   offers.length &&
      //   (await tx.game.update({
      //     where: { id, isDeleted: false },
      //     data: {
      //       offers: {
      //         set: offers.map((id) => ({ id })),
      //       },
      //     },
      //   }));
      // TODO update or reset or create
      const _gameMode = await this.prisma.game.findUnique({
        where: { id },
        select: { id: true, claimPrizeMap: true },
      });
      const modesTypes = modes?.map((j) => j.mode) || [];
      const filteredIds = _gameMode
        ? _gameMode.claimPrizeMap
            .filter((i) => !modesTypes.includes(i.type))
            .map((i) => i.id)
        : [];
      filteredIds.map(async (id) => {
        await this.prisma.claimPrizeMap.update({
          where: {
            id,
          },
          data: {
            isDeleted: true,
          },
        });
      });
      modes &&
        modes.length &&
        (await Promise.all(
          modes?.map(async (mode) => {
            if (
              !(await this.prisma.claimPrizeMap.findFirst({
                where: { gameId: id, type: mode.mode, isDeleted: false },
                select: { id: true },
              }))
            ) {
              await this.prisma.claimPrizeMap.create({
                data: {
                  amount: mode.amount,
                  type: mode.mode,
                  gameId: id,
                },
              });
            } else {
              await tx.claimPrizeMap.updateMany({
                where: {
                  gameId: id,
                  type: mode.mode,
                  id: {
                    notIn: filteredIds,
                  },
                  isDeleted: false,
                },
                data: {
                  amount: mode.amount,
                },
              });
            }
          }),
        ));
    });
    return 'Game Updated successfully';
  }

  async deleteGame(id: bigint) {
    const game = await this.getGameById(id);
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    if (
      new Date(game.startDate) < new Date(Date.now()) &&
      game.isEnded === false
    ) {
      throw new BadRequestException('Game is already started, can not delete');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.claimPrizeMap.updateMany({
        where: {
          gameId: id,
        },
        data: {
          isDeleted: true,
        },
      });
      await tx.game.update({
        where: { id },
        data: {
          isDeleted: true,
          sheets: {
            updateMany: {
              where: {
                gameId: id,
              },
              data: {
                isDeleted: true,
              },
            },
          },
        },
      });
    });
  }

  async claim(
    claim: ClaimType,
    ticketId: bigint,
    gameId: bigint,
    numbers: number[],
  ) {
    console.log('success');
    const claimed = await this.prisma.claim.findFirst({
      where: {
        type: claim,
        numbers: {
          hasEvery: numbers,
        },
        ticketId: {
          not: ticketId,
        },
        gameId,
        isValid: true,
      },
      select: { id: true },
    });
    if (claimed) {
      return 'Already claimed';
    }
    await this.prisma.claim.upsert({
      where: {
        type_ticketId: {
          type: claim,
          ticketId,
        },
      },
      create: {
        claimedOn: new Date(Date.now()),
        isValid: true,
        timestamp: new Date(Date.now()),
        type: claim,
        ticketId: ticketId,
        numbers,
        gameId,
      },
      update: {
        timestamp: new Date(Date.now()),
        gameId,
      },
    });
  }

  async verifyClaim(data: {
    userId: number;
    ticketId: number;
    gameId: number;
    claim: ClaimType;
    numbers: number[];
  }) {
    const claimTypes = this.getModes();
    console.log({ data, claimTypes, in: claimTypes.includes(data.claim) });

    if (
      data.userId &&
      data.ticketId &&
      data.gameId &&
      data.claim &&
      data.numbers &&
      claimTypes.includes(data.claim)
    ) {
      const { ticketId, claim, numbers, gameId } = data;
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        select: { numbers: true, dealt_numbers: true, id: true },
      });

      if (!game) return { message: 'Game not found', claim };
      if (!game.dealt_numbers.length || game.dealt_numbers.length < 5)
        return { message: 'Not enough number dealt yet', claim };

      const lastSequence = game.dealt_numbers;
      const ticket = await this.sheetService.getTicket(BigInt(ticketId));

      if (!ticket) return { message: 'No ticket found', claim };

      const matrix = ticket.matrix as number[][];

      if (await this.isAlreadyClaimed(gameId, claim))
        return { message: 'This is already claimed by someone else!!', claim };

      const isValidClaim = this.isValidClaim(
        claim,
        numbers,
        matrix,
        lastSequence,
      );

      if (isValidClaim) {
        await this.claim(claim, BigInt(ticketId), BigInt(gameId), numbers);
        return { message: 'Success', claim };
      } else {
        return { message: 'Invalid claim', claim };
      }
    } else {
      return { message: 'Invalid data', claim: data.claim };
    }
  }

  private isValidClaim(
    claim: ClaimType,
    numbers: number[],
    matrix: number[][],
    lastSequence: number[],
  ): boolean {
    switch (claim) {
      case ClaimType.Top:
        return this.checkRow(numbers, matrix[0], lastSequence);
      case ClaimType.Middle:
        return this.checkRow(numbers, matrix[1], lastSequence);
      case ClaimType.Bottom:
        return this.checkRow(numbers, matrix[2], lastSequence);
      case ClaimType.Corners:
        return this.checkCorners(numbers, matrix, lastSequence);
      case ClaimType.Early7:
        return this.checkCount(numbers, matrix, lastSequence, 7);
      case ClaimType.Early10:
        return this.checkCount(numbers, matrix, lastSequence, 10);
      case ClaimType.House:
      case ClaimType.House1:
      case ClaimType.House2:
        return this.checkCount(numbers, matrix, lastSequence, 15);
      default:
        return false;
    }
  }

  private checkRow(
    numbers: number[],
    row: number[],
    lastSequence: number[],
  ): boolean {
    const filteredRow = row.filter((n) => n !== 0);
    return (
      numbers.length >= 5 &&
      numbers.every((n) => filteredRow.includes(n)) &&
      numbers.filter((n) => filteredRow.includes(n)).length === 5 &&
      numbers
        .filter((n) => filteredRow.includes(n))
        .filter((n) => lastSequence.includes(n)).length === 5
    );
  }

  private checkCorners(
    numbers: number[],
    matrix: number[][],
    lastSequence: number[],
  ): boolean {
    const corners = [
      matrix[0][0],
      matrix[0][matrix[0].length - 1],
      matrix[2][0],
      matrix[2][matrix[2].length - 1],
    ];
    return (
      numbers.length >= 4 &&
      numbers.some((n) => corners.includes(n)) &&
      numbers.filter((n) => corners.includes(n)).length === 4 &&
      numbers
        .filter((n) => corners.includes(n))
        .every((n) => lastSequence.includes(n))
    );
  }

  private checkCount(
    numbers: number[],
    matrix: number[][],
    lastSequence: number[],
    count: number,
  ): boolean {
    return (
      numbers.length >= count &&
      numbers.every((n) => matrix.flat(Infinity).includes(n)) &&
      numbers.every((n) => lastSequence.includes(n))
    );
  }

  async isAnotherGameRunning(id: number) {
    const isAnotherGameRunning = await this.prisma.game.count({
      where: {
        isActive: true,
        isDeleted: false,
        isEnded: false,
        isStarted: true,
        id: {
          notIn: [id],
        },
      },
    });
    return isAnotherGameRunning > 0;
  }

  async startGame(id: number) {
    if (await this.isAnotherGameRunning(id)) {
      throw new BadRequestException('Can not run two games at a time.');
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const started = await this.isGameStarted(id);
    if (started === false) {
      console.log('I ran');
      try {
        const update = await this.prisma
          .$executeRaw`UPDATE public.games SET is_started=${true}, started_at=NOW() WHERE id=${id} AND is_started=${false} AND "isEnded"=${false} AND start_date<NOW() AND start_date>${todayStart};`;
        if (update) {
          this.eventEmitter.emit('start');
        } else {
          throw new BadRequestException('Game can not start early');
        }
      } catch (error) {
        throw new BadRequestException('Game can not start early');
      }
    } else {
      console.log('here');
      const update = await this.prisma
        .$executeRaw`UPDATE public.games SET started_at=NOW() WHERE id=${id} AND "isEnded"=${false} AND start_date<NOW() AND start_date>${todayStart};`;
      console.log({ update });
      if (update) {
        this.eventEmitter.emit('start-game', { id: id });
      }
    }
  }

  async stopGame(id: number) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const stopped = await this.isGameStopped(id);
    if (stopped === false) {
      try {
        const update = await this.prisma
          .$executeRaw`UPDATE public.games SET is_started=${false} WHERE id=${id} AND is_started=${true} AND "isEnded"=${false} AND start_date<NOW() AND start_date>${todayStart};`;
        console.log({ update });
        if (update) {
          this.eventEmitter.emit('stop-game', { id: id });
        }
      } catch (error) {
        console.log({ error });
      }
    }
  }

  async isGameStarted(id: number) {
    const game = await this.prisma.game.findFirst({
      where: {
        id,
      },
      select: {
        isStarted: true,
      },
    });
    return game?.isStarted || false;
  }

  async isGameStopped(id: number) {
    const game = await this.prisma.game.findFirst({
      where: {
        id,
      },
      select: {
        isStarted: true,
      },
    });
    return game?.isStarted === false;
  }

  async dealtNumbersGame(id: number) {
    return await this.prisma.game.findUnique({
      where: {
        id,
      },
      select: {
        dealt_numbers: true,
        lastDealIndex: true,
        isStarted: true,
        settings: {
          select: {
            delay: true,
          },
        },
        startDate: true,
      },
    });
  }

  async isAlreadyClaimed(gameId: number, type: ClaimType) {
    const claim = await this.prisma.claim.count({
      where: {
        gameId,
        type,
      },
    });
    return claim > 0;
  }

  async getClaim(gameId: number, type: ClaimType) {
    const claim = await this.prisma.claim.findFirst({
      where: {
        gameId,
        type,
      },
      select: {
        Ticket: {
          select: {
            sheet: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });
    const res = claim?.Ticket?.sheet.userId;
    if (res) {
      return res;
    } else {
      throw new NotFoundException('claim not found');
    }
  }

  async getActiveGame() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0); // Set to start of today
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999); // Set to end of today
    const games = await this.prisma.$queryRaw<
      { id: number }[]
    >`SELECT id FROM public.games WHERE "isEnded"=false AND "isDeleted"=false AND start_date>=${todayStart} AND start_date<=${todayEnd} ORDER BY start_date ASC LIMIT 1;`;
    return games.map((g) => BigInt(g.id));
  }

  async getActiveGameApp() {
    const ids = await this.getActiveGame();
    const game = ids.length
      ? await this.getGame(ids[0], UserType.User)
      : undefined;
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return game;
  }

  async getBumperPrizeGame() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0); // Set to start of today
    const games = await this.prisma.$queryRaw<
      { id: number }[]
    >`SELECT id FROM public.games WHERE "isEnded"=false AND "isDeleted"=false AND start_date>=${todayStart} ORDER BY pool_prize DESC LIMIT 1;`;
    const gameId = games.length ? games[0].id : null;
    if (gameId) {
      return await this.prisma.game.findUnique({
        where: {
          id: gameId,
        },
        select: {
          id: true,
          price: true,
          poolPrize: true,
          startDate: true,
          isSoldOut: true,
        },
      });
    }
    return null;
  }

  async getActiveEntries(
    options: {
      skip?: number;
      take?: number;
    },
    userId: number,
  ) {
    const purchases = await this.prisma.$queryRaw<
      { id: number; game_id: number }[]
    >`SELECT id, game_id FROM public.sheet_purchases WHERE user_id=${userId} ORDER BY created_at DESC;`;
    const gameIds = [...new Set(purchases.map((p) => p.game_id))];
    const count = await this.prisma.game.count({
      where: {
        id: {
          in: gameIds,
        },
        isDeleted: false,
        isEnded: false,
      },
    });
    const games = await this.prisma.game.findMany({
      where: {
        id: {
          in: gameIds,
        },
        isDeleted: false,
        isEnded: false,
      },
      select: {
        id: true,
        price: true,
        poolPrize: true,
        startDate: true,
        isSoldOut: true,
      },
      skip: options.skip || 0,
      take: options.take || 10,
    });

    const gamesMap = _.keyBy(games, 'id');
    const orderedGames = gameIds.map((id) => gamesMap[id]);

    return {
      count,
      data: _.compact(orderedGames),
      skip: options.skip || 0,
      take: options.take || 10,
    };
  }

  async updateGameResumeStatus(
    id: number,
    resumable?: boolean,
    resumed?: boolean,
  ) {
    await this.prisma.game.update({
      where: { id },
      data: {
        resumable,
        resumed,
      },
    });
  }

  async resumeGamesHandle() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const results = await this.prisma.$queryRaw<{ id: number }[]>`
    SELECT id 
    FROM public.games 
    WHERE is_started = true 
      AND "isEnded" = false 
      AND "isDeleted" = false 
      AND "isActive" = true 
      AND resumable = true 
      AND start_date < NOW() 
      AND start_date > ${todayStart} 
    LIMIT 1;
  `;
    console.log('Attempting to resume');
    if (results.length >= 1) {
      console.log('Resuming');
      this.utilsService
        .waitUntilValue(
          () => Boolean(this.eventEmitter.eventNames().length),
          true as any,
        )
        .then(() => {
          this.eventEmitter.emit('start');
        });
    }
  }

  async updatePricesHandler() {
    const games = await this.prisma.$queryRaw<
      {
        id: bigint;
        price: number;
        priceBand: Prisma.JsonValue | any;
      }[]
    >`SELECT id, "priceBand",price FROM public.games WHERE "isEnded"=false AND "isDeleted"=false AND "isActive"=true;`;
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const priceBand = game.priceBand as unknown as PriceBand[];
      const now = new Date();
      let price: Decimal = new Decimal(game.price);
      priceBand.map((pb) => {
        const dateA = new Date(pb.dates[0]);
        const dateB = new Date(pb.dates[1]);
        if (dateA <= now && dateB >= now) {
          price = new Decimal(pb.price);
        }
      });
      await this.prisma.game.update({
        where: { id: game.id },
        data: {
          price,
        },
      });
    }
  }

  async GamesCleanerHandle() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0); // Set to start of today

    const result = await this.prisma.$executeRaw`
    UPDATE public.games 
    SET "isDeleted" = true 
    WHERE is_started = true 
      AND "isEnded" = false 
      AND "isDeleted" = false 
      AND "isActive" = true 
      AND start_date < ${todayStart};
  `;
    console.log(`${result} games updated to isDeleted = true.`);
  }
}
