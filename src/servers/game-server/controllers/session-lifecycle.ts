import { UserSessionRegistry } from "../../sessions/user-session-registry.js";
import { UserSession } from "../../sessions/user-session.js";
import { ConnectionId, Milliseconds } from "../../../aliases.js";
import { SessionLifecycleController } from "../../controllers/user-session-lifecycle.js";
import {
  MessageFromServer,
  MessageFromServerType,
} from "../../../messages/from-server.js";
import { GameRegistry } from "../../game-registry/index.js";
import { MessageDispatchFactory } from "../../message-delivery/message-dispatch-factory.js";
import { GameServerSessionClaimTokenCodec } from "../../lobby-server/game-handoff/game-server-session-claim-token.js";
import { ConnectionIdentityResolutionContext } from "../../services/identity-provider/index.js";
import { MessageDispatchOutbox } from "../../message-delivery/outbox.js";

export class GameServerSessionLifecycleController implements SessionLifecycleController<MessageFromServer> {
  private expirableUsedNonceRecords = new Map<string, Milliseconds>();

  constructor(
    private readonly userSessionRegistry: UserSessionRegistry,
    private readonly gameRegistry: GameRegistry,
    private readonly updateDispatchFactory: MessageDispatchFactory<MessageFromServer>,
    private readonly gameServerSessionClaimTokenCodec: GameServerSessionClaimTokenCodec
  ) {}

  async createSession(
    connectionId: ConnectionId,
    context: ConnectionIdentityResolutionContext
  ): Promise<UserSession> {
    const sessionClaimTokenOption = context.encodedGameServerSessionClaimToken;
    if (sessionClaimTokenOption === undefined) {
      throw new Error(
        "No token was provided when attempting to join the game server"
      );
    }

    const decryptedToken = await this.gameServerSessionClaimTokenCodec.decode(
      sessionClaimTokenOption
    );

    const tokenIsExpired = Date.now() > decryptedToken.expirationTimestamp;
    if (tokenIsExpired) {
      throw new Error(
        "User presented an expired token when attempting to join the game server"
      );
    }

    // clean up old used nonce records
    const now = Date.now();
    for (const [nonce, expirationTimestamp] of this.expirableUsedNonceRecords) {
      const nonceUseRecordIsExpired = expirationTimestamp < now;
      if (nonceUseRecordIsExpired) {
        this.expirableUsedNonceRecords.delete(nonce);
      }
    }

    const { nonce } = decryptedToken;
    if (this.expirableUsedNonceRecords.has(nonce)) {
      throw new Error("Token replay attack suspected");
    }
    this.expirableUsedNonceRecords.set(
      nonce,
      decryptedToken.expirationTimestamp
    );

    // it is possible to be given a reconnection token in two separate browser tabs
    // while the disconnection record is live in the central store, and there would be
    // undefined behavior if a user tried to claim a session while already in a game
    if (
      this.userSessionRegistry.userIsAlreadyConnected(
        decryptedToken.taggedUserId.id
      )
    ) {
      throw new Error(
        "Only one connection per user is permitted on a single game server"
      );
    }

    const newSession = new UserSession(
      decryptedToken.username,
      connectionId,
      decryptedToken.taggedUserId,
      this.gameRegistry
    );

    if (decryptedToken.reconnectionTokenOption) {
      console.log(
        `setting reconnectionTokenOption ${decryptedToken.reconnectionTokenOption}`
      );
      newSession.setGuestReconnectionToken(
        decryptedToken.reconnectionTokenOption
      );
    }

    newSession.currentGameName = decryptedToken.gameName;

    return newSession;
  }

  async activateSession(
    session: UserSession
  ): Promise<MessageDispatchOutbox<MessageFromServer>> {
    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateDispatchFactory
    );
    this.userSessionRegistry.register(session);

    // tell the client their username since if they are a reconnecting guest they will have some random
    // username from the lobby and we want to give them the username they disconnected with
    outbox.pushToConnection(session.connectionId, {
      type: MessageFromServerType.ClientUsername,
      data: { username: session.username },
    });
    return outbox;
  }

  async cleanupSession(session: UserSession) {
    const outbox = new MessageDispatchOutbox(this.updateDispatchFactory);
    this.userSessionRegistry.unregister(session.connectionId);
    return outbox;
  }
}
