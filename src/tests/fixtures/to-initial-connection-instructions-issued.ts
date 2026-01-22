import { expect } from "vitest";
import { MessageFromServerType } from "../../messages/from-server.js";
import { TestClient } from "../test-utils/test-client.js";
import { MessageFromClientType } from "../../messages/from-client.js";
import { GameName } from "../../aliases.js";
import { invariant } from "../../utils/index.js";
import { MyGameClass } from "../../game/index.js";
import { TEST_LOBBY_URL } from "./test-servers-setup.js";
import { LobbyServer } from "../../servers/lobby-server/index.js";

export async function testGameSetupToInitialConnectionInstructionsIssued(
  lobbyServer: LobbyServer
) {
  expect(lobbyServer.gameLifecycleController.noCurrentGames()).toBe(true);
  const hostClient = new TestClient("game host");
  hostClient.initializeSocket(TEST_LOBBY_URL);
  await hostClient.connect();

  const gameHostFullUpdate = await hostClient.sendMessageAndAwaitReplyType(
    {
      type: MessageFromClientType.CreateGame,
      data: { gameName: "" as GameName },
    },
    MessageFromServerType.GameFullUpdate
  );

  const gameUpdate = gameHostFullUpdate.data;
  expect(gameUpdate.game).toBeDefined();
  invariant(gameUpdate.game !== null);

  expect(lobbyServer.gameLifecycleController.noCurrentGames()).toBe(false);

  const joinerClient = new TestClient("game joiner");
  joinerClient.initializeSocket(TEST_LOBBY_URL);

  await joinerClient.connect();

  const joinerFullUpdate = await joinerClient.sendMessageAndAwaitReplyType(
    {
      type: MessageFromClientType.JoinGame,
      data: { gameName: gameUpdate.game.name },
    },
    MessageFromServerType.GameFullUpdate
  );

  const joinerGame = joinerFullUpdate.data.game;
  expect(joinerGame).toBeDefined();
  invariant(joinerGame !== null);

  const deserializedJoinerGame = MyGameClass.getDeserialized(joinerGame);
  expect(deserializedJoinerGame.playerRegistry.players.size).toBe(2);

  const hostReadiedMessage = await hostClient.sendMessageAndAwaitReplyType(
    { type: MessageFromClientType.ToggleReadyToStartGame, data: undefined },
    MessageFromServerType.PlayerToggledReadyToStartGame
  );

  expect(hostReadiedMessage.data.username).toBe(hostClient.username);

  const hostConnectionInstructionsMessage = hostClient.awaitMessageFromServer(
    MessageFromServerType.GameServerConnectionInstructions
  );

  const joinerReadiedMessage = await joinerClient.sendMessageAndAwaitReplyType(
    { type: MessageFromClientType.ToggleReadyToStartGame, data: undefined },
    MessageFromServerType.GameServerConnectionInstructions
  );
  const joinerConnectionInstructions =
    joinerReadiedMessage.data.connectionInstructions;

  const hostConnectionInstructions = await hostConnectionInstructionsMessage;

  await hostClient.close();
  await joinerClient.close();

  return {
    joinerConnectionInstructions,
    hostConnectionInstructions,
    hostClient,
    joinerClient,
  };
}
