import { GameServerName } from "../../aliases.js";
import {
  MessageFromServer,
  MessageFromServerType,
} from "../../messages/from-server.js";
import {
  localServerUrl,
  TEST_GAME_SERVER_PORT,
} from "../../tests/fixtures/test-servers-setup.js";
import { MessageDispatchFactory } from "../message-delivery/message-dispatch-factory.js";
import { MessageDispatchOutbox } from "../message-delivery/outbox.js";
import {
  ConnectionContextType,
  PlayerReconnectionProtocol,
} from "../reconnection-protocol.js";
import { GameServerReconnectionForwardingRecord } from "../services/game-server-reconnection-forwarding-record/game-server-reconnection-forwarding-record.js";
import { GameServerReconnectionForwardingRecordStoreService } from "../services/game-server-reconnection-forwarding-record/index.js";
import { GameSessionStoreService } from "../services/game-session-store/index.js";
import { UserSession } from "../sessions/user-session.js";
import {
  GameServerSessionClaimToken,
  GameServerSessionClaimTokenCodec,
} from "./game-handoff/game-server-session-claim-token.js";

interface LobbyReconnectionContext {
  type: ConnectionContextType.Reconnection;
  issueCredentials: () => Promise<MessageDispatchOutbox<MessageFromServer>>;
}

interface LobbyInitialConnectionContext {
  type: ConnectionContextType.InitialConnection;
}

export type LobbyConnectionContext =
  | LobbyReconnectionContext
  | LobbyInitialConnectionContext;

export class LobbyReconnectionProtocol implements PlayerReconnectionProtocol {
  constructor(
    private readonly gameServerSessionClaimTokenCodec: GameServerSessionClaimTokenCodec,
    private readonly updateDispatchFactory: MessageDispatchFactory<MessageFromServer>,
    private readonly gameSessionStoreService: GameSessionStoreService,
    private readonly gameServerReconnectionForwardingRecordStoreService: GameServerReconnectionForwardingRecordStoreService
  ) {}

  async evaluateConnectionContext(
    session: UserSession
  ): Promise<LobbyConnectionContext> {
    // we will rely on the game server to delete the disconnectedSession when it is claimed or expires
    // in the event that it expires after we issue the claim token and before the user presents it, we will
    // not accept their reconnection to the game server. the reason I didn't want to delete it here is because
    // the game server needs to know when the disconnectedSession expires or is claimed so it can remove the
    // input lock's RC for that user in the game. also, if they get their claim token then disconnect before
    // reconnecting to the game server they won't be able to reconnect again if we delete it now.
    const gameServerReconnectionForwardingRecordOption =
      await this.getGameServerReconnectionForwardingRecordOption(session);

    if (!gameServerReconnectionForwardingRecordOption) {
      return { type: ConnectionContextType.InitialConnection };
    }

    const gameStillExists =
      await this.gameSessionStoreService.getActiveGameStatus(
        gameServerReconnectionForwardingRecordOption.gameName
      );

    if (!gameStillExists) {
      return { type: ConnectionContextType.InitialConnection };
    }

    return {
      type: ConnectionContextType.Reconnection,
      issueCredentials: async () =>
        await this.issueReconnectionCredential(
          session,
          gameServerReconnectionForwardingRecordOption
        ),
    };
  }

  async issueReconnectionCredential(
    session: UserSession,
    gameServerReconnectionForwardingRecord: GameServerReconnectionForwardingRecord
  ) {
    const outbox = new MessageDispatchOutbox(this.updateDispatchFactory);
    const claimToken = new GameServerSessionClaimToken(
      gameServerReconnectionForwardingRecord.gameName,
      session.username,
      gameServerReconnectionForwardingRecord.taggedUserId,
      gameServerReconnectionForwardingRecord.guestUserReconnectionTokenOption ||
        undefined
    );

    const encryptedSessionClaimToken =
      await this.gameServerSessionClaimTokenCodec.encode(claimToken);

    const url = this.getGameServerUrlFromName(
      gameServerReconnectionForwardingRecord.gameServerName
    );

    outbox.pushToConnection(session.connectionId, {
      type: MessageFromServerType.GameServerConnectionInstructions,
      data: {
        connectionInstructions: {
          url,
          encryptedSessionClaimToken,
        },
      },
    });

    const { username, taggedUserId, connectionId } = session;
    // console.info(
    //   `-- ${username} (user id: ${taggedUserId.id}, connection id: ${connectionId}) was given instructions to reconnect to server ${gameServerReconnectionForwardingRecord.gameServerName} at url ${url}`
    // );

    return outbox;
  }

  onPlayerDisconnected(
    ...args: any[]
  ): MessageDispatchOutbox<MessageFromServer> {
    throw new Error("Method not implemented.");
  }

  private getGameServerUrlFromName(name: GameServerName) {
    return localServerUrl(TEST_GAME_SERVER_PORT);
  }

  attemptReconnectionClaim(...args: any[]): Promise<void> {
    throw new Error("Method not implemented.");
  }

  private async getGameServerReconnectionForwardingRecordOption(
    session: UserSession
  ) {
    const keyOption = session.getReconnectionKeyOption();
    if (keyOption === null) {
      return null;
    }
    const gameServerReconnectionForwardingRecord =
      await this.gameServerReconnectionForwardingRecordStoreService.getGameServerReconnectionForwardingRecord(
        keyOption
      );
    return gameServerReconnectionForwardingRecord;
  }
}
