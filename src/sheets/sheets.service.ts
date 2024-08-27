import { Matrix, PaginatedDto, UserType, UtilsService } from '@Common';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma';
import { WalletService } from 'src/wallet/wallet.service';
import { MatrixClass } from './dto';
import {
  ClaimType,
  Offers,
  OfferType,
  Prisma,
  UserWallet,
  WalletTransactionContext,
} from '@prisma/client';
import { sheetConfigFactory } from '@Config';
import { ConfigType } from '@nestjs/config';
import _ from 'lodash';

@Injectable()
export class SheetsService {
  constructor(
    @Inject(sheetConfigFactory.KEY)
    private readonly sheetConfig: ConfigType<typeof sheetConfigFactory>,
    private readonly prisma: PrismaService,
    private readonly utilsService: UtilsService,
    private readonly walletService: WalletService,
  ) {}
  // ⚠️ CORE LOGIC DO NOT CHANGE W/O KNOWING FULL CONTEXT

  private getUniqueNumber(
    sheet: number[][][],
    ticket: number[][],
    rowMappings: {
      [key: number]: any;
    },
    j: number,
  ) {
    let number = this.utilsService.getRandomIndex(
      rowMappings[j][0],
      rowMappings[j][1],
    );
    const lookup = [
      ...ticket.map((t) => t[j]).filter((i) => i > 0),
      ...new Set(
        sheet
          .map((t) => t.map((r) => r[j]))
          .flat(1)
          .filter((n) => n > 0),
      ),
    ];
    while (lookup.includes(number)) {
      number = this.utilsService.getNumberFromRangeArray(
        rowMappings[j][0],
        rowMappings[j][1],
        lookup,
      );
    }
    if (number === undefined) {
      console.log(
        'No number is available, lookup is full',
        ': ',
        lookup.toString(),
        ' len :',
        lookup.length,
      );
      sheet.map((s) => {
        console.log({ t: JSON.stringify(s) });
      });
    }
    return number;
  }

  private isNumberInColumn(
    sheet: number[][][],
    columnIndex: number,
    number: number,
  ): boolean {
    return sheet.some((ticket) =>
      ticket.some((row) => row[columnIndex] === number),
    );
  }

  private fillZeroIndices(
    row: number[],
    sheet: number[][][],
    ticket: number[][],
    rowMappings: {
      [key: number]: any;
    },
    columnMappings: {
      [key: number]: number[];
    },
  ) {
    const zeroIndices = row
      .map((r, i) => (r === 0 && i !== 0 && i !== row.length - 1 ? i : null))
      .filter((i) => i !== null);
    if (row.filter((r) => r > 0).length === 4 && zeroIndices.length > 0) {
      const randomIndex = zeroIndices[
        Math.floor(Math.random() * zeroIndices.length)
      ] as number;
      const number = Math.max(...columnMappings[randomIndex]) + 1;
      if (
        columnMappings[randomIndex].length === 8 &&
        number !== undefined &&
        !columnMappings[randomIndex].includes(number)
      ) {
        row[randomIndex] = number === undefined ? 0 : number;
        number !== undefined && columnMappings[randomIndex].push(number);
      }
    }
  }

