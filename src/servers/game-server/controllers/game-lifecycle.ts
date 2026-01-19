import { GameName } from "../../../aliases.js";
import { MyGameClass } from "../../../game/index.js";
import {
  MessageFromServer,
  MessageFromServerType,
} from "../../../messages/from-server.js";
import { GameRegistry } from "../../game-registry/index.js";
import { MessageDispatchFactory } from "../../message-delivery/message-dispatch-factory.js";
import { MessageDispatchOutbox } from "../../message-delivery/outbox.js";
import { ActiveGameStatus } from "../../services/game-session-store/active-game-status.js";
import { GameSessionStoreService } from "../../services/game-session-store/index.js";
import { PendingReconnectionStoreService } from "../../services/pending-reconnection-store/index.js";
import { UserSessionRegistry } from "../../sessions/user-session-registry.js";
import { UserSession } from "../../sessions/user-session.js";

export class GameServerGameLifecycleController {
  constructor(
    private readonly gameRegistry: GameRegistry,
    private readonly userSessionRegistry: UserSessionRegistry,
    private readonly gameSessionStoreService: GameSessionStoreService,
    private readonly pendingReconnectionStoreService: PendingReconnectionStoreService,
    private readonly updateDispatchFactory: MessageDispatchFactory<MessageFromServer>
  ) {}

  async getOrInitializeGame(gameName: GameName) {
    const existingGame = this.gameRegistry.getGameOption(gameName);
    if (existingGame) {
      return existingGame;
    }
    return await this.initializeExpectedPendingGame(gameName);
  }

  private async initializeExpectedPendingGame(gameName: GameName) {
    const pendingGameSetupOption =
      await this.gameSessionStoreService.getPendingGameSetup(gameName);
    if (pendingGameSetupOption === null) {
      throw new Error(
        "A user presented a token with a game id that didn't match any existing game or pending game setup."
      );
    }

    const newGame = pendingGameSetupOption.game;
    this.gameRegistry.registerGame(newGame);
    this.gameSessionStoreService.deletePendingGameSetup(newGame.name);

    this.gameSessionStoreService.writeActiveGameStatus(
      newGame.name,
      new ActiveGameStatus(newGame.name, newGame.id)
    );

    return newGame;
  }

  async joinGameHandler(gameName: GameName, session: UserSession) {
    const game = this.gameRegistry.requireGame(gameName);
    game.playerRegistry.requirePlayer(session.username);

    session.setCurrentGame(game.name);
    session.subscribeToChannel(game.getChannelName());

    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateDispatchFactory
    );

    // if they are reconnecting their client would have lost the game information
    // could avoid sending it if this is a connection from the lobby though
    // for simplicity we'll eat the performance cost until it is measured
    outbox.pushToConnection(session.connectionId, {
      type: MessageFromServerType.GameFullUpdate,
      data: { game: game.getSerialized() },
    });

    // clients should handle this differently than in the lobby
    // and just mark this player as connected in their client
    outbox.pushToChannel(
      game.getChannelName(),
      {
        type: MessageFromServerType.PlayerJoinedGame,
        data: { username: session.username },
      },
      { excludedIds: [session.connectionId] }
    );

    const allPlayersAreConnectedToGame =
      this.allPlayersAreConnectedToGame(game);
    const gameHasNotYetStarted = game.timeStarted === null;

    if (gameHasNotYetStarted && allPlayersAreConnectedToGame) {
      const startGameOutbox = await this.startGame(game);
      outbox.pushFromOther(startGameOutbox);
    }

    game.inputLock.remove(session.taggedUserId.id);

    return outbox;
  }

  private async startGame(game: MyGameClass) {
    game.setAsStarted();

    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateDispatchFactory
    );
    outbox.pushToChannel(game.getChannelName(), {
      type: MessageFromServerType.GameStarted,
      data: { timeStarted: game.requireTimeStarted() },
    });

    return outbox;
  }

  private allPlayersAreConnectedToGame(game: MyGameClass) {
    let result = true;
    for (const [username, player] of Array.from(game.playerRegistry.players)) {
      const sessions = this.userSessionRegistry.getSessionsByUsername(username);
      if (sessions.length === 0) {
        result = false;
        break;
      }
    }

    return result;
  }

  async leaveGameHandler(session: UserSession) {
    const game = session.getExpectedCurrentGame();
    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateDispatchFactory
    );
    outbox.pushToChannel(game.getChannelName(), {
      type: MessageFromServerType.PlayerLeftGame,
      data: { username: session.username },
    });

    game.playerRegistry.requirePlayer(session.username);
    game.playerRegistry.removePlayer(session.username);

    if (game.playerRegistry.isEmpty()) {
      this.handleGameEnded(game);
    }

    return outbox;
  }

  private handleGameEnded(game: MyGameClass) {
    this.gameRegistry.unregisterGame(game.name);
    this.gameSessionStoreService.deleteActiveGameStatus(game.name);
    this.pendingReconnectionStoreService.deleteAllInGame(game.name);
  }
}
