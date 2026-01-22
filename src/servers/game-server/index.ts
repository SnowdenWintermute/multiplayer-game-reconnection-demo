import { WebSocketServer, WebSocket } from "ws";
import { GameServerName, Milliseconds } from "../../aliases.js";
import { BaseServer } from "../base-server.js";
import { GameRegistry } from "../game-registry/index.js";
import { GameSessionStoreService } from "../services/game-session-store/index.js";
import { PendingReconnectionStoreService } from "../services/pending-reconnection-store/index.js";
import { UserSession } from "../sessions/user-session.js";
import { GameServerSessionClaimTokenCodec } from "../lobby-server/game-handoff/game-server-session-claim-token.js";
import { ConnectionIdentityResolutionContext } from "../services/identity-provider/index.js";
import { createGameServerMessageFromClientHandlers } from "./create-message-handlers.js";
import {
  HeartbeatScheduler,
  HeartbeatTask,
} from "../../utils/heartbeat-scheduler.js";
import { GameServerGameLifecycleController } from "./controllers/game-lifecycle.js";
import { GameServerSessionLifecycleController } from "./controllers/session-lifecycle.js";
import { ActiveGameStatus } from "../services/game-session-store/active-game-status.js";
import { ReconnectionOpportunityManager } from "./reconnection/reconnection-opportunity-manager.js";
import { GameServerReconnectionProtocol } from "./reconnection/reconnection-protocol.js";
import { invariant } from "../../utils/index.js";
import { ConnectionContextType } from "../reconnection-protocol.js";
import { GameActionsController } from "./controllers/game-actions.js";

export interface GameServerExternalServices {
  gameSessionStoreService: GameSessionStoreService;
  pendingReconnectionStoreService: PendingReconnectionStoreService;
}

const GAME_RECORD_HEARTBEAT_MS = (1000 * 10) as Milliseconds;
const ACTIVE_GAME_RECORD_REFRESH_HEARTBEAT_TASK_NAME = "active games heartbeat";

export class GameServer extends BaseServer {
  private readonly gameRegistry = new GameRegistry();
  private readonly heartbeatScheduler = new HeartbeatScheduler(
    GAME_RECORD_HEARTBEAT_MS
  );

  private readonly reconnectionOpportunityManager =
    new ReconnectionOpportunityManager();
  private readonly reconnectionProtocol: GameServerReconnectionProtocol;

  // controllers
  public readonly gameLifecycleController: GameServerGameLifecycleController;
  public readonly sessionLifecycleController: GameServerSessionLifecycleController;
  public readonly gameActionsController: GameActionsController;

  constructor(
    readonly name: GameServerName,
    private readonly pendingReconnectionStoreService: PendingReconnectionStoreService,
    private readonly gameSessionStoreService: GameSessionStoreService,
    public readonly websocketServer: WebSocketServer,
    private readonly gameServerSessionClaimTokenCodec: GameServerSessionClaimTokenCodec
  ) {
    super(name);

    websocketServer.on("connection", async (socket, request) => {
      const identityResolutionContext =
        await this.parseIdentityContextFromHandshakeRequest(request);
      this.connectionHandler(socket, identityResolutionContext);
    });

    this.startActiveGamesRecordHeartbeat();

    this.gameLifecycleController = new GameServerGameLifecycleController(
      this.gameRegistry,
      this.userSessionRegistry,
      gameSessionStoreService,
      pendingReconnectionStoreService,
      this.updateDispatchFactory
    );

    this.sessionLifecycleController = new GameServerSessionLifecycleController(
      this.userSessionRegistry,
      this.gameRegistry,
      this.updateDispatchFactory,
      this.gameServerSessionClaimTokenCodec
    );

    this.gameActionsController = new GameActionsController(
      this.gameRegistry,
      this.updateDispatchFactory
    );

    this.reconnectionProtocol = new GameServerReconnectionProtocol(
      this.updateDispatchFactory,
      this.pendingReconnectionStoreService,
      this.reconnectionOpportunityManager,
      this.gameLifecycleController,
      (outbox) => this.dispatchOutboxMessages(outbox)
    );
  }

  private messageHandlers = createGameServerMessageFromClientHandlers(this);

  private startActiveGamesRecordHeartbeat() {
    this.heartbeatScheduler.start();

    const heartbeat = new HeartbeatTask(GAME_RECORD_HEARTBEAT_MS, () => {
      for (const [gameName, game] of this.gameRegistry.games)
        // currently overwrites but could just update - this is simpler for now
        this.gameSessionStoreService.writeActiveGameStatus(
          gameName,
          new ActiveGameStatus(gameName, game.id)
        );
    });

    this.heartbeatScheduler.register(
      ACTIVE_GAME_RECORD_REFRESH_HEARTBEAT_TASK_NAME,
      heartbeat
    );
  }

  async connectionHandler(
    socket: WebSocket,
    identityResolutionContext: ConnectionIdentityResolutionContext
  ) {
    const connectionId = this.userSessionRegistry.issueConnectionId();

    try {
      const session = await this.sessionLifecycleController.createSession(
        connectionId,
        identityResolutionContext
      );

      const { username, taggedUserId } = session;

      const connectionLogMessage = `-- ${username} (user id: ${taggedUserId.id}, connection id: ${connectionId}) joined the [${this.name}] game server`;
      // console.info(connectionLogMessage);

      this.outgoingMessagesGateway.registerEndpoint(connectionId, socket);

      const gameName = session.currentGameName;
      invariant(
        gameName !== null,
        "game name should have been set from their token in createSession"
      );

      const existingGame =
        await this.gameLifecycleController.getOrInitializeGame(gameName);

      this.attachIntentHandlersToSessionConnection(
        session,
        socket,
        this.messageHandlers
      );

      const gameIsInProgress = existingGame.timeStarted !== null;
      const connectionContext =
        await this.reconnectionProtocol.evaluateConnectionContext(
          session,
          gameIsInProgress
        );

      if (connectionContext.type === ConnectionContextType.Reconnection) {
        await connectionContext.attemptReconnectionClaim();
      }

      const outbox =
        await this.sessionLifecycleController.activateSession(session);

      const joinGameOutbox = await this.gameLifecycleController.joinGameHandler(
        gameName,
        session
      );
      outbox.pushFromOther(joinGameOutbox);

      // only after successfully reconnecting do we want the client to replace their
      // cached token
      const refreshedReconnectionTokenOutbox =
        await this.reconnectionProtocol.issueReconnectionCredential(session);
      outbox.pushFromOther(refreshedReconnectionTokenOutbox);

      this.dispatchOutboxMessages(outbox);
    } catch (error) {
      socket.close(1008, JSON.stringify(error));
      return;
    }
  }

  protected disconnectionHandler(session: UserSession, code: number) {
    // console.info(
    //   `-- ${session.username} (${session.connectionId}) disconnected from ${this.name} game server. Disconnect code - ${code}`
    // );

    const outbox = this.reconnectionProtocol.onPlayerDisconnected(
      session,
      this.name
    );

    const cleanupSessionOutbox =
      this.sessionLifecycleController.cleanupSession(session);
    outbox.pushFromOther(cleanupSessionOutbox);
    this.outgoingMessagesGateway.unregisterEndpoint(session.connectionId);

    outbox.removeRecipients([session.connectionId]);

    this.dispatchOutboxMessages(outbox);
  }
}
