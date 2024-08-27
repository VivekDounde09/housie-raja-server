import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const admin: Prisma.AdminCreateInput = {
  firstname: '',
  lastname: '',
  email: process.env.ADMIN_EMAIL || '',
  meta: {
    create: {
      passwordSalt: process.env.ADMIN_PASSWORD_SALT || '',
      passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
    },
  },
  AdminWallet: {
    create: {
      amount: new Decimal(0),
    },
  },
};
