import {
  GuestSessionReconnectionToken,
  Milliseconds,
  Username,
} from "../aliases.js";
import { MyGameClass } from "../game/index.js";
import { GameServerConnectionInstructions } from "../servers/lobby-server/game-handoff/game-server-connection-instructions.js";

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
  PlayerTookAction,
}

export const MESSAGE_FROM_SERVER_TYPE_STRINGS: Record<
  MessageFromServerType,
  string
> = {
  [MessageFromServerType.ClientUsername]: "ClientUsername",
  [MessageFromServerType.CacheGuestSessionReconnectionToken]:
    "CacheGuestSessionReconnectionToken",
  [MessageFromServerType.ErrorMessage]: "ErrorMessage",
  [MessageFromServerType.GameFullUpdate]: "GameFullUpdate",
  [MessageFromServerType.PlayerLeftGame]: "PlayerLeftGame",
  [MessageFromServerType.PlayerJoinedGame]: "PlayerJoinedGame",
  [MessageFromServerType.PlayerDisconnectedWithReconnectionOpportunity]:
    "PlayerDisconnectedWithReconnectionOpportunity",
  [MessageFromServerType.PlayerReconnectionTimedOut]:
    "PlayerReconnectionTimedOut",
  [MessageFromServerType.PlayerToggledReadyToStartGame]:
    "PlayerToggledReadyToStartGame",
  [MessageFromServerType.GameStarted]: "GameStarted",
  [MessageFromServerType.GameServerConnectionInstructions]:
    "GameServerConnectionInstructions",
  [MessageFromServerType.PlayerTookAction]: "PlayerTookAction",
};

export interface MessageFromServerMap {
  [MessageFromServerType.ClientUsername]: {
    username: Username;
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
  [MessageFromServerType.GameServerConnectionInstructions]: {
    connectionInstructions: GameServerConnectionInstructions;
  };
  [MessageFromServerType.GameStarted]: {
    timeStarted: Milliseconds;
  };
  [MessageFromServerType.PlayerTookAction]: {
    username: Username;
    action: string;
  };
}

export type MessageFromServer = {
  [K in keyof MessageFromServerMap]: {
    type: K;
    data: MessageFromServerMap[K];
  };
}[keyof MessageFromServerMap];
