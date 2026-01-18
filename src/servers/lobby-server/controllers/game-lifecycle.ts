import { GameId, GameName } from "../../../aliases.js";
import { ERROR_MESSAGES } from "../../../error-messages.js";
import { MyGameClass } from "../../../game/index.js";
import {
  RANDOM_GAME_NAMES_FIRST,
  RANDOM_GAME_NAMES_LAST,
} from "../../../game/random-game-names.js";
import {
  MessageFromServer,
  MessageFromServerType,
} from "../../../messages/from-server.js";
import { ArrayUtils } from "../../../utils/array.js";
import { IdGenerator } from "../../../utils/id-generator.js";
import { GameRegistry } from "../../game-registry/index.js";
import { MessageDispatchFactory } from "../../message-delivery/message-dispatch-factory.js";
import { MessageDispatchOutbox } from "../../message-delivery/outbox.js";
import { GameSessionStoreService } from "../../services/game-session-store/index.js";
import { UserSessionRegistry } from "../../sessions/user-session-registry.js";
import { UserSession } from "../../sessions/user-session.js";

export class LobbyGameLifecycleController {
  private readonly idGenerator = new IdGenerator<GameId>();

  constructor(
    private readonly gameRegistry: GameRegistry,
    private readonly userSessionRegistry: UserSessionRegistry,
    private readonly updateDispatchFactory: MessageDispatchFactory<MessageFromServer>,
    private readonly gameSessionStoreService: GameSessionStoreService,
    private readonly gameHandoffManager: GameHandoffManager
  ) {}

  private generateRandomGameName(): GameName {
    const firstName = ArrayUtils.chooseRandom(RANDOM_GAME_NAMES_FIRST);
    const lastName = ArrayUtils.chooseRandom(RANDOM_GAME_NAMES_LAST);
    return `${firstName} ${lastName}` as GameName;
  }

  async createGameHandler(session: UserSession) {
    session.tryGetJoinNewGamePermission();

    // optimization left as exercise for the reader
    let gameName: GameName = this.generateRandomGameName();
    // and try again a safe number of times before failing
    const maxAttempts = 10;
    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
      gameName = this.generateRandomGameName();
      // check if game name exists in lobby or on another game server
      const noGameExistsByThisName = !(await this.gameExistsByName(gameName));

      if (noGameExistsByThisName) {
        break;
      }
    }

    const gameByThisNameExists =
      this.gameRegistry.getGameOption(gameName) !== undefined;
    if (gameByThisNameExists) {
      throw new Error(ERROR_MESSAGES.GAME.ALREADY_EXISTS);
    }

    const game = new MyGameClass(this.idGenerator.generate(), gameName);
    this.gameRegistry.registerGame(game);

    const joinGameUpdateHandlerOutbox = await this.joinGameHandler(
      gameName,
      session
    );
    return joinGameUpdateHandlerOutbox;
  }

  async joinGameHandler(gameName: GameName, session: UserSession) {
    const game = this.gameRegistry.requireGame(gameName);
    session.tryGetJoinNewGamePermission();

    const gameAlreadyHandedOff = game.timeHandedOff !== null;
    if (gameAlreadyHandedOff) {
      throw new Error(ERROR_MESSAGES.GAME.ALREADY_HANDED_OFF);
    }

    session.setCurrentGame(game.name);

    game.playerRegistry.registerPlayerFromLobbyUser(session.username);

    session.subscribeToChannel(game.getChannelName());

    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateDispatchFactory
    );

    // give the client the game information of the game they joined
    outbox.pushToConnection(session.connectionId, {
      type: MessageFromServerType.GameFullUpdate,
      data: { game: game.getSerialized() },
    });

    // tell clients already in the game that someone joined
    outbox.pushToChannel(
      game.getChannelName(),
      {
        type: MessageFromServerType.PlayerJoinedGame,
        data: { username: session.username },
      },
      { excludedIds: [session.connectionId] }
    );

    return outbox;
  }

  async leaveGameHandler(session: UserSession) {
    const game = session.getExpectedCurrentGame();

    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateDispatchFactory
    );

    game.playerRegistry.removePlayer(session.username);
    session.currentGameName = null;
    session.unsubscribeFromChannel(game.getChannelName());

    outbox.pushToConnection(session.connectionId, {
      type: MessageFromServerType.GameFullUpdate,
      data: { game: null },
    });

    if (game.playerRegistry.isEmpty()) {
      this.gameRegistry.unregisterGame(game.name);
      return outbox; // no one is left to notify about the player leaving so return early
    }

    outbox.pushToChannel(game.getChannelName(), {
      type: MessageFromServerType.PlayerLeftGame,
      data: { username: session.username },
    });

    return outbox;
  }

  async toggleReadyToStartGameHandler(session: UserSession) {
    const game = session.getExpectedCurrentGame();

    game.requireGameStartPrerequisites();

    game.playerRegistry.requirePlayer(session.username);

    const allPlayersReadied = game.togglePlayerReadyToStartGameStatus(
      session.username
    );

    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateDispatchFactory
    );
    outbox.pushToChannel(game.getChannelName(), {
      type: MessageFromServerType.PlayerToggledReadyToStartGame,
      data: { username: session.username },
    });

    const notAllPlayersAreReady = !allPlayersReadied;
    if (notAllPlayersAreReady) {
      return outbox;
    }

    game.setAsHandedOff();

    const connectionInstructions =
      await this.gameHandoffManager.initiateGameHandoff(game);
    outbox.pushFromOther(connectionInstructions);

    return outbox;
  }

  async gameExistsByName(gameName: GameName) {
    const lobbyGameExistsByThisName = this.gameRegistry.getGameOption(gameName);
    if (lobbyGameExistsByThisName) {
      return true;
    }

    const pendingGameExistsByThisName =
      await this.gameSessionStoreService.getPendingGameSetup(gameName);
    if (pendingGameExistsByThisName) {
      return true;
    }

    const activeGameExistsByThisName =
      await this.gameSessionStoreService.getActiveGameStatus(gameName);
    if (activeGameExistsByThisName) {
      return true;
    }

    return false;
  }
}
