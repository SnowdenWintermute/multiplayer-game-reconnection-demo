import {
  MessageFromClientMap,
  MessageFromClientType,
} from "../../messages/from-client.js";
import { MessageFromServer } from "../../messages/from-server.js";
import { MessageDispatchOutbox } from "../message-delivery/outbox.js";
import { UserSession } from "../sessions/user-session.js";
import { LobbyServer } from "./index.js";

export type LobbyMessageFromClientHandler<
  K extends keyof MessageFromClientMap,
> = (
  data: MessageFromClientMap[K],
  user: UserSession
) =>
  | MessageDispatchOutbox<MessageFromServer>
  | Promise<MessageDispatchOutbox<MessageFromServer>>;

export type LobbyMessageFromClientHandlers = {
  [K in keyof MessageFromClientMap]: LobbyMessageFromClientHandler<K>;
};

export function createLobbyMessageFromClientHandlers(
  lobbyServer: LobbyServer
): Partial<LobbyMessageFromClientHandlers> {
  return {
    //  GAME SETUP
    [MessageFromClientType.CreateGame]: (data, user) =>
      lobbyServer.gameLifecycleController.createGameHandler(data, user),
    [MessageFromClientType.JoinGame]: (data, user) =>
      lobbyServer.gameLifecycleController.joinGameHandler(data.gameName, user),
    [MessageFromClientType.LeaveGame]: (_data, user) =>
      lobbyServer.gameLifecycleController.leaveGameHandler(user),
    [MessageFromClientType.ToggleReadyToStartGame]: (_data, user) =>
      lobbyServer.gameLifecycleController.toggleReadyToStartGameHandler(user),
  };
}
