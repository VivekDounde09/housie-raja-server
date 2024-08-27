import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { UtilsService } from '@Common';
import { WalletService } from 'src/wallet/wallet.service';
import { PaymentRequestStatus, PaymentRequestType } from '@prisma/client';

@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utilsService: UtilsService,
    private readonly walletService: WalletService,
  ) {}

  async createPaymentRequest(data: {
    amount: number;
    type: PaymentRequestType;
    utr?: string;
    userId: number;
  }) {
    const payReq = await this.prisma.paymentRequest.findFirst({
      where: {
        type: data.type,
        status: PaymentRequestStatus.Pending,
      },
      select: { id: true },
    });
    if (payReq) {
      throw new BadRequestException(
        `Can not create another ${data.type.toLocaleLowerCase()} request until pending requests gets resolved.`,
      );
    }
    try {
      await this.prisma.paymentRequest.create({
        data: {
          amount: data.amount,
          type: data.type,
          utr: data.utr,
          userId: data.userId,
          status: PaymentRequestStatus.Pending,
        },
      });
    } catch (error) {
      throw new BadRequestException('utr must be unique');
    }
    return 'Success';
  }

  async getPaymentRequestById(id: number) {
    const paymentRequest = await this.prisma.paymentRequest.findUnique({
      where: { id },
    });
    if (!paymentRequest) {
      throw new NotFoundException(`Payment request with ID ${id} not found`);
    }
    return paymentRequest;
  }

  async updatePaymentRequest(
    id: number,
    data: {
      amount?: number;
      status?: PaymentRequestStatus;
    },
  ) {
    const payReq = await this.getPaymentRequestById(id);
    if (data.status && data.status !== payReq.status) {
      if (payReq.status !== PaymentRequestStatus.Pending) {
        throw new BadRequestException(
          `Payment request status can only be updated once from 'Pending'. Current status: ${payReq.status}`,
        );
      }

      if (
        data.status === PaymentRequestStatus.Accepted ||
        data.status === PaymentRequestStatus.Rejected
      ) {
        await this.HandlePaymentRequest(data.status, id);
      } else {
        throw new BadRequestException(
          `Invalid status update. Status can only be updated to 'Accepted' or 'Rejected'.`,
        );
      }
    }

    // Proceed to update the payment request with the provided data
    const paymentRequest = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        amount: data.amount,
        status: data.status,
      },
    });

    if (!paymentRequest) {
      throw new NotFoundException(`Payment request with ID ${id} not found`);
    }

    return paymentRequest;
  }

  async deletePaymentRequest(id: number) {
    const paymentRequest = await this.prisma.paymentRequest.delete({
      where: { id },
    });
    if (!paymentRequest) {
      throw new NotFoundException(`Payment request with ID ${id} not found`);
    }
    return paymentRequest;
  }

  async getAllPaymentRequests(options: {
    type?: PaymentRequestType;
    status?: PaymentRequestStatus;
    from?: Date;
    to?: Date;
    skip?: number;
    take?: number;
  }) {
    const { type, status, from, to, skip = 0, take = 10 } = options;
    const filter: any = {};

    if (type) {
      filter.type = type;
    }

    if (status) {
      filter.status = status;
    }

    if (from && to) {
      filter.createdAt = {
        gte: from,
        lte: to,
      };
    } else if (from) {
      filter.createdAt = {
        gte: from,
      };
    } else if (to) {
      filter.createdAt = {
        lte: to,
      };
    }

    const count = await this.prisma.paymentRequest.count({
      where: filter,
    });

    const data = await this.prisma.paymentRequest.findMany({
      where: filter,
      skip,
      take,
    });

    return {
      count,
      data,
      pagination: {
        skip,
        take,
      },
    };
  }

  async HandlePaymentRequest(
    status: PaymentRequestStatus,
    paymentRequestId: number,
  ) {
    const paymentReq = await this.getPaymentRequestById(paymentRequestId);
    switch (status) {
      case PaymentRequestStatus.Accepted: {
        if (paymentReq.type === PaymentRequestType.Deposit) {
          await this.prisma.$transaction(async (tx) => {
            await this.walletService.addBalance(
              paymentReq.userId,
              paymentReq.amount,
              {
                context: 'Deposit',
                tx,
                entityId: paymentReq.id,
              },
            );
          });
        } else {
          await this.prisma.$transaction(async (tx) => {
            await this.walletService.subtractBalance(
              paymentReq.userId,
              paymentReq.amount,
              {
                context: 'Withdrawal',
                tx,
                entityId: paymentReq.id,
              },
            );
          });
        }
        break;
      }
      case PaymentRequestStatus.Rejected: {
        break;
      }
      case PaymentRequestStatus.Pending: {
        break;
      }

      default:
        break;
    }
  }
}
