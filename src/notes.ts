// SessionClaimToken
// - assigned by lobby
// - presented to game server
// - contains reconnection token if guest
// - game server checks for valid ReconnectionOpportunity and puts in game d/c'd from
// - if none, put them in game for initial connection
// - is trusted as a source of true identity
// - will not result in a valid session if no matching game exists
//
// PendingReconnection
// - written by game server on disconnect
// - read from lobby server on reconnect if client presents
//   reconnect token
// - used to send reconnecting client instructions to reconnect
//   to the correct game server and game
// - deleted by the game server on a timeout or on successful reconnect
//
// ReconnectionOpportunity
// - maintained in memory by game server
// - created on disconnect
// - sets internal timeout for expiration
// - on expiration, unpauses game for players that are still connected
//   and deletes the PendingReconnection
// - ultimate authority for expiration of a valid reconnection
// - it is possible that lobby reads a PendingReconnection, sends a client
//   instructions to connect to a game server, then the ReconnectionOpportunity times out
//   before they finish their connection to the game server. this is intended.
//
// ReconnectionToken
// - given to the client when they join a game server
// - cached on the client
// - presented to the lobby when client joins
// - lobby uses it to look up a PendingReconnection
// - if none is found, connection is treated as a new connection
