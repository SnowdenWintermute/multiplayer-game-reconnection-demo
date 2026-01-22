import {
  GameName,
  GameServerName,
  GuestSessionReconnectionToken,
} from "../../../aliases.js";
import { ERROR_MESSAGES } from "../../../error-messages.js";
import { UserSession } from "../../sessions/user-session.js";
import { TaggedUserId } from "../identity-provider/tagged-user-id.js";

export class GameServerReconnectionForwardingRecord {
  constructor(
    public readonly taggedUserId: TaggedUserId,
    public readonly gameName: GameName,
    public readonly gameServerName: GameServerName,
    public readonly guestUserReconnectionTokenOption: null | GuestSessionReconnectionToken
  ) {}

  static fromUserSession(session: UserSession, gameServerName: GameServerName) {
    if (session.currentGameName === null) {
      throw new Error(ERROR_MESSAGES.USER_SESSION.NOT_IN_GAME);
    }

    return new GameServerReconnectionForwardingRecord(
      session.taggedUserId,
      session.currentGameName,
      gameServerName,
      session.getGuestReconnectionTokenOption()
    );
  }
}
