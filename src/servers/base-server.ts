import { MessageFromServer } from "../messages/from-server.js";
import { MessageDispatchFactory } from "./message-delivery/message-dispatch-factory.js";
import { MessageDispatchType } from "./message-delivery/message-dispatch.js";
import { MessageDispatchOutbox } from "./message-delivery/outbox.js";
import { OutgoingMessageGateway } from "./message-delivery/outgoing-message-gateway.js";
import { UserSessionRegistry } from "./sessions/user-session-registry.js";
import { UserSession } from "./sessions/user-session.js";
import { WebSocket } from "ws";

export abstract class BaseServer {
  readonly userSessionRegistry = new UserSessionRegistry();
  protected readonly updateDispatchFactory =
    new MessageDispatchFactory<MessageFromServer>(this.userSessionRegistry);
  protected readonly outgoingMessagesGateway =
    new OutgoingMessageGateway<MessageFromServer>();

  constructor(readonly name: string) {}

  protected attachIntentHandlersToSessionConnection(
    session: UserSession,
    userConnectionEndpoint: WebSocket,
    intentHandlers:
      | Partial<GameServerClientIntentHandlers>
      | Partial<LobbyClientIntentHandlers>
  ) {
    // attach the connection to message handlers and disconnectionHandler
    userConnectionEndpoint.on("message", async (data) => {
      try {
        const text = data.toString();
        const expectedTypedPacket = JSON.parse(text);

        const handlerOption = intentHandlers[expectedTypedPacket.type];

        if (handlerOption === undefined) {
          throw new Error(
            "Lobby is not configured to handle this type of ClientIntent"
          );
        }

        const registeredSession = this.userSessionRegistry.requireSession(
          session.connectionId
        );

        // a workaround is to use "as never" for some reason
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
