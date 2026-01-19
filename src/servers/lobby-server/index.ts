import { GameRegistry } from "../game-registry/index.js";
import { UserSessionRegistry } from "../sessions/user-session-registry.js";
import { PendingReconnectionStoreService } from "../services/pending-reconnection-store/index.js";
import { GameSessionStoreService } from "../services/game-session-store/index.js";
import { WebSocketServer, WebSocket } from "ws";
import { IdentityProviderService } from "../services/identity-provider/index.js";
import { LobbyReconnectionProtocol } from "./reconnection-protocol.js";
import { GameHandoffManager } from "./game-handoff/game-handoff-manager.js";
import { MessageDispatchFactory } from "../message-delivery/message-dispatch-factory.js";
import { MessageFromServer } from "../../messages/from-server.js";
import { GameServerSessionClaimTokenCodec } from "./game-handoff/game-server-session-claim-token.js";

export class LobbyServer {
  private userSessionRegistry = new UserSessionRegistry();
  protected readonly updateDispatchFactory =
    new MessageDispatchFactory<MessageFromServer>(this.userSessionRegistry);
  private gameRegistry = new GameRegistry();
  private readonly reconnectionProtocol: LobbyReconnectionProtocol;
  private readonly gameHandoffManager: GameHandoffManager;

  constructor(
    private readonly identityProviderService: IdentityProviderService,
    private readonly pendingReconnectionStoreService: PendingReconnectionStoreService,
    private readonly gameSessionStoreService: GameSessionStoreService,
    private readonly websocketServer: WebSocketServer,
    private readonly gameServerSessionClaimTokenCodec: GameServerSessionClaimTokenCodec
  ) {
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

    websocketServer.on("connection", (socket) =>
      this.connectionHandler(socket)
    );
  }

  private connectionHandler(socket: WebSocket) {
    const connectionId = this.userSessionRegistry.issueConnectionId();

    console.log(socket);
  }
}
