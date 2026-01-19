import { IncomingMessage } from "node:http";
import { MessageFromClient } from "../messages/from-client.js";
import { MessageFromServer } from "../messages/from-server.js";
import { invariant } from "../utils/index.js";
import { GameServerMessageFromClientHandlers } from "./game-server/create-message-handlers.js";
import { LobbyMessageFromClientHandlers } from "./lobby-server/create-message-handlers.js";
import { MessageDispatchFactory } from "./message-delivery/message-dispatch-factory.js";
import { MessageDispatchType } from "./message-delivery/message-dispatch.js";
import { MessageDispatchOutbox } from "./message-delivery/outbox.js";
import { OutgoingMessageGateway } from "./message-delivery/outgoing-message-gateway.js";
import { UserSessionRegistry } from "./sessions/user-session-registry.js";
import { UserSession } from "./sessions/user-session.js";
import { WebSocket } from "ws";
import { ConnectionIdentityResolutionContext } from "./services/identity-provider/index.js";
import {
  GuestSessionReconnectionToken,
  IdentityProviderId,
} from "../aliases.js";

export abstract class BaseServer {
  readonly userSessionRegistry = new UserSessionRegistry();
  protected readonly updateDispatchFactory =
    new MessageDispatchFactory<MessageFromServer>(this.userSessionRegistry);
  protected readonly outgoingMessagesGateway =
    new OutgoingMessageGateway<MessageFromServer>();

  constructor(readonly name: string) {}

  protected async parseIdentityContextFromHandshakeRequest(
    request: IncomingMessage
  ): Promise<ConnectionIdentityResolutionContext> {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const reconnectionToken = url.searchParams.get(
      "clientCachedGuestReconnectionToken"
    );
    const sessionClaimToken = url.searchParams.get("sessionClaimToken");

    // @SECURITY - validate the query params

    const cookies = Object.fromEntries(
      request.headers.cookie?.split("; ").map((c) => c.split("=")) ?? []
    );

    const authUserIdToken = cookies["authUserIdToken"];
    let authUserId: IdentityProviderId | undefined = undefined;
    if (authUserIdToken !== undefined) {
      authUserId = await this.getUserIdFromInternalService(authUserIdToken);
    }

    return {
      clientCachedGuestReconnectionToken:
        (reconnectionToken as GuestSessionReconnectionToken) || undefined,
      encodedGameServerSessionClaimToken: sessionClaimToken || undefined,
      authUserId,
    };
  }

  private async getUserIdFromInternalService(authToken: string) {
    // make an internal call to your identity provider and get
    // the user id from the token if it is valid and an auth session
    // exists that corresponds to the token's information
    return undefined;
  }

  protected attachIntentHandlersToSessionConnection(
    session: UserSession,
    userConnectionEndpoint: WebSocket,
    intentHandlers:
      | Partial<GameServerMessageFromClientHandlers>
      | Partial<LobbyMessageFromClientHandlers>
  ) {
    // attach the connection to message handlers and disconnectionHandler
    userConnectionEndpoint.on("message", async (data) => {
      try {
        const text = data.toString();
        const expectedTypedPacket = JSON.parse(text) as MessageFromClient;

        // @SECURITY - validate message shape

        const handlerOption = intentHandlers[expectedTypedPacket.type];

        invariant(
          handlerOption !== undefined,
          "Server is not configured to handle this type of message"
        );

        const registeredSession = this.userSessionRegistry.requireSession(
          session.connectionId
        );

        // TS asks: what argument would be valid for *any* possible handler?
        // Because this is a union of handlers, the parameter type becomes the
        // intersection of all payload types, which collapses to `never`.
        // Since we look up handler in a typed record and check it is not undefined
        // we can say the data is the correct type for the handler
        const outbox = await handlerOption(
          expectedTypedPacket.data as never,
          registeredSession
        );
        this.dispatchOutboxMessages(outbox);
      } catch (error) {}
    });

    userConnectionEndpoint.on("close", () => {
      this.disconnectionHandler(session);
    });
  }

  protected dispatchOutboxMessages(
    outbox: MessageDispatchOutbox<MessageFromServer>
  ) {
    for (const dispatch of outbox.toDispatches()) {
      switch (dispatch.type) {
        case MessageDispatchType.Single:
          this.outgoingMessagesGateway.submitToConnection(
            dispatch.connectionId,
            dispatch.message
          );
          break;
        case MessageDispatchType.FanOut:
          this.outgoingMessagesGateway.submitToConnections(
            dispatch.connectionIds,
            dispatch.message
          );
          break;
      }
    }
  }

  protected abstract disconnectionHandler(session: UserSession): Promise<void>;
}
