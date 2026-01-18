import { ConnectionId } from "../../aliases.js";
import { MessageDispatchOutbox } from "../message-delivery/outbox.js";
import { ConnectionIdentityResolutionContext } from "../services/identity-provider.js";
import { UserSession } from "../sessions/user-session.js";

export interface SessionLifecycleController<Sendable> {
  createSession(
    connectionId: ConnectionId,
    context: ConnectionIdentityResolutionContext
  ): Promise<UserSession>;

  activateSession(
    session: UserSession,
    ...args: any[]
  ): Promise<MessageDispatchOutbox<Sendable>>;

  cleanupSession(
    session: UserSession
  ): Promise<MessageDispatchOutbox<Sendable>>;
}
