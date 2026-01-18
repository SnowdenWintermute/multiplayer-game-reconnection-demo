import {
  GuestSessionReconnectionToken,
  GuestUserId,
  IdentityProviderId,
  Username,
} from "../../../aliases.js";
import { IdGenerator } from "../../../utils/id-generator.js";
import { PLAYER_FIRST_NAMES, PLAYER_LAST_NAMES } from "./guest-usernames.js";
import { TaggedUserId, UserIdType } from "./tagged-user-id.js";

export interface ConnectionIdentityResolutionContext {
  readonly authUserId?: IdentityProviderId;
  readonly clientCachedGuestReconnectionToken?: GuestSessionReconnectionToken;
  readonly encodedGameServerSessionClaimToken?: string;
}

export interface UserIdentity {
  username: Username;
  taggedUserId: TaggedUserId;
}

export class IdentityProviderService {
  private readonly idGenerator = new IdGenerator<GuestUserId>();
  private userIdentities = new Map<IdentityProviderId, Username>();

  registerAuthenticatedUser(userId: IdentityProviderId, username: Username) {
    this.userIdentities.set(userId, username);
  }

  async resolve(
    context: ConnectionIdentityResolutionContext
  ): Promise<UserIdentity> {
    const { authUserId } = context;

    if (authUserId === undefined) {
      return this.createGuestUser();
    }

    const usernameOption = this.userIdentities.get(authUserId);

    if (usernameOption === undefined) {
      return this.createGuestUser();
    }

    return {
      username: usernameOption,
      taggedUserId: { type: UserIdType.Auth, id: authUserId },
    };
  }

  private createGuestUser() {
    const taggedUserId: TaggedUserId = {
      type: UserIdType.Guest,
      id: this.idGenerator.generate() as GuestUserId,
    };

    const username = this.generateRandomUsername();

    return { username, taggedUserId };
  }

  private generateRandomUsername() {
    const firstName =
      PLAYER_FIRST_NAMES[Math.floor(Math.random() * PLAYER_FIRST_NAMES.length)];
    const lastName =
      PLAYER_LAST_NAMES[Math.floor(Math.random() * PLAYER_LAST_NAMES.length)];
    return `${firstName} ${lastName}` as Username;
  }
}
