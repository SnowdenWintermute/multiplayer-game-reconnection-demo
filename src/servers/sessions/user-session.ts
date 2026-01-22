import {
  ConnectionId,
  GameName,
  GuestSessionReconnectionToken,
  Username,
} from "../../aliases.js";
import { ERROR_MESSAGES } from "../../error-messages.js";
import { invariant } from "../../utils/index.js";
import { GameRegistry } from "../game-registry/index.js";
import {
  AuthTaggedUserId,
  TaggedUserId,
  UserIdType,
} from "../services/identity-provider/tagged-user-id.js";
import {
  ReconnectionKey,
  ReconnectionKeyType,
} from "../services/game-server-reconnection-forwarding-record/index.js";
import { ConnectionSession } from "./connection-session.js";

export class UserSession extends ConnectionSession {
  public currentGameName: null | GameName = null;
  private guestReconnectionToken: null | GuestSessionReconnectionToken = null;

  constructor(
    private _username: Username,
    /** either a socket.id or a locally generated UUID on client */
    public readonly connectionId: ConnectionId,
    public readonly taggedUserId: TaggedUserId,
    private readonly gameRegistry: GameRegistry
  ) {
    super(connectionId);
  }

  get username() {
    return this._username;
  }

  set username(username: Username) {
    this._username = username;
  }

  getExpectedCurrentGame() {
    if (this.currentGameName === null) {
      throw new Error("No current game");
    }
    return this.gameRegistry.requireGame(this.currentGameName);
  }

  isInGame() {
    return this.currentGameName !== null;
  }

  isAuth() {
    return this.taggedUserId.type === UserIdType.Auth;
  }

  isGuest() {
    return this.taggedUserId.type === UserIdType.Guest;
  }

  tryGetJoinNewGamePermission() {
    if (this.isInGame()) {
      throw new Error(ERROR_MESSAGES.USER_SESSION.ALREADY_IN_GAME);
    }
    // can check for logged in users or other restrictions
  }

  setCurrentGame(gameName: GameName) {
    this.currentGameName = gameName;
  }

  requireAuthorized(): asserts this is { userId: AuthTaggedUserId } {
    if (this.taggedUserId.type !== UserIdType.Auth) {
      throw new Error(ERROR_MESSAGES.USER_SESSION.AUTH_REQUIRED);
    }
  }

  setGuestReconnectionToken(token: GuestSessionReconnectionToken) {
    invariant(this.isGuest());
    this.guestReconnectionToken = token;
  }

  getGuestReconnectionTokenOption() {
    return this.guestReconnectionToken;
  }

  getReconnectionKeyOption(): null | ReconnectionKey {
    switch (this.taggedUserId.type) {
      case UserIdType.Auth: {
        return {
          type: ReconnectionKeyType.Auth,
          userId: this.taggedUserId.id,
        };
      }
      case UserIdType.Guest: {
        const reconnectionTokenOption = this.getGuestReconnectionTokenOption();

        if (!reconnectionTokenOption) {
          return null;
        }

        return {
          type: ReconnectionKeyType.Guest,
          reconnectionToken: reconnectionTokenOption,
        };
      }
    }
  }

  requireReconnectionKey() {
    const key = this.getReconnectionKeyOption();
    invariant(key !== null);
    return key;
  }
}
