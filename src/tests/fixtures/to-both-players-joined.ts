import { expect } from "vitest";
import { MessageFromServerType } from "../../messages/from-server.js";
import { QUERY_PARAMS } from "../../servers/base-server.js";
import { LobbyServer } from "../../servers/lobby-server/index.js";
import { testGameSetupToHostJoinGameServer } from "./to-host-joined-game-server.js";

export async function testGameSetupToBothPlayersJoined(
  lobbyServer: LobbyServer
) {
  const { hostClient, joinerClient, joinerConnectionInstructions } =
    await testGameSetupToHostJoinGameServer(lobbyServer);

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
