const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const { DEFAULT_GAME_ID, getGame, listGames } = require("./src/games");
const { createRoomService } = require("./src/platform/room-service");

const app = express();
const server = createServer(app);
const io = new Server(server);
const rooms = new Map();
const PORT = Number(process.env.PORT || 3000);

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get("/api/games", (_req, res) => res.json({ games: listGames() }));
app.get("/room/:code", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const roomService = createRoomService({ rooms, getGame, makeCode: code, makeId: () => crypto.randomUUID() });

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
      socket.data = { roomCode: room.code, playerId: player.id };
      ack({ ok: true, code: room.code, playerId: player.id, playerToken: player.token });
      sendRoom(room);
    } catch (error) { replyError(socket, error); ack({ ok: false, error: error.message }); }
  });

  socket.on("room:join", ({ code: rawCode, name, playerToken } = {}, ack = () => {}) => {
    try {
      const { room, player } = roomService.joinRoom({ rawCode, name, playerToken });
      socket.join(room.code);
      socket.data = { roomCode: room.code, playerId: player.id };
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
    if (player) { player.connected = false; sendRoom(room); }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`好友桌游馆已启动：http://localhost:${PORT}`);
});

module.exports = { server, rooms };
