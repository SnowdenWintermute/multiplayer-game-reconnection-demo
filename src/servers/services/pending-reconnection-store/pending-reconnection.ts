import {
  ConnectionId,
  GameName,
  GameServerName,
  GuestSessionReconnectionToken,
  Username,
} from "../../../aliases.js";
import { ERROR_MESSAGES } from "../../../error-messages.js";
import { GameRegistry } from "../../game-registry/index.js";
import { UserSession } from "../../sessions/user-session.js";
import { TaggedUserId } from "../tagged-user-id.js";

export class PendingReconnection {
  constructor(
    public readonly taggedUserId: TaggedUserId,
    private username: Username,
    public readonly gameName: GameName,
    public readonly gameServerName: GameServerName,
    public readonly guestUserReconnectionTokenOption: null | GuestSessionReconnectionToken
  ) {}

  static fromUserSession(session: UserSession, gameServerName: GameServerName) {
    if (session.currentGameName === null) {
      throw new Error(ERROR_MESSAGES.USER_SESSION.NOT_IN_GAME);
    }

    return new PendingReconnection(
      session.taggedUserId,
      session.username,
      session.currentGameName,
      gameServerName,
      session.getGuestReconnectionTokenOption()
    );
  }

  toUserSession(connectionId: ConnectionId, gameRegistry: GameRegistry) {
    return new UserSession(
      this.username,
      connectionId,
      this.taggedUserId,
      gameRegistry
    );
  }
}
