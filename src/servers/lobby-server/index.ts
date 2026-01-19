import { GameRegistry } from "../game-registry/index.js";
import { PendingReconnectionStoreService } from "../services/pending-reconnection-store/index.js";
import { GameSessionStoreService } from "../services/game-session-store/index.js";
import { WebSocketServer, WebSocket } from "ws";
import {
  ConnectionIdentityResolutionContext,
  IdentityProviderService,
} from "../services/identity-provider/index.js";
import { LobbyReconnectionProtocol } from "./reconnection-protocol.js";
import { GameHandoffManager } from "./game-handoff/game-handoff-manager.js";
import { MessageDispatchFactory } from "../message-delivery/message-dispatch-factory.js";
import { MessageFromServer } from "../../messages/from-server.js";
import { GameServerSessionClaimTokenCodec } from "./game-handoff/game-server-session-claim-token.js";
import { LobbyGameLifecycleController } from "./controllers/game-lifecycle.js";
import { LobbySessionLifecycleController } from "./controllers/user-session-lifecycle.js";
import { BaseServer } from "../base-server.js";
import { UserSession } from "../sessions/user-session.js";
import { ConnectionContextType } from "../reconnection-protocol.js";
import { createLobbyMessageFromClientHandlers } from "./create-message-handlers.js";

export class LobbyServer extends BaseServer {
  protected readonly updateDispatchFactory =
    new MessageDispatchFactory<MessageFromServer>(this.userSessionRegistry);
  private gameRegistry = new GameRegistry();
  private readonly reconnectionProtocol: LobbyReconnectionProtocol;
  private readonly gameHandoffManager: GameHandoffManager;

  readonly sessionLifecycleController: LobbySessionLifecycleController;
  readonly gameLifecycleController: LobbyGameLifecycleController;
  private userIntentHandlers = createLobbyMessageFromClientHandlers(this);

  constructor(
    private readonly identityProviderService: IdentityProviderService,
    private readonly pendingReconnectionStoreService: PendingReconnectionStoreService,
    private readonly gameSessionStoreService: GameSessionStoreService,
    private readonly websocketServer: WebSocketServer,
    private readonly gameServerSessionClaimTokenCodec: GameServerSessionClaimTokenCodec
  ) {
    super("Lobby");
    this.gameHandoffManager = new GameHandoffManager(
      this.userSessionRegistry,
      this.updateDispatchFactory,
      gameSessionStoreService,
      this.gameServerSessionClaimTokenCodec
    );

    this.reconnectionProtocol = new LobbyReconnectionProtocol(
      gameServerSessionClaimTokenCodec,
      this.updateDispatchFactory,
      gameSessionStoreService,
      pendingReconnectionStoreService
    );

    this.gameLifecycleController = new LobbyGameLifecycleController(
      this.gameRegistry,
      this.updateDispatchFactory,
      gameSessionStoreService,
      this.gameHandoffManager
    );

    this.sessionLifecycleController = new LobbySessionLifecycleController(
      this.userSessionRegistry,
      this.gameRegistry,
      this.updateDispatchFactory,
      this.gameLifecycleController,
      identityProviderService
    );

    websocketServer.on("connection", async (socket, request) => {
      const identityResolutionContext =
        await this.parseIdentityContextFromHandshakeRequest(request);
      // this.connectionHandler(socket);
    });
  }

  private async connectionHandler(
    socket: WebSocket,
    identityResolutionContext: ConnectionIdentityResolutionContext
  ) {
    const connectionId = this.userSessionRegistry.issueConnectionId();
    const session = await this.sessionLifecycleController.createSession(
      connectionId,
      identityResolutionContext
    );

    const { username, taggedUserId } = session;
    console.info(
      `-- ${username} (user id: ${taggedUserId.id}, connection id: ${connectionId}) joined the lobby`
    );

    this.outgoingMessagesGateway.registerEndpoint(connectionId, socket);

    const connectionContext =
      await this.reconnectionProtocol.evaluateConnectionContext(session);

    if (connectionContext.type === ConnectionContextType.Reconnection) {
      const outbox = await this.sessionLifecycleController.activateSession(
        session,
        {
          sessionWillBeForwardedToGameServer: true,
        }
      );
      const reconnectionCredentialsOutbox =
        await connectionContext.issueCredentials();
      outbox.pushFromOther(reconnectionCredentialsOutbox);
      this.dispatchOutboxMessages(outbox);
    } else {
      this.attachIntentHandlersToSessionConnection(
        session,
        socket,
        this.userIntentHandlers
      );

      const outbox =
        await this.sessionLifecycleController.activateSession(session);
      this.dispatchOutboxMessages(outbox);
    }
  }

  protected disconnectionHandler(session: UserSession): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
