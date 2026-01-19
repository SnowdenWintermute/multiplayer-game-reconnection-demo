import {
  GameName,
  GuestSessionReconnectionToken,
  Milliseconds,
  Username,
} from "../../../aliases.js";
import { EncryptionHelpers } from "../../../cryptography/index.js";
import crypto from "crypto";
import { TaggedUserId } from "../../services/identity-provider/tagged-user-id.js";

export class GameServerSessionClaimToken {
  readonly expirationTimestamp =
    GameServerSessionClaimToken.createExpirationTimestamp();

  readonly nonce = crypto.randomBytes(16).toString("hex");
  constructor(
    readonly gameName: GameName,
    readonly username: Username,
    readonly taggedUserId: TaggedUserId,
    readonly reconnectionTokenOption?: GuestSessionReconnectionToken
  ) {}

  static readonly TimeToLive: Milliseconds = (1000 * 5 * 60) as Milliseconds;
  static createExpirationTimestamp() {
    return (Date.now() +
      GameServerSessionClaimToken.TimeToLive) as Milliseconds;
  }
}

export class GameServerSessionClaimTokenCodec {
  constructor(private readonly secret: string) {}

  async encode(token: GameServerSessionClaimToken): Promise<string> {
    return EncryptionHelpers.encrypt(token, this.secret);
  }

  async decode(encoded: string): Promise<GameServerSessionClaimToken> {
    return EncryptionHelpers.decrypt(encoded, this.secret);
  }
}
