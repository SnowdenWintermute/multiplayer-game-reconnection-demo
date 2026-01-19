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
  [MessageFromServerType.GameServerConnectionInstructions]: {
    connectionInstructions: GameServerConnectionInstructions;
  };
  [MessageFromServerType.GameStarted]: {
    timeStarted: Milliseconds;
  };
}

export type MessageFromServer = {
  [K in keyof MessageFromServerMap]: {
    type: K;
    data: MessageFromServerMap[K];
  };
}[keyof MessageFromServerMap];
