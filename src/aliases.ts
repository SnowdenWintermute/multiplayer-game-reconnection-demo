// connections
export type ConnectionId = string & { __brand: "ConnectionId" };

// identities
export type IdentityProviderId = number & { __brand: "IdentityProviderId" };
export type GuestUserId = string & { __brand: "GuestUserId" };

// tokens
export type GuestSessionReconnectionToken = string & {
  __brand: "GuestSessionReconnectionToken";
};

// names
export type Username = string & { __brand: "Username" };
export type MessageDispatchChannelName = string & {
  __brand: "MessageDispatchChannelName";
};
export type GameName = string & { __brand: "GameName" };
export type GameServerName = string & { __brand: "GameServerName" };

// object ids
export type GameId = string & { __brand: "GameId" };
export type GameServerId = string & { __brand: "GameServerId" };

// numbers
export type Milliseconds = number & { __brand: "Milliseconds" };
