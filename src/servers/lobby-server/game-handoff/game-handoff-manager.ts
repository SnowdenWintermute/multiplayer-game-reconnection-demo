import cloneDeep from "lodash.clonedeep";
import { ConnectionId, GameName } from "../../../aliases.js";
import { GameSessionStoreService } from "../../services/game-session-store/index.js";
import { PendingGameSetup } from "../../services/game-session-store/pending-game-setup.js";
import { UserSessionRegistry } from "../../sessions/user-session-registry.js";
import { UserSession } from "../../sessions/user-session.js";
import { MessageDispatchFactory } from "../../message-delivery/message-dispatch-factory.js";
import {
  MessageFromServer,
  MessageFromServerType,
} from "../../../messages/from-server.js";
import {
  GameServerSessionClaimToken,
  GameServerSessionClaimTokenCodec,
} from "./game-server-session-claim-token.js";
import { MyGameClass } from "../../../game/index.js";
import { MessageDispatchOutbox } from "../../message-delivery/outbox.js";

export class GameHandoffManager {
  constructor(
    private readonly userSessionRegistry: UserSessionRegistry,
    private readonly updateFactory: MessageDispatchFactory<MessageFromServer>,
    private readonly gameSessionStoreService: GameSessionStoreService,
    private readonly gameServerSessionClaimTokenCodec: GameServerSessionClaimTokenCodec
  ) {}

  private getPlayerSessionsInGame(game: MyGameClass) {
    const result: UserSession[] = [];

    for (const [username, player] of game.playerRegistry.players) {
      const session =
        this.userSessionRegistry.getExpectedSessionInGameByUsername(
          username,
          game.name
        );

      result.push(session);
    }

    return result;
  }

  private prepareClaimTokens(sessions: UserSession[], gameName: GameName) {
    const claimTokensByConnectionId = new Map<
      ConnectionId,
      GameServerSessionClaimToken
    >();

    for (const session of sessions) {
      const claimToken = new GameServerSessionClaimToken(
        gameName,
        session.username,
        session.taggedUserId,
        session.getGuestReconnectionTokenOption() || undefined
      );
      claimTokensByConnectionId.set(session.connectionId, claimToken);
    }

    return claimTokensByConnectionId;
  }

  async initiateGameHandoff(game: MyGameClass) {
    // @TODO - resolve to a placeholder url for a single static test server
    // - getLeastBusyGameServerOrProvisionOne()
    const leastBusyServerUrl = "";

    await this.gameSessionStoreService.writePendingGameSetup(
      game.name,
      // if we don't clone, player list will be mutated when players disconnect causing
      // error of "no players in game" when they try to join as their player on the game server
      new PendingGameSetup(cloneDeep(game))
    );

    const sessionsInGame = this.getPlayerSessionsInGame(game);
    const claimTokens = this.prepareClaimTokens(sessionsInGame, game.name);

    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateFactory
    );

    for (const [connectionId, token] of claimTokens) {
      const encryptedToken =
        await this.gameServerSessionClaimTokenCodec.encode(token);
      outbox.pushToConnection(connectionId, {
        type: MessageFromServerType.GameServerConnectionInstructions,
        data: {
          connectionInstructions: {
            url: leastBusyServerUrl, // game server url
            encryptedSessionClaimToken: encryptedToken,
          },
        },
      });
    }

    // currently we assume the game will be removed from the lobby's registry
    // once the last player client disconnects to go join it

    return outbox;
  }
}
