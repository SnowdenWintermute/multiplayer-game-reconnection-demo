import {
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

export interface PendingReconnectionStoreService {
  writeDisconnectedSession(
    reconnectionKey: ReconnectionKey,
    record: PendingReconnection
  ): Promise<void>;
  getPendingReconnection(
    reconnectionKey: ReconnectionKey
  ): Promise<PendingReconnection | null>;
  deletePendingReconnection(reconnectionKey: ReconnectionKey): Promise<void>;
}
