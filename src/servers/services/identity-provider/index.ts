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
  readonly authToken?: string;
  readonly clientCachedGuestReconnectionToken?: GuestSessionReconnectionToken;
  readonly encodedGameServerSessionClaimToken?: string;
}

export interface UserIdentity {
  username: Username;
  taggedUserId: TaggedUserId;
}

export class IdentityProviderService {
  private readonly idGenerator = new IdGenerator<GuestUserId>();

  async resolve(
    context: ConnectionIdentityResolutionContext
  ): Promise<UserIdentity> {
    const { authToken } = context;

    const authenticatedIdentityOption =
      await this.getUserIdentityFromInternalService(authToken);

    if (authenticatedIdentityOption === undefined) {
      return this.createGuestUser();
    } else {
      const { username, id } = authenticatedIdentityOption;
      return {
        username,
        taggedUserId: { type: UserIdType.Auth, id },
      };
    }
  }

  private async getUserIdentityFromInternalService(
    authTokenOption: undefined | string
  ): Promise<{ username: Username; id: IdentityProviderId } | undefined> {
    // make an internal call to your identity provider and get
    // the user id from the token if it is valid and an auth session
    // exists that corresponds to the token's information
    return undefined;
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
