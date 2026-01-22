import { expect } from "vitest";
import { MessageFromServerType } from "../../messages/from-server.js";
import { QUERY_PARAMS } from "../../servers/base-server.js";
import { LobbyServer } from "../../servers/lobby-server/index.js";
import { TEST_LOBBY_URL } from "./test-servers-setup.js";
import { testGameSetupToJoinerDisconnect } from "./to-joiner-disconnect.js";

export async function testGameSetupToSuccessfulReconnect(
  lobbyServer: LobbyServer
) {
  const { joinerClient, hostClient, joinerReconnectToken } =
    await testGameSetupToJoinerDisconnect(lobbyServer);

  const joinerRejoinLobbyParams = {
    name: QUERY_PARAMS.GUEST_RECONNECTION_TOKEN,
    value: joinerReconnectToken,
  };

  joinerClient.initializeSocket(TEST_LOBBY_URL, [joinerRejoinLobbyParams]);

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
