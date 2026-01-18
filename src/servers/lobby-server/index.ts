import { GameRegistry } from "../game-registry/index.js";
import { UserSessionRegistry } from "../sessions/user-session-registry.js";
import { PendingReconnectionStoreService } from "../services/pending-reconnection-store/index.js";
import { GameSessionStoreService } from "../services/game-session-store/index.js";
import { WebSocketServer, WebSocket } from "ws";
import { IdentityProviderService } from "../services/identity-provider/index.js";

export class LobbyServer {
  private userSessionRegistry = new UserSessionRegistry();
  private gameRegistry = new GameRegistry();

  constructor(
    // identity provider service
    private identityProviderService: IdentityProviderService,
    private pendingReconnectionStoreService: PendingReconnectionStoreService,
    private gameSessionStoreService: GameSessionStoreService,
    private websocketServer: WebSocketServer
  ) {
    websocketServer.on("connection", (socket) =>
      this.connectionHandler(socket)
    );
  }

  private connectionHandler(socket: WebSocket) {
    const connectionId = this.userSessionRegistry.issueConnectionId();

    console.log(socket);
  }
  // transport abstraction
  // message outbox
  // message dispatcher
  //
  // game admission token issuer
  // guest reconnection token
  //
  // lobby reconnection protocol
  // game handoff manager
  // game lifecycle controller
  // user session lifecycle controller
}
