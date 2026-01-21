import { GameName } from "../aliases.js";

export enum MessageFromClientType {
  CreateGame,
  JoinGame,
  LeaveGame,
  ToggleReadyToStartGame,
  AttemptGameplayAction,
}

// Map enum values to payload types
export interface MessageFromClientMap {
  [MessageFromClientType.CreateGame]: {
    gameName: GameName;
  };
  [MessageFromClientType.JoinGame]: { gameName: GameName };
  [MessageFromClientType.LeaveGame]: undefined;
  [MessageFromClientType.ToggleReadyToStartGame]: undefined;
  [MessageFromClientType.AttemptGameplayAction]: { action: string }; // some arbitrary action
}

export type MessageFromClient = {
  [K in keyof MessageFromClientMap]: {
    type: K;
    data: MessageFromClientMap[K];
  };
}[keyof MessageFromClientMap];
