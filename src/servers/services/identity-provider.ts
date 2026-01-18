import {
  GuestSessionReconnectionToken,
  IdentityProviderId,
  Username,
} from "../../aliases.js";
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
  private userIdentities = new Map<IdentityProviderId, Username>();

  registerAuthenticatedUser(userId: IdentityProviderId, username: Username) {
    this.userIdentities.set(userId, username);
  }

  async resolve(
    context: ConnectionIdentityResolutionContext
  ): Promise<UserIdentity | null> {
    const { authUserId } = context;
    if (authUserId === undefined) {
      return null;
    }

    const usernameOption = this.userIdentities.get(authUserId);

    if (usernameOption === undefined) {
      return null;
    }

    return {
      username: usernameOption,
      taggedUserId: { type: UserIdType.Auth, id: authUserId },
    };
  }
}
