import { UserType, UtilsService } from '@Common';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  WalletTransaction,
  WalletTransactionContext,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { WalletTransactionContextMeta } from './wallet-transactions.types';

@Injectable()
export class WalletTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utilsService: UtilsService,
  ) {}

  async create(
    data: {
      context: WalletTransactionContext;
      walletId: bigint;
      type: WalletTransactionType;
      amount: Prisma.Decimal;
      availableBalance: Prisma.Decimal;
      timestamp: Date;
      entityId?: bigint;
    },
    options?: { tx?: Prisma.TransactionClient },
  ) {
    const client = options?.tx ? options.tx : this.prisma;
    return await client.walletTransaction.create({
      data: {
        context: data.context,
        type: data.type,
        walletId: data.walletId,
        amount: data.amount,
        availableBalance: data.availableBalance,
        timestamp: data.timestamp,
        entityId: data.entityId,
      },
    });
  }

  async createMany(
    data: {
      context: WalletTransactionContext;
      walletId: bigint;
      type: WalletTransactionType;
      amount: Prisma.Decimal;
      availableBalance: Prisma.Decimal;
      nonce: number;
      timestamp: Date;
      entityId?: bigint;
    }[],
    options?: { tx?: Prisma.TransactionClient },
  ) {
    const client = options?.tx ? options.tx : this.prisma;
    return await client.walletTransaction.createMany({
      data: data.map((t) => ({
        context: t.context,
        type: t.type,
        walletId: t.walletId,
        amount: t.amount,
        availableBalance: t.availableBalance,
        nonce: t.nonce,
        timestamp: t.timestamp,
        entityId: t.entityId,
      })),
    });
  }

  async getAll(
    options?: {
      filters?: {
        userId?: number;
        fromDate?: Date;
        toDate?: Date;
        context?: WalletTransactionContext;
        type?: WalletTransactionType;
        entityId?: bigint;
      };
      orderBy?: keyof WalletTransaction;
      sortOrder?: Prisma.SortOrder;
      skip?: number;
      take?: number;
    },
    userId?: number,
  ) {
    if (!options) options = {};
    if (!options.orderBy) {
      options.orderBy = 'timestamp';
    }

    const where: Prisma.WalletTransactionWhereInput = {
      context: options.filters?.context,
      type: options.filters?.type,
      entityId: options.filters?.entityId,
      wallet: {
        userId: options.filters?.userId || userId,
      },
      AND: [
        {
          timestamp: { gte: options.filters?.fromDate },
        },
        {
          timestamp: { lte: options.filters?.toDate },
        },
      ],
    };

    const totalTransactions = await this.prisma.walletTransaction.count({
      where,
    });
    const transactions = await this.prisma.walletTransaction.findMany({
      include: {
        wallet: {
          select: {
            user: true,
          },
        },
      },
      where,
      orderBy: {
        [options.orderBy]: options.sortOrder || Prisma.SortOrder.desc,
      },
      skip: options?.skip || 0,
      take: options?.take || 10,
    });

    return {
      count: totalTransactions,
      skip: options?.skip || 0,
      take: options?.take || 10,
      data: transactions,
    };
  }

  narrationBuilder(
    tx: WalletTransaction,
    meta: WalletTransactionContextMeta,
  ): string {
    switch (meta.context) {
      case WalletTransactionContext.Deposit:
        if (meta.userContext === UserType.Admin) {
          const { user } = meta;
          const username = user.fullname;
          return `${username} deposited $${this.utilsService.formatNumberWithCommas(
            Number(tx.amount),
          )}`;
        } else if (meta.userContext === UserType.User) {
          return `You deposited $${this.utilsService.formatNumberWithCommas(
            Number(tx.amount),
          )}`;
        }
        return 'N/A';
      case WalletTransactionContext.Withdrawal:
        if (meta.userContext === UserType.Admin) {
          const { user } = meta;
          const username = user.fullname;
          return `${username} withdrawal $${this.utilsService.formatNumberWithCommas(
            Number(tx.amount),
          )}`;
        } else if (meta.userContext === UserType.User) {
          return `You withdrawal $${this.utilsService.formatNumberWithCommas(
            Number(tx.amount),
          )}`;
        }
        return 'N/A';

      case WalletTransactionContext.Refund: {
        return `You got refund of $${this.utilsService.formatNumberWithCommas(
          Number(tx.amount),
        )} for failed withdrawal request.`;
      }

      default:
        return 'N/A';
    }
  }

  async getAllDepositedAmount(walletId: number) {
    return await this.prisma.walletTransaction.aggregate({
      where: {
        walletId,
        context: 'Deposit',
        status: 'Confirmed',
      },
      _sum: {
        amount: true,
      },
    });
  }
}
