export const ERROR_MESSAGES = {
  USER: {
    IN_GAME_ON_ANOTHER_SESSION: "User is in a game on another session",
  },
  USER_SESSION: {
    AUTH_REQUIRED: "User is not logged in",
    ALREADY_IN_GAME: "Already in a game",
    NOT_IN_GAME: "Not in a game",
  },
  GAME: {
    NOT_FOUND: "Game not found",
    ALREADY_EXISTS: "A game by that name already exists",
    ALREADY_HANDED_OFF: "The game was already handed off to the game server",
    ALREADY_STARTED: "The game was already started",
    INPUT_LOCKED: "That game is not currently accepting player inputs",
  },
  PLAYER: {
    DOES_NOT_EXIST: "No player was found",
  },
  INVARIANT_FALED: "Code was reached that should have been impossible",
};
