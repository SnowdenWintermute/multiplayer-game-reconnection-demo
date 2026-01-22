import { describe, afterEach, beforeEach, it, expect } from "vitest";
import { LobbyServer } from "../servers/lobby-server/index.js";
import { GameServer } from "../servers/game-server/index.js";
import { MessageFromServerType } from "../messages/from-server.js";
import { MessageFromClientType } from "../messages/from-client.js";
import { QUERY_PARAMS } from "../servers/base-server.js";
import { RECONNECTION_OPPORTUNITY_TIMEOUT_MS } from "../servers/game-server/reconnection/reconnection-protocol.js";
import { ERROR_MESSAGES } from "../error-messages.js";
import {
  setUpTestServers,
  TEST_LOBBY_URL,
} from "./fixtures/test-servers-setup.js";
import { TimeMachine } from "./test-utils/time-machine.js";
import { testGameSetupToHostJoinGameServer } from "./fixtures/to-host-joined-game-server.js";
import { testGameSetupToJoinerDisconnect } from "./fixtures/to-joiner-disconnect.js";
import { testGameSetupToSuccessfulReconnect } from "./fixtures/to-successful-reconnect.js";
import { testGameSetupToInitialConnectionInstructionsIssued } from "./fixtures/to-initial-connection-instructions-issued.js";

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

    joinerClient.initializeSocket(TEST_LOBBY_URL, [joinerRejoinLobbyParams]);
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

  it("session claim token", async () => {
    const { hostClient, hostConnectionInstructions } =
      await testGameSetupToInitialConnectionInstructionsIssued(lobbyServer);

    hostClient.initializeSocket(
      hostConnectionInstructions.data.connectionInstructions.url
    );
    // don't allow connecting without token
    await expect(hostClient.connect()).rejects.toThrow();
  });

  it("reconnect token reuse", async () => {
    const { joinerClient, usedJoinerReconnectToken } =
      await testGameSetupToSuccessfulReconnect(lobbyServer);

    await joinerClient.close();

    const joinerClientQueryParams = {
      name: QUERY_PARAMS.GUEST_RECONNECTION_TOKEN,
      value: usedJoinerReconnectToken,
    };
    joinerClient.initializeSocket(TEST_LOBBY_URL, [joinerClientQueryParams]);

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
