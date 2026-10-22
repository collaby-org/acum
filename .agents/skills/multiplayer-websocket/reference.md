# Multiplayer WebSocket — Protocol & Examples

## Message Protocol

### Client → Server

| type     | When             | Payload                                                                 |
| -------- | ---------------- | ----------------------------------------------------------------------- |
| `join`   | After open       | `{ type: "join", name: string, color: string }`                         |
| `update` | Throttled (50ms) | `{ type: "update", position, quaternion, heading, pitch, roll, speed }` |
| `leave`  | Before close     | `{ type: "leave" }`                                                     |

### Server → Client

| type           | When                    | Payload                                                     |
| -------------- | ----------------------- | ----------------------------------------------------------- |
| `welcome`      | After join              | `{ type: "welcome", id: string }`                           |
| `players`      | Every 50ms              | `{ type: "players", players: PlayerState[] }` (within 500m) |
| `playerJoined` | Someone in range joined | `{ type: "playerJoined", player: PlayerState }`             |
| `playerLeft`   | Someone left            | `{ type: "playerLeft", id: string }`                        |

---

## Example 1: Using the hook in a page

```tsx
// Resolve WebSocket URL (env or same host)
function getMultiplayerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MULTIPLAYER_URL || "";
  if (configured) return configured;
  if (typeof window === "undefined") return "ws://localhost:3001";
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (window.location.hostname === "localhost")
    return `${wsProtocol}//localhost:3001`;
  return `${wsProtocol}//${window.location.hostname}:3001`;
}

// In component
const multiplayerUrl = mounted ? getMultiplayerUrl() : "ws://localhost:3001";

const { isConnected, nearbyPlayers, sendUpdate, playerCount } = useMultiplayer({
  serverUrl: multiplayerUrl,
  playerName: playerName || "Anonymous",
  planeColor,
  enabled: started, // only connect after user starts
});

// Render other players
<OtherPlayers
  players={nearbyPlayers}
  localPlayerPosition={localPlayerPositionRef.current}
/>;
```

---

## Example 2: Sending updates from a position callback

Hook throttles to 50ms internally; you can throttle the callback further to reduce work.

```tsx
const sendUpdate = useMultiplayer({ ... }).sendUpdate;

const handlePlanePositionChange = useCallback(
  (position: THREE.Vector3, quaternion: THREE.Quaternion) => {
    localPlayerPositionRef.current.copy(position);
    localPlayerQuaternionRef.current.copy(quaternion);

    sendUpdate({
      position: { x: position.x, y: position.y, z: position.z },
      quaternion: {
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w,
      },
      heading,
      pitch,
      roll,
      speed: flightSpeed,
    });
  },
  [sendUpdate, heading, pitch, roll, flightSpeed]
);
```

---

## Example 3: MultiplayerManager inside R3F Canvas (useFrame)

Keeps high-frequency updates inside the Canvas and uses refs so parent does not re-render on every tick.

```tsx
export function MultiplayerManager({
  serverUrl,
  playerName,
  planeColor,
  enabled,
  localPlayerPositionRef,
  localPlayerQuaternionRef,
  flightDataRef,
  onConnectionChange,
}: MultiplayerManagerProps) {
  const { isConnected, nearbyPlayers, sendUpdate, playerCount } =
    useMultiplayer({
      serverUrl,
      playerName,
      planeColor,
      enabled,
    });

  useFrame(() => {
    if (!isConnected || !localPlayerPositionRef.current) return;
    const pos = localPlayerPositionRef.current;
    const quat = localPlayerQuaternionRef.current;
    const flightData = flightDataRef.current || {
      heading: 0,
      pitch: 0,
      roll: 0,
      speed: 0,
    };

    sendUpdate({
      position: { x: pos.x, y: pos.y, z: pos.z },
      quaternion: { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
      heading: flightData.heading,
      pitch: flightData.pitch,
      roll: flightData.roll,
      speed: flightData.speed,
    });
  });

  return (
    <OtherPlayers
      players={nearbyPlayers}
      localPlayerPosition={
        localPlayerPositionRef.current ?? fallbackPosition.current
      }
    />
  );
}
```

---

## Example 4: Server — handleMessage and broadcast

```ts
// In multiplayer-server.ts

function handleMessage(ws: WebSocket, playerId: string, data: string): void {
  const message = JSON.parse(data) as ClientMessage;
  switch (message.type) {
    case "join":
      handleJoin(ws, playerId, message);
      break;
    case "update":
      handleUpdate(playerId, message);
      break;
    case "leave":
      handleLeave(playerId);
      break;
  }
}

function broadcastNearbyPlayers(): void {
  for (const [playerId, socket] of sockets) {
    if (socket.readyState !== WebSocket.OPEN) continue;
    const nearbyPlayers = getNearbyPlayers(playerId, VISIBILITY_RADIUS);
    socket.send(JSON.stringify({ type: "players", players: nearbyPlayers }));
  }
}

// Run every 50ms
setInterval(broadcastNearbyPlayers, BROADCAST_INTERVAL_MS);
```

---

## Constants (src/types/multiplayer.ts)

| Constant                    | Value | Meaning                                          |
| --------------------------- | ----- | ------------------------------------------------ |
| `VISIBILITY_RADIUS`         | 500   | Max distance (m) to include a player in "nearby" |
| `FADE_START_DISTANCE`       | 300   | Start fading other players' opacity              |
| `BROADCAST_INTERVAL_MS`     | 50    | Server sends `players` every 50ms                |
| `CLIENT_UPDATE_INTERVAL_MS` | 50    | Hook throttles sendUpdate to 50ms                |
| `STALE_PLAYER_TIMEOUT_MS`   | 10000 | Server removes player after 10s no update        |
| `RECONNECT_INTERVAL_MS`     | 5000  | Client retries connect after 5s                  |
