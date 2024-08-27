import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JoinGameDto } from './dto';
import { GamesService } from 'src/games';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server: Server;

  constructor(private readonly gamesService: GamesService) { }

  private async getPayload() {
    const gameIds = await this.gamesService.getActiveGame();
    if (gameIds.length) {
      const [currentGame, nextGame] = await Promise.all([
        this.gamesService.dealtNumbersGame(Number(gameIds[0])),
        gameIds.length > 1
          ? this.gamesService.dealtNumbersGame(Number(gameIds[1]))
          : null,
      ]);
      return {
        numbers: [...new Set(currentGame?.dealt_numbers || [])],
        delay: currentGame?.settings[0]?.delay || 0,
        startDate: currentGame?.startDate || '',
        isStarted: currentGame?.isStarted || false,
        nextStartDate: nextGame?.startDate || '',
      };
    } else {
      return { notAvailable: true };
    }
  }

  async handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
    const payload = await this.getPayload();
    client.emit('payload', payload);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() body: JoinGameDto) {
    console.log({ body });
    this.server.emit('message', body);
  }

  @SubscribeMessage('live')
  async getLiveGame(@ConnectedSocket() client: Socket) {
    const gameIds = await this.gamesService.getActiveGame();
    if (gameIds.length === 0) {
      client.emit('WsError', {
        type: 'Not Found',
        message: 'game not found',
      });
    } else {
      const gameId = gameIds[0].toString();
      client.emit('liveRes', gameId);
    }
  }

  @SubscribeMessage('joinGameClient')
  async handleJoinGameClient(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: string,
  ) {
    const parsedMessage: any =
      typeof message === 'object' ? message : JSON.parse(message);
    let body: JoinGameDto | null = null;
    if (parsedMessage.gameId && parsedMessage.userId) {
      body = parsedMessage;
    }
    if (body) {
      const game = await this.gamesService.getGameById(
        BigInt(Number(body.gameId)),
      );
      if (!game) {
        client.emit('WsError', {
          type: 'Not Found',
          message: 'game not found',
        });
      }
      const gameId = game.id.toString();
      client.join(gameId);
      // join user
      await this.gamesService.joinGameUser({
        userId: Number(body.userId),
        gameId: Number(body.gameId),
      });

      const _game = await this.gamesService.dealtNumbersGame(Number(gameId));
      const payload = {
        numbers: [...new Set(_game?.dealt_numbers || [])],
        startDate: game?.startDate || '',
        isStarted: game?.isStarted || false,
      };
      client.emit('joinedGame', payload);
    } else {
      client.emit('WsError', {
        type: 'Invalid Payload',
        message: 'Invalid Payload',
      });
    }
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(@ConnectedSocket() client: Socket) {
    const gameIds = await this.gamesService.getActiveGame();
    if (gameIds.length === 0) {
      const payload = {
        numbers: [],
        delay: 30000,
        startDate: null,
        isStarted: null,
        nextStartDate: null,
      };
      client.emit('joinedGameError', payload);
    } else {
      const gameId = gameIds[0].toString();
      client.join(gameId);
      const game = await this.gamesService.dealtNumbersGame(Number(gameId));
      const nextGame =
        gameIds.length > 1
          ? await this.gamesService.dealtNumbersGame(Number(gameIds[1]))
          : null;
      const payload = {
        numbers: [...new Set(game?.dealt_numbers || [])],
        delay: game?.settings[0]?.delay || 0,
        startDate: game?.startDate || '',
        isStarted: game?.isStarted || false,
        nextStartDate: nextGame?.startDate || '',
      };
      client.emit('joinedGame', payload);
    }
  }

  @SubscribeMessage('leaveGame')
  async handleLeaveGame(@ConnectedSocket() client: Socket) {
    const gameId = await this.gamesService.getActiveGame();
    if (gameId.length) {
      client.leave(gameId[0].toString());
      client.emit('leftGame', gameId[0].toString());
      console.log(`Client ${client.id} left game ${gameId[0]}`);
    }
  }

  @SubscribeMessage('claim')
  async handleModeClaim(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: string,
  ) {
    const data = typeof body === 'object' ? body : JSON.parse(body);
    const result = await this.gamesService.verifyClaim(data);
    if (result.message === 'Success') {
      const user = await this.gamesService.getUser(Number(data.userId));
      const hallOfFame = await this.gamesService.getHallOfFame(
        Number(data.gameId),
      );
      this.server.to(data.gameId.toString()).emit('leaderboardRes', hallOfFame);
      this.server
        .to(data.gameId.toString())
        .except(client.id)
        .emit(
          'claimSuccessRes',
          `${user?.fullname} just claimed ${data.claim}`,
        );
    }
    client.emit('claimResponse', result);
  }

  private async notifyGameModeLeaderboard(_gameId: number) {
    const gameId = await this.gamesService.getActiveGame();
    if (gameId.length === 0) {
      const id = Number(_gameId);
      const hallOfFame = await this.gamesService.getHallOfFame(id);
      console.log({ hallOfFame, id });
      this.server.to(id.toString()).emit('leaderboardRes', hallOfFame);
      return;
    }
    const id = Number(gameId[0]);
    const hallOfFame = await this.gamesService.getHallOfFame(id);
    console.log({ hallOfFame, gameId });
    this.server.to(id.toString()).emit('leaderboardRes', hallOfFame);
  }

  @SubscribeMessage('leaderboard')
  async handleLeaderBoard(@MessageBody() data: { gameId: number }) {
    const body = typeof data === 'object' ? data : JSON.parse(data);
    await this.notifyGameModeLeaderboard(body.gameId);
  }

  @SubscribeMessage('dealt')
  async handleGetDealtNumbers() {
    const gameId = await this.gamesService.getActiveGame();
    if (gameId.length > 0) {
      const id = gameId[0].toString();
      const game = await this.gamesService.dealtNumbersGame(Number(id));
      const numbers = [...new Set(game?.dealt_numbers || [])];
      this.server.to(id).emit('onDealt', numbers);
    }
  }

  @OnEvent('stop-game', { objectify: true })
  async stopGame(data: { id: number }) {
    const payload = await this.getPayload();
    this.server.to(data.id.toString()).emit('payload', payload);
  }

  @OnEvent('start')
  async dealNumbersForGame() {
    console.log('/* Dealing numbers */');
    const gameIds = await this.gamesService.getActiveGame();
    if (gameIds.length === 0) {
      this.server.emit('WsError', {
        type: 'Not Found',
        message: 'game not found',
      });
      return;
    }

    const game = await this.gamesService.getGameById(gameIds[0]);
    if (game) {
      await this.gamesService.startGame(Number(game.id));
      await this.gamesService.updateGameResumeStatus(
        Number(game.id),
        false,
        true,
      );
    }

    const payload = await this.getPayload();
    this.server.to(Number(game.id).toString()).emit('payload', payload);
    this.server.emit('payload', payload);

    const delay = game.settings[0]?.delay || 20000;
    for (let i = 0; i < game.numbers.split(',').map(Number).length; i++) {
      const isStopped = await this.gamesService.isGameStopped(Number(game.id));
      if (isStopped) {
        console.log('Game stopped');
        this.server
          .to(Number(game.id).toString())
          .emit('stopped', await this.getPayload());
        return;
      }

      const number = game.numbers.split(',').map(Number)[i];
      const dealt = await this.gamesService.dealtNumbersGame(Number(game.id));
      if (dealt && dealt.dealt_numbers.includes(Number(number))) {
        console.log(`Number ${number} already dealt`);
        continue;
      }

      console.log(`Dealing number ${number}`);
      await this.gamesService.dealNumber({
        id: BigInt(Number(game.id)),
        number: Number(number),
        index: i,
      });
      this.server
        .to(Number(game.id).toString())
        .emit('dealEvent', number.toString());

      for (let j = delay / 1000; j > 0; j--) {
        if (await this.gamesService.isGameStopped(Number(game.id))) break;
        await this.gamesService.delay(1000);
        this.server.to(Number(game.id).toString()).emit('counter', j);
      }
    }

    await this.gamesService.endGame(BigInt(game.id));
  }

  @OnEvent('game.ended', { objectify: true })
  async gameEndedNotify(data: { id: number }) {
    console.log({ data });
  }

  @OnEvent('secondsEvent', { objectify: true })
  sendSeconds(data: { seconds: number; id: number }) {
    this.server.to(data.id.toString()).emit('seconds', data.seconds);
  }

  @OnEvent('start-game', { objectify: true })
  async sendStartAck(data: { id: number }) {
    const id = data.id;
    this.server.to(id.toString()).emit('payload', await this.getPayload());
  }
}
