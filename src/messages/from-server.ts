import { GuestSessionReconnectionToken, Username } from "../aliases.js";
import { MyGameClass } from "../game/index.js";

export enum MessageFromServerType {
  ClientUsername,
  CacheGuestSessionReconnectionToken,
  ErrorMessage,
  GameFullUpdate,
  PlayerLeftGame,
  PlayerJoinedGame,
  PlayerDisconnectedWithReconnectionOpportunity,
  PlayerReconnectionTimedOut,
  PlayerToggledReadyToStartGame,
  GameStarted,
  GameServerConnectionInstructions,
}

export interface MessageFromServerMap {
  [MessageFromServerType.ClientUsername]: {
    username: string;
  };
  [MessageFromServerType.CacheGuestSessionReconnectionToken]: {
    token: GuestSessionReconnectionToken;
  };
  [MessageFromServerType.ErrorMessage]: {
    message: string;
  };
  [MessageFromServerType.GameFullUpdate]: {
    game: MyGameClass | null;
  };
  [MessageFromServerType.PlayerLeftGame]: {
    username: Username;
  };
  [MessageFromServerType.PlayerDisconnectedWithReconnectionOpportunity]: {
    username: Username;
  };
  [MessageFromServerType.PlayerReconnectionTimedOut]: {
    username: Username;
  };
  [MessageFromServerType.PlayerJoinedGame]: {
    username: Username;
  };
  [MessageFromServerType.PlayerToggledReadyToStartGame]: {
    username: Username;
  };
}

export type MessageFromServer = {
  [K in keyof MessageFromServerMap]: {
    type: K;
    data: MessageFromServerMap[K];
  };
}[keyof MessageFromServerMap];
