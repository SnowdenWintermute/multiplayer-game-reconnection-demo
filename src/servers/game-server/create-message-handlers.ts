import {
  MessageFromClientMap,
  MessageFromClientType,
} from "../../messages/from-client.js";
import { MessageFromServer } from "../../messages/from-server.js";
import { MessageDispatchOutbox } from "../message-delivery/outbox.js";
import { UserSession } from "../sessions/user-session.js";
import { GameServer } from "./index.js";

export type GameServerMessageFromClientHandler<
  K extends keyof MessageFromClientMap,
> = (
  data: MessageFromClientMap[K],
  user: UserSession
) =>
  | MessageDispatchOutbox<MessageFromServer>
  | Promise<MessageDispatchOutbox<MessageFromServer>>;

export type GameServerMessageFromClientHandlers = {
  [K in keyof MessageFromClientMap]: GameServerMessageFromClientHandler<K>;
};

export function createGameServerMessageFromClientHandlers(
  gameServer: GameServer
): Partial<GameServerMessageFromClientHandlers> {
  return {
    [MessageFromClientType.AttemptGameplayAction]: (data, user) =>
      gameServer.gameActionsController.gameActionHandler(data.action, user),
  };
}
