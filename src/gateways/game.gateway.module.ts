import { Module } from '@nestjs/common';
import { GamesModule } from 'src/games';

@Module({
  imports: [GamesModule],
})
export class GamesGatewayModule {}
