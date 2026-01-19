import { ConnectionId } from "../../../aliases.js";
import {
  MessageFromServer,
  MessageFromServerType,
} from "../../../messages/from-server.js";
import { SessionLifecycleController } from "../../controllers/user-session-lifecycle.js";
import { GameRegistry } from "../../game-registry/index.js";
import { MessageDispatchFactory } from "../../message-delivery/message-dispatch-factory.js";
import { MessageDispatchOutbox } from "../../message-delivery/outbox.js";
import {
  ConnectionIdentityResolutionContext,
  IdentityProviderService,
} from "../../services/identity-provider/index.js";
import { UserSessionRegistry } from "../../sessions/user-session-registry.js";
import { UserSession } from "../../sessions/user-session.js";
import { LobbyGameLifecycleController } from "./game-lifecycle.js";

export class LobbySessionLifecycleController implements SessionLifecycleController<MessageFromServer> {
  constructor(
    private readonly userSessionRegistry: UserSessionRegistry,
    private readonly gameRegistry: GameRegistry,
    private readonly updateDispatchFactory: MessageDispatchFactory<MessageFromServer>,
    private readonly gameLifecycleController: LobbyGameLifecycleController,
    private readonly identityProviderService: IdentityProviderService
  ) {}

  async createSession(
    connectionId: ConnectionId,
    context: ConnectionIdentityResolutionContext
  ): Promise<UserSession> {
    const authenticatedUserOption =
      await this.identityProviderService.resolve(context);

    const { username, taggedUserId } = authenticatedUserOption;

    return new UserSession(
      username,
      connectionId,
      taggedUserId,
      this.gameRegistry
    );
  }

  async activateSession(
    session: UserSession,
    options?: { sessionWillBeForwardedToGameServer: boolean }
  ) {
    this.userSessionRegistry.register(session);

    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateDispatchFactory
    );

    // tell the client their username
    outbox.pushToConnection(session.connectionId, {
      type: MessageFromServerType.ClientUsername,
      data: { username: session.username },
    });

    // don't set up all their lobby stuff because we just want to forward them
    // to their disconnected session in the game server
    if (options?.sessionWillBeForwardedToGameServer) {
      return outbox;
    }

    // add user to lobby channel
    // tell the client about the channel they are in and other users in the lobby channel
    // tell other clients in the lobby that this user joined

    if (session.isAuth()) {
      // load and send them their saved characters
    }

    return outbox;
  }

  async cleanupSession(session: UserSession) {
    const outbox = new MessageDispatchOutbox(this.updateDispatchFactory);

    if (session.currentGameName !== null) {
      const leaveGameHandlerOutbox =
        await this.gameLifecycleController.leaveGameHandler(session);
      outbox.pushFromOther(leaveGameHandlerOutbox);
    }

    // example cleanup: remove them from the lobby channel if they were in it
    // and tell connected clients about it

    this.userSessionRegistry.unregister(session.connectionId);

    outbox.removeRecipients([session.connectionId]);

    return outbox;
  }
}
