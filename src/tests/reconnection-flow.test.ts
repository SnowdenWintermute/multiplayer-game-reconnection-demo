import { describe, afterEach, beforeEach, it, expect } from "vitest";
import { LobbyServer } from "../servers/lobby-server/index.js";
import { GameServer } from "../servers/game-server/index.js";
import { GameName } from "../aliases.js";
import { MessageFromServerType } from "../messages/from-server.js";
import { MessageFromClientType } from "../messages/from-client.js";
import { TestClient } from "./test-client.js";
import { invariant } from "../utils/index.js";
import { MyGameClass } from "../game/index.js";
import {
  localServerUrl,
  setUpTestServers,
  TEST_LOBBY_PORT,
} from "./test-servers-setup.js";
import { QUERY_PARAMS } from "../servers/base-server.js";
import { RECONNECTION_OPPORTUNITY_TIMEOUT_MS } from "../servers/game-server/reconnection/reconnection-protocol.js";
import { TimeMachine } from "./time-machine.js";
import { ERROR_MESSAGES } from "../error-messages.js";

const lobbyUrl = localServerUrl(TEST_LOBBY_PORT);

describe("lobby server", () => {
  let gameServer: GameServer;
  let lobbyServer: LobbyServer;
  const timeMachine = new TimeMachine();

  beforeEach(async () => {
    const testServers = await setUpTestServers();
    lobbyServer = testServers.lobbyServer;
    gameServer = testServers.gameServer;
  });

  afterEach(async () => {
    lobbyServer.websocketServer.close();
    gameServer.websocketServer.close();
    timeMachine.returnToPresent();
  });

  it("pre game start input", async () => {
    const { hostClient } = await testGameSetupToHostJoinGameServer(lobbyServer);

    // don't allow input before all players are in game
    await hostClient.sendMessageAndAwaitReplyType(
      {
        type: MessageFromClientType.AttemptGameplayAction,
        data: { action: "" },
      },
      MessageFromServerType.ErrorMessage
    );
  });

  it("input while awaiting reconnect", async () => {
    const { hostClient } = await testGameSetupToJoinerDisconnect(lobbyServer);

    const noInputWhileWaitingReconnectMessage =
      await hostClient.sendMessageAndAwaitReplyType(
        {
          type: MessageFromClientType.AttemptGameplayAction,
          data: { action: "" },
        },
        MessageFromServerType.ErrorMessage
      );

    expect(noInputWhileWaitingReconnectMessage.data.message).toBe(
      ERROR_MESSAGES.GAME.INPUT_LOCKED
    );
  });

  it("input after timeout", async () => {
    timeMachine.start();
    const { hostClient } = await testGameSetupToJoinerDisconnect(lobbyServer);

    timeMachine.advanceTime(RECONNECTION_OPPORTUNITY_TIMEOUT_MS);

    const inputAllowedAfterReconnectTimeoutMessage =
      await hostClient.sendMessageAndAwaitReplyType(
        {
          type: MessageFromClientType.AttemptGameplayAction,
          data: { action: "" },
        },
        MessageFromServerType.PlayerTookAction
      );

    expect(inputAllowedAfterReconnectTimeoutMessage.data.username).toBe(
      hostClient.username
    );
  });

  it("input after reconnect", async () => {
    const { joinerClient, hostClient } =
      await testGameSetupToSuccessfulReconnect(lobbyServer);

    const hostInputPermittedMessage =
      await hostClient.sendMessageAndAwaitReplyType(
        {
          type: MessageFromClientType.AttemptGameplayAction,
          data: { action: "" },
        },
        MessageFromServerType.PlayerTookAction
      );

    expect(hostInputPermittedMessage.data.username).toBe(hostClient.username);

    // We must pass the expected data because otherwise joiner client will
    // receive its message that the host took action BEFORE it receives
    // the notification that the joiner client took action. See the fanout code in
    // OutgoingMessageGateway.
    const joinerInputPermittedMessage =
      await joinerClient.sendMessageAndAwaitReplyType(
        {
          type: MessageFromClientType.AttemptGameplayAction,
          data: { action: "" },
        },
        MessageFromServerType.PlayerTookAction,
        { expectedData: { username: joinerClient.username } }
      );

    expect(joinerInputPermittedMessage.data.username).toBe(
      joinerClient.username
    );
  });

  it("reconnect after timeout", async () => {
    timeMachine.start();

    const { joinerClient, joinerReconnectToken } =
      await testGameSetupToJoinerDisconnect(lobbyServer);

    const joinerRejoinLobbyParams = {
      name: QUERY_PARAMS.GUEST_RECONNECTION_TOKEN,
      value: joinerReconnectToken,
    };

    joinerClient.initializeSocket(lobbyUrl, [joinerRejoinLobbyParams]);
    timeMachine.advanceTime(RECONNECTION_OPPORTUNITY_TIMEOUT_MS);
    timeMachine.returnToPresent();

    // takes too long, have to wait for real timeout, but truly shows
    // we don't get connection instructions
    // const joinerClientRejoinSessionClaimTokenListener =
    //   joinerClient.awaitMessageFromServer(
    //     MessageFromServerType.GameServerConnectionInstructions
    //   );
    // await joinerClient.connect();
    // await expect(joinerClientRejoinSessionClaimTokenListener).rejects.toThrow();

    // takes too long, have to wait for real timeout
    const joinerClientInitialJoinUsernameMessageListener =
      joinerClient.awaitMessageFromServer(MessageFromServerType.ClientUsername);

    const joinerClientInitialJoinUsernameMessage =
      await joinerClientInitialJoinUsernameMessageListener;
    expect(joinerClientInitialJoinUsernameMessage.data.username).toBeDefined();
  });

  it("reconnect token reuse", async () => {
    const { joinerClient, usedJoinerReconnectToken } =
      await testGameSetupToSuccessfulReconnect(lobbyServer);

    await joinerClient.close();

    const joinerClientQueryParams = {
      name: QUERY_PARAMS.GUEST_RECONNECTION_TOKEN,
      value: usedJoinerReconnectToken,
    };
    joinerClient.initializeSocket(lobbyUrl, [joinerClientQueryParams]);

    const joinerClientRejoinSessionClaimTokenListener =
      joinerClient.awaitMessageFromServer(MessageFromServerType.ClientUsername);
    await joinerClient.connect();

    await joinerClientRejoinSessionClaimTokenListener;
  });

  it("session claim token reuse", async () => {
    const { hostClient, hostConnectionInstructions, hostClientQueryParams } =
      await testGameSetupToHostJoinGameServer(lobbyServer);

    await hostClient.close(); // optionally don't even close the connection, should still throw

    hostClient.initializeSocket(hostConnectionInstructions.url, [
      hostClientQueryParams,
    ]);
    await expect(hostClient.connect()).rejects.toThrow();
  });
});

