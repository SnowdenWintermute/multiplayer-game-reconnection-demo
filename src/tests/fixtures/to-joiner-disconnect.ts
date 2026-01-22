import { LobbyServer } from "../../servers/lobby-server/index.js";
import { testGameSetupToBothPlayersJoined } from "./to-both-players-joined.js";

export async function testGameSetupToJoinerDisconnect(
  lobbyServer: LobbyServer
) {
  const { joinerClient, hostClient, joinerReconnectToken } =
    await testGameSetupToBothPlayersJoined(lobbyServer);

  await joinerClient.close();
  return { joinerClient, hostClient, joinerReconnectToken };
}
