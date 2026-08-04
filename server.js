const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const { DEFAULT_GAME_ID, getGame, listGames } = require("./src/games");
const { createRoomService } = require("./src/platform/room-service");
const { createSocketPresence } = require("./src/platform/socket-presence");
const { installRemoteQuestions, questionPackInfo } = require("./src/games/quiz-arena/questions");

const app = express();
const server = createServer(app);
const io = new Server(server);
const rooms = new Map();
const socketPresence = createSocketPresence();
const PORT = Number(process.env.PORT || 3000);

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get("/api/games", (_req, res) => res.json({ games: listGames() }));
app.get("/api/games/quiz-arena/question-pack", (_req, res) => res.json(questionPackInfo()));
app.get("/room/:code", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

async function refreshQuizPack() {
  const url = process.env.QUIZ_PACK_URL;
  if (!url) return 0;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const count = installRemoteQuestions(Array.isArray(payload) ? payload : payload.questions);
    console.log(`站神在线题包已更新：${count}题`);
    return count;
  } catch (error) {
    console.warn(`站神在线题包更新失败，继续使用本地题库：${error.message}`);
    return 0;
  }
}

refreshQuizPack();
const quizPackTicker = setInterval(refreshQuizPack, 6 * 60 * 60_000);
quizPackTicker.unref();

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const roomService = createRoomService({ rooms, getGame, makeCode: code, makeId: () => crypto.randomUUID() });
function trackPlayerSocket(socket, room, player) {
  socketPresence.track(socket.id, room, player);
  socket.data = { roomCode: room.code, playerId: player.id };
}
function untrackPlayerSocket(socket) {
  const { roomCode, playerId } = socket.data || {};
  return socketPresence.untrack(socket.id, roomCode, playerId);
}
function syncRoomConnections(room) {
  socketPresence.sync(room);
}

function sendRoom(room) {
  for (const client of io.sockets.sockets.values()) {
    if (client.data.roomCode === room.code) client.emit("room:update", roomService.publicRoom(room, client.data.playerId));
  }
}

function replyError(socket, error) {
  socket.emit("game:error", error instanceof Error ? error.message : "操作失败");
}

const gameTicker = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const definition = getGame(room.gameId);
    if (room.game && definition.tick?.(room, now)) sendRoom(room);
  }
}, 500);
gameTicker.unref();

io.on("connection", (socket) => {
  socket.on("room:create", ({ name, playerToken, gameId = DEFAULT_GAME_ID } = {}, ack = () => {}) => {
    try {
      const { room, player } = roomService.createRoom({ name, playerToken, gameId });
      socket.join(room.code);
      trackPlayerSocket(socket, room, player);
      ack({ ok: true, code: room.code, playerId: player.id, playerToken: player.token });
      sendRoom(room);
    } catch (error) { replyError(socket, error); ack({ ok: false, error: error.message }); }
  });

  socket.on("room:join", ({ code: rawCode, name, playerToken } = {}, ack = () => {}) => {
    try {
      const { room, player } = roomService.joinRoom({ rawCode, name, playerToken });
      socket.join(room.code);
      trackPlayerSocket(socket, room, player);
      ack({ ok: true, code: room.code, playerId: player.id, playerToken: player.token });
      sendRoom(room);
    } catch (error) { replyError(socket, error); ack({ ok: false, error: error.message }); }
  });

  socket.on("game:start", () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room) throw new Error("房间已经关闭");
      roomService.startGame(room, socket.data.playerId);
      sendRoom(room);
    } catch (error) { replyError(socket, error); }
  });

  socket.on("game:configure", (payload = {}) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room) throw new Error("房间已经关闭");
      roomService.configureGame(room, socket.data.playerId, payload);
      sendRoom(room);
    } catch (error) { replyError(socket, error); }
  });

  socket.on("game:restart", () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room) throw new Error("房间已经关闭");
      roomService.restartGame(room, socket.data.playerId);
      sendRoom(room);
    } catch (error) { replyError(socket, error); }
  });

  const action = (handler) => (payload = {}) => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room) throw new Error("房间已经关闭");
      syncRoomConnections(room);
      handler(room, socket.data.playerId, payload);
      sendRoom(room);
    } catch (error) { replyError(socket, error); }
  };
  socket.on("game:action", action((room, id, data) => roomService.applyGameAction(room, id, data.action, data.payload)));
  // 兼容已打开的旧客户端；新游戏统一使用 game:action。
  for (const legacyAction of ["roll", "bet", "tile", "partner", "predict"]) {
    socket.on(`game:${legacyAction}`, action((room, id, data) => roomService.applyGameAction(room, id, legacyAction, data)));
  }

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.find((item) => item.id === socket.data.playerId);
    if (player) {
      const remainingConnections = untrackPlayerSocket(socket);
      player.connected = remainingConnections > 0;
      if (!remainingConnections) getGame(room.gameId).onDisconnect?.(room, player, Date.now());
      sendRoom(room);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`好友桌游馆已启动：http://localhost:${PORT}`);
});

module.exports = { server, rooms };
