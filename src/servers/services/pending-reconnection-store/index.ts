import {
  GameName,
  GuestSessionReconnectionToken,
  IdentityProviderId,
} from "../../../aliases.js";
import { PendingReconnection } from "./pending-reconnection.js";

export enum ReconnectionKeyType {
  Auth,
  Guest,
}

export interface GuestReconnectionKey {
  type: ReconnectionKeyType.Guest;
  reconnectionToken: GuestSessionReconnectionToken;
}

export interface AuthReconnectionKey {
  type: ReconnectionKeyType.Auth;
  userId: IdentityProviderId;
}

export type ReconnectionKey = GuestReconnectionKey | AuthReconnectionKey;

export class PendingReconnectionStoreService {
  private byIdentityProviderId = new Map<
    IdentityProviderId,
    PendingReconnection
  >();
  private byReconnectionToken = new Map<
    GuestSessionReconnectionToken,
    PendingReconnection
  >();

  private pendingGuestReconnectionPendingWrites = new Map<
    GuestSessionReconnectionToken,
    Promise<void>
  >();
  private pendingAuthReconnectionPendingWrites = new Map<
    IdentityProviderId,
    Promise<void>
  >();

  writePendingReconnection(
    reconnectionKey: ReconnectionKey,
    record: PendingReconnection
  ) {
    switch (reconnectionKey.type) {
      case ReconnectionKeyType.Auth:
        this.pendingAuthReconnectionPendingWrites.set(
          reconnectionKey.userId,
          new Promise((resolve, reject) => {
            this.byIdentityProviderId.set(reconnectionKey.userId, record);
            resolve();
          })
        );
        break;
      case ReconnectionKeyType.Guest:
        this.pendingGuestReconnectionPendingWrites.set(
          reconnectionKey.reconnectionToken,
          new Promise((resolve, reject) => {
            this.byReconnectionToken.set(
              reconnectionKey.reconnectionToken,
              record
            );

            resolve();
          })
        );
        break;
    }
  }

  async getPendingReconnection(
    reconnectionKey: ReconnectionKey
  ): Promise<PendingReconnection | null> {
    switch (reconnectionKey.type) {
      case ReconnectionKeyType.Auth:
        if (this.pendingAuthReconnectionPendingWrites) {
          await Promise.all(
            Array.from(this.pendingAuthReconnectionPendingWrites.values())
          );
        }
        return this.byIdentityProviderId.get(reconnectionKey.userId) || null;
      case ReconnectionKeyType.Guest:
        await Promise.all(
          Array.from(this.pendingGuestReconnectionPendingWrites.values())
        );
        return (
          this.byReconnectionToken.get(reconnectionKey.reconnectionToken) ||
          null
        );
    }
  }
  async deletePendingReconnection(
    reconnectionKey: ReconnectionKey
  ): Promise<void> {
    switch (reconnectionKey.type) {
      case ReconnectionKeyType.Auth:
        this.byIdentityProviderId.delete(reconnectionKey.userId);
        break;
      case ReconnectionKeyType.Guest:
        this.byReconnectionToken.delete(reconnectionKey.reconnectionToken);
        break;
    }
  }

  async deleteAllInGame(gameName: GameName) {
    for (const [identityProviderId, pendingReconnection] of this
      .byIdentityProviderId) {
      if (pendingReconnection.gameName === gameName) {
        this.byIdentityProviderId.delete(identityProviderId);
      }
    }
    for (const [reconnectionToken, pendingReconnection] of this
      .byReconnectionToken) {
      if (pendingReconnection.gameName === gameName) {
        this.byReconnectionToken.delete(reconnectionToken);
      }
    }
  }
}
