import { UtilsService } from '@Common';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PaymentContext,
  PaymentMode,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utilsService: UtilsService,
  ) {}

  async createPayment(data: {
    amount: number;
    ctx: PaymentContext;
    entityId: number;
    mode: PaymentMode;
    purchaseId: number;
    userId: number;
  }) {
    const { amount, ctx, entityId, mode, purchaseId, userId } = data;
    const payment = await this.prisma.$transaction(async (tx) => {
      const _payment = await tx.payment.create({
        data: {
          amount: new Decimal(amount),
          ctx,
          entityId,
          mode,
          purchaseId,
          userId,
          status: PaymentStatus.Confirmed,
        },
      });
      await tx.sheetPurchase.update({
        where: { id: purchaseId },
        data: {
          sheets: {
            updateMany: {
              where: {
                sheetPurchaseId: purchaseId,
              },
              data: {
                isPaid: true,
              },
            },
          },
        },
      });
      return _payment;
    });
    if (!payment) {
      throw new BadRequestException('Something went wrong');
    }
    return 'success';
  }

  async getAllPayments(options: {
    skip?: number;
    take?: number;
    fromDate?: Date;
    toDate?: Date;
    order?: Prisma.SortOrder;
    userId?: bigint;
  }) {
    const pagination = {
      skip: options?.skip || 0,
      take: options?.take || 10,
    };
    let where: Prisma.PaymentWhereInput = {
      isDeleted: false,
    };
    if (options.fromDate && options.toDate) {
      where = {
        createdAt: {
          gte: new Date(options.fromDate),
          lte: new Date(options.toDate),
        },
        ...where,
      };
    }
    if (options.userId) {
      where = {
        userId: options.userId,
        ...where,
      };
    }
    const count = await this.prisma.payment.count({ where });
    const payments = await this.prisma.payment.findMany({
      where: { ...where },
      orderBy: {
        createdAt: options.order || 'desc',
      },
      skip: options.skip,
      take: options.take,
    });
    return {
      data: payments,
      count,
      ...pagination,
    };
  }
}
