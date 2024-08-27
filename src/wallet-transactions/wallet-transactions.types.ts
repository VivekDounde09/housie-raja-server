import { User, WalletTransactionContext } from '@prisma/client';
import { UserType } from '@Common';

type BaseContextMeta =
  | { userContext: typeof UserType.Admin; user: User }
  | { userContext: typeof UserType.User };

export type DepositContextMeta = BaseContextMeta & {
  context: typeof WalletTransactionContext.Deposit;
};

export type RefundContextMeta = BaseContextMeta & {
  context: typeof WalletTransactionContext.Refund;
};

type WithdrawalContextMeta = BaseContextMeta & {
  context: typeof WalletTransactionContext.Withdrawal;
};

export type WalletTransactionContextMeta =
  | DepositContextMeta
  | WithdrawalContextMeta
  | RefundContextMeta;
