import {
  GameName,
  GuestSessionReconnectionToken,
  IdentityProviderId,
} from "../../../aliases.js";
import { GameServerReconnectionForwardingRecord } from "./game-server-reconnection-forwarding-record.js";

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

export class GameServerReconnectionForwardingRecordStoreService {
  private byIdentityProviderId = new Map<
    IdentityProviderId,
    GameServerReconnectionForwardingRecord
  >();
  private byReconnectionToken = new Map<
    GuestSessionReconnectionToken,
    GameServerReconnectionForwardingRecord
  >();

  private pendingGuestReconnectionPendingWrites = new Map<
    GuestSessionReconnectionToken,
    Promise<void>
  >();
  private pendingAuthReconnectionPendingWrites = new Map<
    IdentityProviderId,
    Promise<void>
  >();

  writeGameServerReconnectionForwardingRecord(
    reconnectionKey: ReconnectionKey,
    record: GameServerReconnectionForwardingRecord
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

  async getGameServerReconnectionForwardingRecord(
    reconnectionKey: ReconnectionKey
  ): Promise<GameServerReconnectionForwardingRecord | null> {
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
  async deleteGameServerReconnectionForwardingRecord(
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
    for (const [
      identityProviderId,
      gameServerReconnectionForwardingRecord,
    ] of this.byIdentityProviderId) {
      if (gameServerReconnectionForwardingRecord.gameName === gameName) {
        this.byIdentityProviderId.delete(identityProviderId);
      }
    }
    for (const [
      reconnectionToken,
      gameServerReconnectionForwardingRecord,
    ] of this.byReconnectionToken) {
      if (gameServerReconnectionForwardingRecord.gameName === gameName) {
        this.byReconnectionToken.delete(reconnectionToken);
      }
    }
  }
}
