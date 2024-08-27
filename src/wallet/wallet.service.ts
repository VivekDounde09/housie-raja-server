import { UserType, UtilsService } from '@Common';
import { Injectable } from '@nestjs/common';
import {
  AdminWallet,
  Prisma,
  UserWallet,
  WalletTransaction,
  WalletTransactionContext,
  WalletTransactionType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma';
import { WalletTransactionsService } from 'src/wallet-transactions/wallet-transactions.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utilsService: UtilsService,
    private readonly walletTransactionsService: WalletTransactionsService,
  ) {}

  private async getAdmin() {
    return await this.prisma.admin.findFirst({
      include: {
        AdminWallet: {
          select: {
            amount: true,
          },
        },
      },
    });
  }

  async getById(
    walletId: bigint,
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<UserWallet> {
    const client = options?.tx ? options.tx : this.prisma;
    return await client.userWallet.findUniqueOrThrow({
      where: { id: walletId },
    });
  }

  async getBalanceUser(userId: bigint, type: UserType) {
    const wallet = (await this.getByUserId(userId, type)) as UserWallet;
    const transaction =
      await this.walletTransactionsService.getAllDepositedAmount(
        Number(wallet.id),
      );
    const deposited = transaction._sum.amount || new Decimal(0);
    const referral = wallet.referral_amount;
    return { walletBalance: wallet.amount, deposited, referral };
  }

  async getBalance(userId: bigint, type: UserType) {
    const wallet = await this.getByUserId(userId, type);
    return wallet.amount;
  }

  async getByUserId(
    id: bigint,
    type: UserType,
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<UserWallet | AdminWallet> {
    const client = options?.tx ? options.tx : this.prisma;
    return type === UserType.User
      ? await client.userWallet.findUniqueOrThrow({
          where: { userId: id },
        })
      : await client.adminWallet.findUniqueOrThrow({
          where: { adminId: id },
        });
  }

  async create(userId: bigint, options?: { tx?: Prisma.TransactionClient }) {
    const client = options?.tx ? options.tx : this.prisma;
    const wallet = await client.userWallet.create({
      data: {
        userId,
      },
    });
    return wallet;
  }

  // TODO: Need to implement application level lock mechanism
  async addBalance(
    userId: bigint,
    amount: Prisma.Decimal,
    options: {
      tx: Prisma.TransactionClient;
      context: WalletTransactionContext;
      entityId?: bigint;
    },
  ) {
    const client = options.tx;
    // Remove sign
    amount = amount.abs();
    if (amount.eq(0)) {
      throw new Error('Amount should not be non zero');
    }

    return await this.utilsService.occrunnable(async () => {
      const wallet = await this.getByUserId(userId, UserType.User, {
        tx: options.tx,
      });
      const updatedWallet = await client.userWallet.update({
        data: {
          amount: {
            increment: amount,
          },
        },
        where: {
          id: wallet.id,
        },
      });

      await this.walletTransactionsService.create(
        {
          context: options.context,
          walletId: wallet.id,
          type: WalletTransactionType.Credit,
          amount,
          availableBalance: updatedWallet.amount,
          timestamp: updatedWallet.updatedAt,
          entityId: options.entityId,
        },
        { tx: options.tx },
      );

      return updatedWallet;
    });
  }

  // TODO: Need to implement application level lock mechanism
  async subtractBalance(
    userId: bigint,
    amount: Prisma.Decimal,
    options: {
      tx: Prisma.TransactionClient;
      context: WalletTransactionContext;
      entityId?: bigint;
    },
  ) {
    const client = options.tx;

    // Remove sign
    amount = amount.abs();
    if (amount.eq(0)) {
      throw new Error('Amount should not be non zero');
    }

    return await this.utilsService.occrunnable(async () => {
      const wallet = await this.getByUserId(userId, UserType.User, {
        tx: options.tx,
      });
      const newAmount = wallet.amount.sub(amount);
      if (newAmount.lessThan(0)) {
        throw new Error('Insufficient balance. Please charge your wallet');
      }

      const updatedWallet = await client.userWallet.update({
        data: {
          amount: newAmount,
        },
        where: {
          id: wallet.id,
        },
      });
      await this.walletTransactionsService.create(
        {
          context: options.context,
          walletId: wallet.id,
          type: WalletTransactionType.Debit,
          amount,
          availableBalance: updatedWallet.amount,
          timestamp: updatedWallet.updatedAt,
          entityId: options.entityId,
        },
        { tx: options.tx },
      );
      return updatedWallet;
    });
  }

  async addReferralBalance(
    userId: bigint,
    amount: Prisma.Decimal,
    options: {
      tx: Prisma.TransactionClient;
      context: WalletTransactionContext;
      entityId?: bigint;
    },
  ) {
    const client = options.tx;
    // Remove sign
    amount = amount.abs();
    if (amount.eq(0)) {
      throw new Error('Amount should not be non zero');
    }

    return await this.utilsService.occrunnable(async () => {
      const wallet = await this.getByUserId(userId, UserType.User, {
        tx: options.tx,
      });
      const updatedWallet = await client.userWallet.update({
        data: {
          referral_amount: {
            increment: amount,
          },
        },
        where: {
          id: wallet.id,
        },
      });

      await this.walletTransactionsService.create(
        {
          context: options.context,
          walletId: wallet.id,
          type: WalletTransactionType.Credit,
          amount,
          availableBalance: updatedWallet.amount,
          timestamp: updatedWallet.updatedAt,
          entityId: options.entityId,
        },
        { tx: options.tx },
      );

      return updatedWallet;
    });
  }

  // TODO: Need to implement application level lock mechanism
  async subtractReferralBalance(
    userId: bigint,
    amount: Prisma.Decimal,
    options: {
      tx: Prisma.TransactionClient;
      context: WalletTransactionContext;
      entityId?: bigint;
    },
  ) {
    const client = options.tx;

    // Remove sign
    amount = amount.abs();
    if (amount.eq(0)) {
      throw new Error('Amount should not be non zero');
    }

    return await this.utilsService.occrunnable(async () => {
      const wallet: UserWallet = (await this.getByUserId(
        userId,
        UserType.User,
        {
          tx: options.tx,
        },
      )) as UserWallet;
      const newAmount = wallet.referral_amount.sub(amount);
      if (newAmount.lessThan(0)) {
        throw new Error('Insufficient balance. Please charge your wallet');
      }

      const updatedWallet = await client.userWallet.update({
        data: {
          referral_amount: newAmount,
        },
        where: {
          id: wallet.id,
        },
      });
      await this.walletTransactionsService.create(
        {
          context: options.context,
          walletId: wallet.id,
          type: WalletTransactionType.Debit,
          amount,
          availableBalance: updatedWallet.amount,
          timestamp: updatedWallet.updatedAt,
          entityId: options.entityId,
        },
        { tx: options.tx },
      );
      return updatedWallet;
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
    return await this.walletTransactionsService.getAll(options, userId);
  }
}