async function testGameSetupToSuccessfulReconnect(lobbyServer: LobbyServer) {
  const { joinerClient, hostClient, joinerReconnectToken } =
    await testGameSetupToJoinerDisconnect(lobbyServer);

  const joinerRejoinLobbyParams = {
    name: QUERY_PARAMS.GUEST_RECONNECTION_TOKEN,
    value: joinerReconnectToken,
  };

  joinerClient.initializeSocket(lobbyUrl, [joinerRejoinLobbyParams]);

  //
  const joinerClientRejoinSessionClaimTokenListener =
    joinerClient.awaitMessageFromServer(
      MessageFromServerType.GameServerConnectionInstructions
    );
  await joinerClient.connect();

  const joinerRejoinSessionClaimTokenMessage =
    await joinerClientRejoinSessionClaimTokenListener;
  const rejoinConnectionInstructions =
    joinerRejoinSessionClaimTokenMessage.data.connectionInstructions;

  await joinerClient.close();

  const joinerRejoinGameServerParams = {
    name: QUERY_PARAMS.SESSION_CLAIM_TOKEN,
    value: rejoinConnectionInstructions.encryptedSessionClaimToken,
  };
  joinerClient.initializeSocket(rejoinConnectionInstructions.url, [
    joinerRejoinGameServerParams,
  ]);
  const joinerClientRejoinGameServerMessageListener =
    joinerClient.awaitMessageFromServer(MessageFromServerType.GameFullUpdate);
  await joinerClient.connect();

  const rejoinGameServerMessage =
    await joinerClientRejoinGameServerMessageListener;

  expect(rejoinGameServerMessage.data.game).toBeDefined();

  return {
    joinerClient,
    hostClient,
    usedJoinerReconnectToken: joinerReconnectToken,
  };
}

