const crypto = require("node:crypto");

function createRoomService({ rooms, getGame, makeCode, makeId }) {
  function passwordHash(value) {
    const password = String(value || "").trim();
    return password ? crypto.createHash("sha256").update(password).digest("hex") : null;
  }

  function makePlayer(name, playerToken) {
    return {
      id: makeId(),
      token: playerToken || makeId(),
      name: String(name || "玩家").trim().slice(0, 16),
      coins: 3,
      connected: true
    };
  }

  function createRoom({ name, playerToken, gameId, roomPassword }) {
    const gameDefinition = getGame(gameId);
    let roomCode;
    do roomCode = makeCode(); while (rooms.has(roomCode));
    const player = makePlayer(name || "房主", playerToken);
    const password = String(roomPassword || "").trim();
    if (password && (password.length < 4 || password.length > 32)) throw new Error("房间密码长度需要为4至32位");
    const room = { code: roomCode, gameId: gameDefinition.id, hostId: player.id, players: [player], settings: gameDefinition.defaultSettings?.() || {}, game: null, passwordHash: passwordHash(password) };
    rooms.set(roomCode, room);
    return { room, player };
  }

  function joinRoom({ rawCode, name, playerToken, roomPassword }) {
    const roomCode = String(rawCode || "").toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) throw new Error("房间不存在或服务器已经重启");
    let player = room.players.find((item) => item.token === playerToken);
    const gameDefinition = getGame(room.gameId);
    if (!player && room.passwordHash && passwordHash(roomPassword) !== room.passwordHash) throw new Error("房间密码错误");
    const reconnecting = Boolean(player && player.connected === false);
    if (!player) {
      if (room.game) throw new Error("比赛已经开始，只有原玩家可以重连");
      if (room.players.length >= gameDefinition.maxPlayers) throw new Error(`房间已满（最多 ${gameDefinition.maxPlayers} 人）`);
      player = makePlayer(name, playerToken);
      room.players.push(player);
    }
    player.connected = true;
    if (reconnecting) gameDefinition.onReconnect?.(room, player);
    return { room, player };
  }

  function startGame(room, playerId) {
    const gameDefinition = getGame(room.gameId);
    if (room.hostId !== playerId) throw new Error("只有房主可以开始比赛");
    if (room.game) throw new Error("比赛已经开始");
    const minimumToStart = gameDefinition.minimumToStart ?? gameDefinition.minPlayers;
    if (room.players.length < minimumToStart) throw new Error(`至少需要 ${minimumToStart} 人才能开始`);
    room.game = gameDefinition.createGame(room.players, room.settings);
  }

  function restartGame(room, playerId) {
    const gameDefinition = getGame(room.gameId);
    if (room.hostId !== playerId) throw new Error("只有房主可以再开一局");
    if (!room.game || room.game.status !== "finished") throw new Error("当前比赛还没有结束");
    room.game = gameDefinition.createGame(room.players, room.settings);
  }

  function configureGame(room, playerId, payload) {
    const definition = getGame(room.gameId);
    if (!definition.configure) throw new Error("这款游戏没有开局设置");
    definition.configure(room, playerId, payload);
  }

  function applyGameAction(room, playerId, action, payload = {}) {
    const handler = getGame(room.gameId).actions[action];
    if (!handler) throw new Error("这款游戏不支持该操作");
    handler(room, playerId, payload);
  }

  function publicRoom(room, viewerId) {
    const gameDefinition = getGame(room.gameId);
    return {
      ...gameDefinition.publicRoom(room, viewerId),
      gameId: gameDefinition.id,
      gameInfo: {
        id: gameDefinition.id,
        title: gameDefinition.title,
        clientScript: gameDefinition.clientScript,
        minPlayers: gameDefinition.minPlayers,
        maxPlayers: gameDefinition.maxPlayers,
        status: gameDefinition.status
      },
      roomPasswordRequired: Boolean(room.passwordHash)
    };
  }

  return { createRoom, joinRoom, startGame, restartGame, configureGame, applyGameAction, publicRoom };
}

module.exports = { createRoomService };
