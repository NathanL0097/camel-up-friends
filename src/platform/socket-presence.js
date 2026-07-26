function createSocketPresence() {
  const connections = new Map();
  const key = (roomCode, playerId) => `${roomCode}:${playerId}`;

  function track(socketId, room, player) {
    const playerKey = key(room.code, player.id);
    const sockets = connections.get(playerKey) || new Set();
    sockets.add(socketId);
    connections.set(playerKey, sockets);
    player.connected = true;
    return sockets.size;
  }

  function untrack(socketId, roomCode, playerId) {
    if (!roomCode || !playerId) return 0;
    const playerKey = key(roomCode, playerId);
    const sockets = connections.get(playerKey);
    if (!sockets) return 0;
    sockets.delete(socketId);
    if (!sockets.size) connections.delete(playerKey);
    return sockets.size;
  }

  function sync(room) {
    room.players.forEach((player) => {
      player.connected = (connections.get(key(room.code, player.id))?.size || 0) > 0;
    });
  }

  return { track, untrack, sync };
}

module.exports = { createSocketPresence };