async function testGameSetupToJoinerDisconnect(lobbyServer: LobbyServer) {
  const { joinerClient, hostClient, joinerReconnectToken } =
    await testGameSetupBothPlayersJoined(lobbyServer);

  await joinerClient.close();
  return { joinerClient, hostClient, joinerReconnectToken };
}

async function testGameSetupBothPlayersJoined(lobbyServer: LobbyServer) {
  const { hostClient, joinerClient, joinerConnectionInstructions } =
    await testGameSetupToHostJoinGameServer(lobbyServer);

  // joiner joins
  const joinerClientQueryParams = {
    name: QUERY_PARAMS.SESSION_CLAIM_TOKEN,
    value: joinerConnectionInstructions.encryptedSessionClaimToken,
  };

  joinerClient.initializeSocket(joinerConnectionInstructions.url, [
    joinerClientQueryParams,
  ]);

  const joinerReconnectTokenMessageListener =
    joinerClient.awaitMessageFromServer(
      MessageFromServerType.CacheGuestSessionReconnectionToken
    );
  const joinerClientGetsGameOnGameServerJoinMessageListener =
    joinerClient.awaitMessageFromServer(MessageFromServerType.GameFullUpdate);
  const gameStartedMessageListener = joinerClient.awaitMessageFromServer(
    MessageFromServerType.GameStarted
  );
  await joinerClient.connect();

  const joinerReconnectTokenMessage = await joinerReconnectTokenMessageListener;
  const joinerReconnectToken = joinerReconnectTokenMessage.data.token;

  const joinerGameDataOnJoinMessage =
    await joinerClientGetsGameOnGameServerJoinMessageListener;
  expect(joinerGameDataOnJoinMessage.data.game).toBeDefined();
  const gameStartedMessage = await gameStartedMessageListener;
  expect(gameStartedMessage.data.timeStarted).toBeDefined();

  return { hostClient, joinerClient, joinerReconnectToken };
}

async function testGameSetupToHostJoinGameServer(lobbyServer: LobbyServer) {
  expect(lobbyServer.gameLifecycleController.noCurrentGames()).toBe(true);
  const hostClient = new TestClient("game host");
  hostClient.initializeSocket(lobbyUrl);
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
  joinerClient.initializeSocket(lobbyUrl);

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

  hostClient.initializeSocket(
    hostConnectionInstructions.data.connectionInstructions.url
  );
  // don't allow connecting without token
  await expect(hostClient.connect()).rejects.toThrow();

  const hostClientQueryParams = {
    name: QUERY_PARAMS.SESSION_CLAIM_TOKEN,
    value:
      hostConnectionInstructions.data.connectionInstructions
        .encryptedSessionClaimToken,
  };

  // successful connection with token
  hostClient.initializeSocket(
    hostConnectionInstructions.data.connectionInstructions.url,
    [hostClientQueryParams]
  );
  const clientGetsGameOnGameServerJoin = hostClient.awaitMessageFromServer(
    MessageFromServerType.GameFullUpdate
  );
  await hostClient.connect();

  const hostGameDataOnJoin = await clientGetsGameOnGameServerJoin;
  expect(hostGameDataOnJoin.data.game).toBeDefined();

  return {
    hostClient,
    joinerClient,
    joinerConnectionInstructions,
    hostConnectionInstructions:
      hostConnectionInstructions.data.connectionInstructions,
    hostClientQueryParams,
  };
}
