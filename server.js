const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const { createGame, rollDie, takeLegBet, placeTile, predict, publicRoom } = require("./src/game");

const app = express();
const server = createServer(app);
const io = new Server(server);
const rooms = new Map();
const PORT = Number(process.env.PORT || 3000);

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get("/room/:code", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function sendRoom(room) {
  io.to(room.code).emit("room:update", publicRoom(room));
}

function replyError(socket, error) {
  socket.emit("game:error", error instanceof Error ? error.message : "操作失败");
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name, playerToken } = {}, ack = () => {}) => {
    try {
      let roomCode;
      do roomCode = code(); while (rooms.has(roomCode));
      const player = { id: crypto.randomUUID(), token: playerToken || crypto.randomUUID(), name: String(name || "房主").trim().slice(0, 16), coins: 3, connected: true };
      const room = { code: roomCode, hostId: player.id, players: [player], game: null };
      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.data = { roomCode, playerId: player.id };
      ack({ ok: true, code: roomCode, playerId: player.id, playerToken: player.token });
      sendRoom(room);
    } catch (error) { replyError(socket, error); }
  });

  socket.on("room:join", ({ code: rawCode, name, playerToken } = {}, ack = () => {}) => {
    try {
      const roomCode = String(rawCode || "").toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) throw new Error("房间不存在或服务器已经重启");
      let player = room.players.find((item) => item.token === playerToken);
      if (!player) {
        if (room.game) throw new Error("比赛已经开始，只有原玩家可以重连");
        if (room.players.length >= 8) throw new Error("房间已满（最多 8 人）");
        player = { id: crypto.randomUUID(), token: playerToken || crypto.randomUUID(), name: String(name || "玩家").trim().slice(0, 16), coins: 3, connected: true };
        room.players.push(player);
      }
      player.connected = true;
      socket.join(roomCode);
      socket.data = { roomCode, playerId: player.id };
      ack({ ok: true, code: roomCode, playerId: player.id, playerToken: player.token });
      sendRoom(room);
    } catch (error) { replyError(socket, error); ack({ ok: false, error: error.message }); }
  });

  socket.on("game:start", () => {
    try {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.hostId !== socket.data.playerId) throw new Error("只有房主可以开始比赛");
      if (room.game) throw new Error("比赛已经开始");
      room.game = createGame(room.players);
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
  socket.on("game:roll", action((room, id) => rollDie(room, id)));
  socket.on("game:bet", action((room, id, data) => takeLegBet(room, id, data.color)));
  socket.on("game:tile", action((room, id, data) => placeTile(room, id, data.space, data.type)));
  socket.on("game:predict", action((room, id, data) => predict(room, id, data.color, data.type)));

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.find((item) => item.id === socket.data.playerId);
    if (player) { player.connected = false; sendRoom(room); }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`骆驼快跑好友房已启动：http://localhost:${PORT}`);
});

module.exports = { server, rooms };
