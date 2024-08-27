import { Prisma, SettingContext, SettingType } from '@prisma/client';

export const settings: Prisma.SettingCreateInput[] = [
  {
    context: SettingContext.System,
    mappedTo: 'referral-amount',
    text: 'Admin referral amount setting',
    description: 'Admin referral amount setting',
    type: SettingType.SingleSelect,
    isDefinedOptions: false,
    default: '5',
  },
];
