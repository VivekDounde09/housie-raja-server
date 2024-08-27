import { registerAs } from '@nestjs/config';
export const sheetConfigFactory = registerAs('sheet', () => ({
  numberOfTickets: 6,
}));
