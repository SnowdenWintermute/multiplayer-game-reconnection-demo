import { MessageFromServer } from "../messages/from-server.js";
import { MessageDispatchOutbox } from "./message-delivery/outbox.js";
import { UserSession } from "./sessions/user-session.js";

export enum ConnectionContextType {
  InitialConnection,
  Reconnection,
}

export interface ConnectionContext {
  type: ConnectionContextType;
}

export interface PlayerReconnectionProtocol {
  evaluateConnectionContext(
    session: UserSession,
    ...args: any[]
  ): Promise<ConnectionContext>;
  onPlayerDisconnected(
    session: UserSession,
    ...args: any[]
  ): Promise<MessageDispatchOutbox<MessageFromServer>>;
  issueReconnectionCredential(
    session: UserSession,
    ...args: any[]
  ): Promise<MessageDispatchOutbox<MessageFromServer>>;
  attemptReconnectionClaim(session: UserSession, ...args: any[]): Promise<void>;
}