  private generateNewSheet(count = 6) {
    const rowMappings: {
      [key: number]: number[];
    } = {
      0: [1, 9],
      1: [10, 19],
      2: [20, 29],
      3: [30, 39],
      4: [40, 49],
      5: [50, 59],
      6: [60, 69],
      7: [70, 79],
      8: [80, 90],
    };
    const columnMappings: {
      [key: number]: number[];
    } = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
    };
    const sheet: number[][][] = [];
    for (let t = 0; t < count; t++) {
      const ticket: number[][] = [];
      for (let i = 0; i < 3; i++) {
        const row: number[] = [];
        for (let j = 0; j < 9; j++) {
          let zeroIndices = j % 2 == 0;
          if (i % 2 == 1) {
            zeroIndices = j % 2 == 1;
          }
          if (t >= 3) {
            zeroIndices = !zeroIndices;
          }
          if (zeroIndices) {
            const number = this.getUniqueNumber(sheet, ticket, rowMappings, j);
            columnMappings[j].push(number);
            row.push(number);
          } else {
            row.push(0);
          }
        }
        ticket.push(row);
      }
      // const _ticket = this.utilsService.shuffleNumbers(ticket) as Matrix;
      sheet.push(ticket);
    }
    // const maxes = Object.values(columnMappings).map((arr) => Math.max(...arr));
    sheet.map((ticket) => {
      ticket.map((row) => {
        this.fillZeroIndices(row, sheet, ticket, rowMappings, columnMappings);
      });
    });
    return sheet;
  }

  private houseSheetFromGame(numbers: number[]) {
    const houseRange = numbers.slice(1, 55);
    const rowMaps = [
      [1, 9],
      [10, 19],
      [20, 29],
      [30, 39],
      [40, 49],
      [50, 59],
      [60, 69],
      [70, 79],
      [80, 90],
    ];
    const sheet: number[][][] = [];
    const ranges = rowMaps.map((mp) => {
      return houseRange.filter((n) => n >= mp[0] && n <= mp[1]);
    });
    for (let i = 0; i < 6; i++) {
      const ticket: number[][] = [];
      for (let j = 0; j < 3; j++) {
        const row: number[] = [];
        for (let k = 0; k < 9; k++) {
          const range = ranges[k];
          let zeroIndices = k % 2 == 0;
          if (j % 2 == 1) {
            zeroIndices = k % 2 == 1;
          }
          if (zeroIndices) {
            let number = this.utilsService.getRandomElementFromArray(range);
            const columns: number[] = Array.from(
              { length: j },
              (_, i) => i,
            ).map((i: number) => ticket[i][k]);
            while (columns.includes(number)) {
              number = this.utilsService.getRandomElementFromArray(range);
            }
            row.push(number);
          } else {
            row.push(0);
          }
        }
        const zeroIndices = row
          .map((r, i) =>
            r === 0 && i !== 0 && i !== row.length - 1 ? i : null,
          )
          .filter((i) => i !== null);
        if (row.filter((r) => r > 0).length === 4 && zeroIndices.length > 0) {
          const randomIndex = zeroIndices[
            Math.floor(Math.random() * zeroIndices.length)
          ] as number;
          let randNumber = this.utilsService.getRandomElementFromArray(
            ranges[randomIndex],
          );
          const columns: number[] = Array.from({ length: j }, (_, i) => i).map(
            (i: number) => ticket[i][randomIndex],
          );
          while (columns.includes(randNumber)) {
            randNumber = this.utilsService.getRandomElementFromArray(
              ranges[randomIndex],
            );
          }
          row[randomIndex] = randNumber;
        }
        ticket.push(row);
      }
      const _ticket = this.utilsService.shuffleNumbers(ticket) as Matrix;
      sheet.push(_ticket);
    }
    return sheet;
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

  async exists(uid: string) {
    return await this.prisma.sheet.findUnique({
      where: { uid },
      select: { id: true },
    });
  }

  async getNewSheet(count: number) {
    // TODO check if exists
    const sheets: { sheet: number[][][]; sheetUid: string }[] = [];
    for (let i = 0; i < count; i++) {
      let sheet = this.utilsService.generateTickets();
      let sheetFlattened = sheet.flat(Infinity) as number[];
      let sheetUid = this.utilsService.convertToHexString(
        sheetFlattened.filter((s) => s > 0),
      );
      let exists = await this.exists(sheetUid);
      while (exists) {
        sheet = this.utilsService.generateTickets();
        sheetFlattened = sheet.flat(Infinity) as number[];
        sheetUid = this.utilsService.convertToHexString(
          sheetFlattened.filter((s) => s > 0),
        );
        exists = await this.exists(sheetUid);
      }
      sheets.push({ sheet, sheetUid });
    }
    return sheets;
  }

  async getGame(id: number) {
    const game = await this.prisma.game.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
        numbers: true,
      },
    });
    if (!game || _.isNil(game)) {
      throw new NotFoundException('Game not found');
    }
    return game;
  }

  async getGameHouseSheets(id: number) {
    const game = await this.getGame(id);

    const _sheets = await this.prisma.offlineSheet.findMany({
      where: { gameId: id },
      select: { id: true, sheet: true },
      orderBy: {
        idx: 'asc',
      },
    });

    const validateSheets = async (
      sheets: typeof _sheets,
      gameNumbers: number[],
    ): Promise<boolean> => {
      const validationResults = sheets.map((sheet) =>
        this.utilsService.validHouseSheet({
          sheet: sheet.sheet as number[][][],
          numbers: gameNumbers,
        }),
      );
      return validationResults.every((isValid) => isValid === true);
    };

    const processSheet = async (sheet: any, gameId: number, index: number) => {
      // TODO prev manipulate change back if not works
      // await this.manipulate(sheet, otherSheets, gameNumbers, gameId, index);
      return await this.manipulate2(sheet, gameId, index);
    };

    if (_sheets.length === 3) {
      for (let i = 0; i < _sheets.length; i++) {
        await processSheet(_sheets[i], id, i);
      }
      const allValid = await validateSheets(
        _sheets,
        game.numbers.split(',').map(Number),
      );
      console.log({ allValid });
      return _sheets;
    }

    const generateAndSaveSheets = async (
      gameNumbers: number[],
    ): Promise<any[]> => {
      let generatedSheets: number[][][][] = [];
      let ts: number[][][] = [];
      for (let i = 0; i < 3; i++) {
        const sheet = this.utilsService.generateTickets(
          this.sheetConfig.numberOfTickets,
          gameNumbers
            .slice(0, 63)
            .filter((n) => !ts.flat(Infinity).includes(n)),
        );
        generatedSheets.push(sheet);
        ts.push(sheet[0]);
      }
      const unprocessedSheets = await Promise.all(
        generatedSheets.map(async (sheet, i) => {
          try {
            const savedSheet = this.utilsService.retryable(
              async () =>
                await this.prisma.offlineSheet.create({
                  data: { sheet: sheet, gameId: id, idx: i },
                }),
            );
            return savedSheet;
          } catch (error) {
            console.log({ error });
            throw error;
          }
        }),
      );
      const processedSheets: any[] = [];
      for (let i = 0; i < unprocessedSheets.length; i++) {
        const res = await processSheet(unprocessedSheets[i], id, i);
        if (res) processedSheets.push(unprocessedSheets[i]);
      }
      return processedSheets;
    };

    const newSheets = await generateAndSaveSheets(
      game.numbers.split(',').map(Number),
    );
    const updatedGame = await this.getGame(id);
    const allValid = await validateSheets(
      newSheets,
      updatedGame.numbers.split(',').map(Number),
    );
    console.log({ allValid });

    return newSheets;
  }

  async getNewSheetHouse(id: number) {
    // TODO check if exists
    const game = await this.prisma.game.findUnique({
      where: { id, isDeleted: false, isActive: true },
      select: { numbers: true },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    const numbers = game.numbers;
    let sheet = this.houseSheetFromGame(numbers.split(',').map(Number));
    let sheetFlattened = sheet.flat(Infinity) as number[];
    let sheetUid = this.utilsService.convertToHexString(
      sheetFlattened.filter((s) => s > 0),
    );
    let exists = await this.exists(sheetUid);
    while (exists) {
      sheet = this.houseSheetFromGame(numbers.split(',').map(Number));
      sheetFlattened = sheet.flat(Infinity) as number[];
      sheetUid = this.utilsService.convertToHexString(
        sheetFlattened.filter((s) => s > 0),
      );
      exists = await this.exists(sheetUid);
    }
    return { sheet, sheetUid };
  }

  async getOffer(id: bigint) {
    const offer = await this.prisma.offers.findUnique({
      where: { id, isActive: true },
    });
    const activeOffers = offer ? this.getActiveOffers([offer]) : null;
    return activeOffers ? activeOffers[0] : activeOffers;
  }

  async sheetExists(uid: string) {
    const count = await this.prisma.sheet.count({ where: { uid } });
    return count > 0;
  }

  async generateAndBuySheet(data: {
    gameId: number;
    userId: number;
    offerId?: number;
    count: number;
  }) {
    const { gameId, offerId, userId, count } = data;
    const game = await this.prisma.game.findUnique({
      where: {
        id: gameId,
        isDeleted: false,
      },
      select: {
        id: true,
        isEnded: true,
      },
    });
    if (!game || game.isEnded) {
      throw new BadRequestException('Either game is ended or deleted');
    }
    const sheets = await this.getNewSheet(count);
    const _sheets = sheets.map((sheet) => {
      return this.utilsService.transformData(sheet);
    });
    const _data = _sheets.map((i) => ({
      gameId,
      offerId,
      userId,
      tickets: i.sheet,
      uid: i.uid,
    }));
    return await this.buySheet(_data);
  }

  async buySheet(
    data: {
      gameId: number;
      userId: number;
      offerId?: number;
      tickets: MatrixClass[];
      uid: string;
    }[],
  ) {
    const game = await this.prisma.game.findUnique({
      where: { id: data[0].gameId },
      select: {
        id: true,
        purchaseLimit: true,
        players: {
          select: {
            id: true,
          },
        },
        playerLimit: true,
        price: true,
      },
    });
    const price = game?.price || new Decimal(0);
    const totalAmount = price.mul(data.length);

    const userSheetCount = await this.prisma.sheet.count({
      where: { gameId: data[0].gameId, userId: data[0].userId },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const offer = data[0].offerId
      ? await this.getOffer(BigInt(data[0].offerId))
      : null;

    // if (!offer) {
    //   throw new BadRequestException('Offer is invalid');
    // }
    // TODO apply offers

    if (game && userSheetCount > game?.purchaseLimit) {
      throw new BadRequestException('Sheet purchase limit reached');
    } else {
      const currentCount = userSheetCount + data.length;
      if (game && currentCount > game.purchaseLimit) {
        throw new BadRequestException(
          'Purchase limit exceeded, try removing some sheets',
        );
      }
    }

    if (game && game.players.length > game.playerLimit[1]) {
      await this.prisma.game.update({
        where: {
          id: game.id,
        },
        data: {
          isSoldOut: true,
        },
      });
      throw new BadRequestException(
        'Oops! Game has reached maximum player limit. try some other game',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const wallet: UserWallet = (await this.walletService.getByUserId(
        BigInt(data[0].userId),
        UserType.User,
        { tx },
      )) as UserWallet;
      let useWallet = false;
      if (wallet.amount.lt(totalAmount)) {
        if (wallet.referral_amount.lt(totalAmount)) {
          throw new BadRequestException(
            'Insufficient balance in wallet. consider recharging your wallet',
          );
        }
      } else {
        useWallet = true;
      }
      const sheets = await Promise.all(
        data.map(async (_data) => {
          const { gameId, userId, tickets, uid } = _data;
          if (await this.sheetExists(uid)) {
            throw new BadRequestException('Duplicate sheet buy request found');
          }
          const sheet = await tx.sheet.create({
            data: {
              isPaid: true,
              price,
              gameId,
              userId,
              uid,
            },
          });
          await Promise.all(
            tickets.map(async (ticket) => {
              const matrix = ticket.matrix.map((r) => r.row);
              await tx.ticket.create({
                data: {
                  matrix: matrix,
                  sheetId: sheet.id,
                },
              });
            }),
          );
          return sheet;
        }),
      );
      const purchase = await tx.sheetPurchase.create({
        data: {
          total: totalAmount,
          offerId: data[0].offerId,
          sheets: {
            connect: sheets.map((s) => ({
              id: s.id,
            })),
          },
          userId: data[0].userId,
          gameId: game?.id,
        },
      });
      await tx.joinGame.upsert({
        where: {
          userId_gameId: {
            gameId: data[0].gameId,
            userId: data[0].userId,
          },
        },
        create: {
          amount: totalAmount,
          winAmount: 0,
          gameId: data[0].gameId,
          userId: data[0].userId,
        },
        update: {
          amount: totalAmount,
          winAmount: 0,
          gameId: data[0].gameId,
          userId: data[0].userId,
        },
      });

      await tx.game.update({
        where: { id: data[0].gameId },
        data: {
          collection: {
            increment: new Decimal(totalAmount),
          },
        },
      });

      // get admin
      const admin = await this.getAdmin();
      if (!admin) throw new NotFoundException('Admin not found');

      if (useWallet) {
        await this.walletService.subtractBalance(
          BigInt(data[0].userId),
          totalAmount,
          {
            tx: tx,
            context: WalletTransactionContext.TicketPurchase,
            entityId: purchase.id,
          },
        );
        await this.walletService.addBalance(BigInt(admin.id), totalAmount, {
          tx: tx,
          context: WalletTransactionContext.TicketPurchase,
          entityId: purchase.id,
        });
      } else {
        await this.walletService.subtractReferralBalance(
          BigInt(data[0].userId),
          totalAmount,
          {
            tx: tx,
            context: WalletTransactionContext.TicketPurchase,
            entityId: purchase.id,
          },
        );
        await this.walletService.addBalance(BigInt(admin.id), totalAmount, {
          tx: tx,
          context: WalletTransactionContext.TicketPurchase,
          entityId: purchase.id,
        });
      }
    });
    return 'Success';
  }

  async getSheetPurchases() {
    const purchases = await this.prisma.sheetPurchase.findMany();
    return purchases;
  }

  async getUserSheets(userId: bigint, options: PaginatedDto) {
    const pagination = {
      skip: options?.skip || 0,
      take: options?.take || 10,
    };
    const where: Prisma.SheetWhereInput = { userId, isDeleted: false };
    const count = await this.prisma.sheet.count({ where });
    const sheets = await this.prisma.sheet.findMany({
      where: { ...where },
      include: {
        tickets: {
          select: {
            id: true,
            matrix: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: options.skip,
      take: options.take,
    });
    return {
      count,
      data: sheets,
      ...pagination,
    };
  }

  async getUserGameSheets(gameId: bigint, userId: bigint) {
    const sheets = await this.prisma.sheet.findMany({
      where: { gameId, userId, isPaid: true },
      select: {
        id: true,
        tickets: {
          select: {
            id: true,
            matrix: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return sheets;
  }

  async getTicket(id: bigint) {
    return await this.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, matrix: true },
    });
  }

  async getWinAmount(
    sheets: {
      gameId: bigint | null;
      tickets: {
        claims: {
          type: ClaimType;
          isValid: boolean;
        }[];
      }[];
      user: {
        fullname: string;
      };
    }[],
  ): Promise<Decimal> {
    const results = await Promise.all(
      sheets.map(async (s) => {
        const ticketAmounts = await Promise.all(
          s.tickets.map(async (t) => {
            const claimAmounts = await Promise.all(
              t.claims.map(async (c) => {
                const prizeMap = await this.prisma.claimPrizeMap.findFirst({
                  where: {
                    gameId: Number(s.gameId),
                    type: c.type,
                  },
                  select: {
                    amount: true,
                  },
                });
                return prizeMap?.amount || new Decimal(0);
              }),
            );
            // Sum the claim amounts for this ticket
            return claimAmounts.reduce(
              (total, amount) => total.plus(amount),
              new Decimal(0),
            );
          }),
        );
        // Sum the ticket amounts for this sheet
        return ticketAmounts.reduce(
          (total, amount) => total.plus(amount),
          new Decimal(0),
        );
      }),
    );
    // Sum the results for all sheets
    return results.reduce(
      (total, amount) => total.plus(amount),
      new Decimal(0),
    ) as Decimal;
  }

  async getLossAmount(
    sheets: {
      gameId: bigint | null;
      tickets: {
        claims: {
          type: ClaimType;
          isValid: boolean;
        }[];
      }[];
      user: {
        fullname: string;
      };
    }[],
  ): Promise<Decimal> {
    const results = await Promise.all(
      sheets.map(async (s) => {
        const ticketAmounts = await Promise.all(
          s.tickets.map(async (t) => {
            const claimAmounts = await Promise.all(
              t.claims.map(async (c) => {
                if (!c.isValid) {
                  return new Decimal(0);
                }
                const prizeMap = await this.prisma.claimPrizeMap.findFirst({
                  where: {
                    gameId: Number(s.gameId),
                    type: c.type,
                  },
                  select: {
                    amount: true,
                  },
                });
                return prizeMap?.amount || new Decimal(0);
              }),
            );
            // Sum the claim amounts for this ticket
            return claimAmounts.reduce(
              (total, amount) => total.plus(amount),
              new Decimal(0),
            );
          }),
        );
        // Sum the ticket amounts for this sheet
        return ticketAmounts.reduce(
          (total, amount) => total.plus(amount),
          new Decimal(0),
        );
      }),
    );
    // Sum the results for all sheets
    return results.reduce(
      (total, amount) => total.plus(amount),
      new Decimal(0),
    );
  }

  async getSheetPurchase() {
    const purchases = await this.prisma.sheetPurchase.findMany({
      select: {
        id: true,
        createdAt: true,
        total: true,
        sheets: {
          select: {
            user: {
              select: {
                fullname: true,
              },
            },
            gameId: true,
            tickets: {
              select: {
                claims: {
                  select: {
                    type: true,
                    isValid: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const _ac_purchases = await Promise.all(
      purchases.map(async (purchase) => {
        const { createdAt, id, sheets, total } = purchase;
        return {
          id,
          username: sheets[0].user.fullname,
          gameId: sheets[0].gameId,
          dateTime: createdAt,
          totalSheets: sheets.length,
          wonAmount: await this.getWinAmount(sheets),
          lossAmount: await this.getLossAmount(sheets),
          purchasePrice: total,
        };
      }),
    );
    return _ac_purchases;
  }

  async updateGameNumbers(numbers: string, id: number) {
    const g = await this.prisma.game.update({
      where: {
        id,
      },
      data: {
        numbers,
      },
      select: {
        numbers: true,
      },
    });
    return g.numbers;
  }

  /**
   * @description manipulates game according to house sheet
   */
  async manipulate(
    sheet: { id: bigint; sheet: Prisma.JsonValue },
    otherSheets: { id: bigint; sheet: Prisma.JsonValue }[],
    gameNumbers: number[],
    gameId: number,
    index: number,
  ) {
    const sheet1 = sheet.sheet as number[][];
    const susTicket = sheet1[0]
      .flat(Infinity)
      .filter((n: number) => n > 0) as number[];
    const ranges = [
      { start: 51, end: 54 },
      { start: 55, end: 58 },
      { start: 58, end: 61 },
    ];
    const till40 = gameNumbers.slice(0, 40);
    if (till40.length > 15 && susTicket.every((i) => till40.includes(i))) {
      const last3 = susTicket.slice(-3); // diff from otherTicket's last 3
      const nums = gameNumbers;
      const alteredNums = this.utilsService.getAlteredNumbersFromGame(
        nums,
        last3,
        ranges[index],
      );
      console.log({ alteredNums });
      // TODO update game numbers
      this.updateGameNumbers(alteredNums.join(','), gameId);
    }
  }

  /**
   * @description Picking last numbers uniquely from each to manipulate
   * @param sheet
   * @param otherSheets
   * @param gameNumbers
   * @param gameId
   * @param index
   */
  async manipulate2(
    sheet: { id: bigint; sheet: Prisma.JsonValue },
    gameId: number,
    index: number,
  ) {
    const sheet1 = sheet?.sheet as number[][][];
    const gameNumbers = await this.getGameNumbers(gameId).then((n) =>
      n.split(',').map(Number),
    );
    const susTicket = sheet1[0];
    const columns = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
    ];
    const _susTicket = Array.from(
      new Set(
        susTicket
          .flatMap((row) => columns[index].map((col) => row[col]))
          .filter((n) => n > 0),
      ),
    ).slice(0, 3);

    const ranges = [
      { start: 50, end: 53 },
      { start: 56, end: 59 },
      { start: 59, end: 62 },
    ];
    let last3 = _susTicket.slice(-3);
    const nums = gameNumbers;
    const alteredNums = this.utilsService.getAlteredNumbersFromGame(
      nums,
      last3,
      ranges[index],
    );
    console.log({ last3, nums, alteredNums });
    // TODO update game numbers
    return await this.updateGameNumbers(alteredNums.join(','), gameId);
  }

  async getAdmin() {
    return await this.prisma.admin.findFirst({
      select: {
        id: true,
      },
    });
  }

  async getGameNumbers(id: number) {
    const game = await this.prisma.game.findUnique({
      where: {
        id,
      },
      select: { numbers: true },
    });
    return game?.numbers || '';
  }
}
