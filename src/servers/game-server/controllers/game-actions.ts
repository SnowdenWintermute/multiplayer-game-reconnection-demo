import { ERROR_MESSAGES } from "../../../error-messages.js";
import {
  MessageFromServer,
  MessageFromServerType,
} from "../../../messages/from-server.js";
import { GameRegistry } from "../../game-registry/index.js";
import { MessageDispatchFactory } from "../../message-delivery/message-dispatch-factory.js";
import { MessageDispatchOutbox } from "../../message-delivery/outbox.js";
import { UserSession } from "../../sessions/user-session.js";

export class GameActionsController {
  constructor(
    private readonly gameRegistry: GameRegistry,
    private readonly updateDispatchFactory: MessageDispatchFactory<MessageFromServer>
  ) {}

  gameActionHandler(gameAction: string, session: UserSession) {
    console.log("gameActionHandler called");
    const game = session.getExpectedCurrentGame();
    game.requireTimeStarted();

    const outbox = new MessageDispatchOutbox<MessageFromServer>(
      this.updateDispatchFactory
    );
    if (game.inputLock.isLocked) {
      outbox.pushToConnection(session.connectionId, {
        type: MessageFromServerType.ErrorMessage,
        data: { message: ERROR_MESSAGES.GAME.INPUT_LOCKED },
      });
    }

    console.log("gameActionHandler", outbox.toDispatches());

    return outbox;
  }
}
