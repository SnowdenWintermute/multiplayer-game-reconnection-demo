import {
  GameServerName,
  GuestSessionReconnectionToken,
  Milliseconds,
} from "../../../aliases.js";
import { MyGameClass } from "../../../game/index.js";
import {
  MessageFromServer,
  MessageFromServerType,
} from "../../../messages/from-server.js";
import { MessageDispatchFactory } from "../../message-delivery/message-dispatch-factory.js";
import { MessageDispatchOutbox } from "../../message-delivery/outbox.js";
import {
  ConnectionContextType,
  PlayerReconnectionProtocol,
} from "../../reconnection-protocol.js";
import { UserIdType } from "../../services/identity-provider/tagged-user-id.js";
import { PendingReconnectionStoreService } from "../../services/pending-reconnection-store/index.js";
import { PendingReconnection } from "../../services/pending-reconnection-store/pending-reconnection.js";
import { UserSession } from "../../sessions/user-session.js";
import { GameServerGameLifecycleController } from "../controllers/game-lifecycle.js";
import { ReconnectionOpportunityManager } from "./reconnection-opportunity-manager.js";
import { ReconnectionOpportunity } from "./reconnection-opportunity.js";
import { randomBytes } from "crypto";

export const RECONNECTION_OPPORTUNITY_TIMEOUT_MS = (1000 * 120) as Milliseconds;

interface GameServerReconnectionContext {
  type: ConnectionContextType.Reconnection;
  attemptReconnectionClaim: () => Promise<void>;
}

interface GameServerInitialConnectionContext {
  type: ConnectionContextType.InitialConnection;
}

export type GameServerConnectionContext =
  | GameServerReconnectionContext
  | GameServerInitialConnectionContext;

export class GameServerReconnectionProtocol implements PlayerReconnectionProtocol {
  constructor(
    private readonly updateDispatchFactory: MessageDispatchFactory<MessageFromServer>,
    private readonly pendingReconnectionStoreService: PendingReconnectionStoreService,
    private readonly reconnectionOpportunityManager: ReconnectionOpportunityManager,
    private readonly gameLifecycleController: GameServerGameLifecycleController,
    private readonly dispatchOutboxMessages: (
      outbox: MessageDispatchOutbox<MessageFromServer>
    ) => void
  ) {}

  async evaluateConnectionContext(
    session: UserSession,
    gameIsInProgress: boolean
  ): Promise<GameServerConnectionContext> {
    if (!gameIsInProgress) {
      return { type: ConnectionContextType.InitialConnection };
    } else {
      return {
        type: ConnectionContextType.Reconnection,
        attemptReconnectionClaim: async () =>
          await this.attemptReconnectionClaim(session),
      };
    }
  }

  /** After successful connection guest users will be provided a random bytes token to store on their client. 
      When they reconnect we will use it to find their reconnection opportunity */
  async issueReconnectionCredential(
    session: UserSession
  ): Promise<MessageDispatchOutbox<MessageFromServer>> {
    if (session.taggedUserId.type === UserIdType.Auth) {
      // auth users are reconnected via their auth ID so they don't need a token
      return new MessageDispatchOutbox<MessageFromServer>(
        this.updateDispatchFactory
      );
    }

    const newReconnectionToken = this.generateGuestReconnectionToken();
    session.setGuestReconnectionToken(newReconnectionToken);

    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateDispatchFactory
    );
    outbox.pushToConnection(session.connectionId, {
      type: MessageFromServerType.CacheGuestSessionReconnectionToken,
      data: {
        token: newReconnectionToken,
      },
    });

    return outbox;
  }

  private generateGuestReconnectionToken(): GuestSessionReconnectionToken {
    // base64url creates a string that is able to be sent in query params
    return randomBytes(32).toString(
      "base64url"
    ) as GuestSessionReconnectionToken;
  }

  onPlayerDisconnected(
    session: UserSession,
    gameServerName: GameServerName
  ): MessageDispatchOutbox<MessageFromServer> {
    const outbox = new MessageDispatchOutbox(this.updateDispatchFactory);
    const game = session.getExpectedCurrentGame();

    const { username, taggedUserId } = session;
    // console.info(
    //   `reconnection is permitted, saving a reconnection session for ${username} ${taggedUserId.id}`
    // );

    const pendingReconnection = PendingReconnection.fromUserSession(
      session,
      gameServerName
    );

    this.pendingReconnectionStoreService.writePendingReconnection(
      session.requireReconnectionKey(),
      pendingReconnection
    );

    game.inputLock.add(session.taggedUserId.id);

    outbox.pushToChannel(game.getChannelName(), {
      type: MessageFromServerType.PlayerDisconnectedWithReconnectionOpportunity,
      data: { username: session.username },
    });

    const onReconnectionTimeout = async () => {
      this.reconnectionTimeoutHandler(session, game);
    };

    this.reconnectionOpportunityManager.add(
      session.requireReconnectionKey(),
      new ReconnectionOpportunity(
        RECONNECTION_OPPORTUNITY_TIMEOUT_MS,
        session.username,
        onReconnectionTimeout
      )
    );

    return outbox;
  }

  private async reconnectionTimeoutHandler(
    session: UserSession,
    game: MyGameClass
  ) {
    console.log("running reconnectionTimeoutHandler");
    this.reconnectionOpportunityManager.remove(
      session.requireReconnectionKey()
    );

    try {
      await this.pendingReconnectionStoreService.deletePendingReconnection(
        session.requireReconnectionKey()
      );
    } catch (error) {
      console.error("failed to delete disconnectedSession:", error);
    }

    const reconnectionTimeoutOutbox = new MessageDispatchOutbox(
      this.updateDispatchFactory
    );

    reconnectionTimeoutOutbox.pushToChannel(game.getChannelName(), {
      type: MessageFromServerType.PlayerReconnectionTimedOut,
      data: { username: session.username },
    });

    game.inputLock.remove(session.taggedUserId.id);
    console.log("game inputlock:", game.inputLock);

    const leaveGameHandlerOutbox =
      await this.gameLifecycleController.leaveGameHandler(session);
    reconnectionTimeoutOutbox.pushFromOther(leaveGameHandlerOutbox);

    this.dispatchOutboxMessages(reconnectionTimeoutOutbox);
  }

  async attemptReconnectionClaim(session: UserSession): Promise<void> {
    const reconnectionOpportunityOption =
      this.reconnectionOpportunityManager.get(session.requireReconnectionKey());

    const claimExists = reconnectionOpportunityOption !== undefined;
    const isValidReconnection =
      claimExists && reconnectionOpportunityOption.claim();

    if (!isValidReconnection) {
      throw new Error("Invalid reconnection");
    }

    this.reconnectionOpportunityManager.remove(
      session.requireReconnectionKey()
    );
    await this.pendingReconnectionStoreService.deletePendingReconnection(
      session.requireReconnectionKey()
    );

    // console.info(
    //   `user ${session.username} reconnecting to game ${session.currentGameName}`
    // );

    // give them a username that matches their old one if they are a guest since guest would have
    // some randomly assigned name and we need to give them the name they had when they disconnected
    // so it will match their player in game
    session.username = reconnectionOpportunityOption.username;
    console.log(
      "set reconnected session username:",
      reconnectionOpportunityOption.username
    );
  }
}
