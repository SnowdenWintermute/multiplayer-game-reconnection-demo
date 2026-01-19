import { WebSocketServer, WebSocket } from "ws";
import { GameServerName, Milliseconds } from "../../aliases.js";
import { IdGenerator } from "../../utils/id-generator.js";
import { BaseServer } from "../base-server.js";
import { GameRegistry } from "../game-registry/index.js";
import { GameSessionStoreService } from "../services/game-session-store/index.js";
import { PendingReconnectionStoreService } from "../services/pending-reconnection-store/index.js";
import { UserSession } from "../sessions/user-session.js";
import { GameServerSessionClaimTokenCodec } from "../lobby-server/game-handoff/game-server-session-claim-token.js";
import { ConnectionIdentityResolutionContext } from "../services/identity-provider/index.js";
import { createGameServerMessageFromClientHandlers } from "./create-message-handlers.js";
import { HeartbeatScheduler } from "../../utils/heartbeat-scheduler.js";
import { GameServerGameLifecycleController } from "./controllers/game-lifecycle.js";
import { GameServerSessionLifecycleController } from "./controllers/session-lifecycle.js";

export interface GameServerExternalServices {
  gameSessionStoreService: GameSessionStoreService;
  pendingReconnectionStoreService: PendingReconnectionStoreService;
}

export const GAME_RECORD_HEARTBEAT_MS = (1000 * 10) as Milliseconds;

export class GameServer extends BaseServer {
  private readonly gameRegistry = new GameRegistry();
  private readonly idGenerator = new IdGenerator();
  private readonly heartbeatScheduler = new HeartbeatScheduler(
    GAME_RECORD_HEARTBEAT_MS
  );
  // private readonly reconnectionOpportunityManager =
  //   new ReconnectionOpportunityManager();
  // private readonly reconnectionProtocol: GameServerReconnectionProtocol;

  // controllers
  public readonly gameLifecycleController: GameServerGameLifecycleController;
  public readonly sessionLifecycleController: GameServerSessionLifecycleController;

  constructor(
    readonly name: GameServerName,
    private readonly pendingReconnectionStoreService: PendingReconnectionStoreService,
    private readonly gameSessionStoreService: GameSessionStoreService,
    private readonly websocketServer: WebSocketServer,
    private readonly gameServerSessionClaimTokenCodec: GameServerSessionClaimTokenCodec
  ) {
    super(name);

    websocketServer.on("connection", async (socket, request) => {
      const identityResolutionContext =
        await this.parseIdentityContextFromHandshakeRequest(request);
      this.connectionHandler(socket, identityResolutionContext);
    });

    this.heartbeatScheduler.start();

    this.gameLifecycleController = new GameServerGameLifecycleController(
      this.gameRegistry,
      this.userSessionRegistry,
      this.heartbeatScheduler,
      gameSessionStoreService,
      this.updateDispatchFactory
    );

    this.sessionLifecycleController = new GameServerSessionLifecycleController(
      this.userSessionRegistry,
      this.gameRegistry,
      this.updateDispatchFactory,
      this.gameServerSessionClaimTokenCodec
    );

    // this.reconnectionProtocol = new GameServerReconnectionProtocol(
    //   this.updateDispatchFactory,
    //   externalServices.disconnectedSessionStoreService,
    //   this.reconnectionOpportunityManager,
    //   this.gameLifecycleController,
    //   (outbox) => this.dispatchOutboxMessages(outbox)
    // );
  }

  private messageHandlers = createGameServerMessageFromClientHandlers(this);

  async connectionHandler(
    socket: WebSocket,
    identityResolutionContext: ConnectionIdentityResolutionContext
  ) {
    // const session = await this.sessionLifecycleController.createSession(
    //   connectionEndpoint.id,
    //   identityResolutionContext
    // );
    // const { username, taggedUserId, connectionId } = session;
    // console.info(
    //   `-- ${username} (user id: ${taggedUserId.id}, connection id: ${connectionId}) joined the [${this.name}] game server`
    // );
    // const userConnectionEndpoint = connectionEndpoint.toTyped<
    //   GameStateUpdate,
    //   ClientIntent
    // >();
    // this.outgoingMessagesGateway.registerEndpoint(userConnectionEndpoint);
    // const gameName = session.currentGameName;
    // if (gameName === null) {
    //   throw new Error("should have been set from their token in createSession");
    // }
    // const existingGame =
    //   await this.gameLifecycleController.getOrInitializeGame(gameName);
    // this.attachIntentHandlersToSessionConnection(
    //   session,
    //   userConnectionEndpoint,
    //   this.intentHandlers
    // );
    // const gameIsInProgress = existingGame.getTimeStarted() !== null;
    // const connectionContext =
    //   await this.reconnectionProtocol.evaluateConnectionContext(
    //     session,
    //     gameIsInProgress
    //   );
    // if (connectionContext.type === ConnectionContextType.Reconnection) {
    //   await connectionContext.attemptReconnectionClaim();
    // }
    // const outbox =
    //   await this.sessionLifecycleController.activateSession(session);
    // const joinGameOutbox = await this.gameLifecycleController.joinGameHandler(
    //   gameName,
    //   session
    // );
    // outbox.pushFromOther(joinGameOutbox);
    // const refreshedReconnectionTokenOutbox =
    //   await this.reconnectionProtocol.issueReconnectionCredential(session);
    // outbox.pushFromOther(refreshedReconnectionTokenOutbox);
    // this.dispatchOutboxMessages(outbox);
  }

  protected async disconnectionHandler(session: UserSession, code: number) {
    console.info(
      `-- ${session.username} (${session.connectionId}) disconnected from ${this.name} game server. Disconnect code - ${code}`
    );

    // const outbox = await this.reconnectionProtocol.onPlayerDisconnected(
    //   session,
    //   this.name
    // );

    // const cleanupSessionOutbox =
    //   await this.sessionLifecycleController.cleanupSession(session);
    // outbox.pushFromOther(cleanupSessionOutbox);
    // this.outgoingMessagesGateway.unregisterEndpoint(session.connectionId);

    // outbox.removeRecipients([session.connectionId]);

    // this.dispatchOutboxMessages(outbox);
  }
}
