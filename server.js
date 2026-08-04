const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const { DEFAULT_GAME_ID, getGame, listGames } = require("./src/games");
const { createRoomService } = require("./src/platform/room-service");
const { createSocketPresence } = require("./src/platform/socket-presence");
const { createAccessService } = require("./src/platform/access-service");
const { createDatabase } = require("./src/platform/database");
const { createPersistentAccessService } = require("./src/platform/persistent-access-service");
const { installRemoteQuestions, questionPackInfo, CHARACTER_IMAGE_QUERIES, CHILD_CHARACTER_IMAGE_URLS } = require("./src/games/quiz-arena/questions");

const app = express();
const server = createServer(app);
const io = new Server(server);
const rooms = new Map();
const socketPresence = createSocketPresence();
const PORT = Number(process.env.PORT || 3000);
const characterImageCache = new Map();
const database = createDatabase();
const accessService = createPersistentAccessService({ database, fallback: createAccessService() });
accessService.ready().then(() => console.log(database.enabled ? "Neon 数据库已连接，权限与审计日志已持久化" : "未配置 DATABASE_URL，暂时使用内存权限存储")).catch((error) => console.error(`数据库初始化失败：${error.message}`));

async function resolveCharacterImage(imageKey) {
  const cached = characterImageCache.get(imageKey);
  if (cached) return await cached;
  const fixedImageUrl = CHILD_CHARACTER_IMAGE_URLS[imageKey];
  const search = CHARACTER_IMAGE_QUERIES[imageKey];
  if (!search && !fixedImageUrl) throw new Error("未知角色图鉴编号");
  const request = (async () => {
    if (fixedImageUrl) return fixedImageUrl;
    const query = "query ($search: String) { Page(perPage: 1) { characters(search: $search) { image { large } } } }";
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "FriendsBoardGameQuiz/1.0" },
      body: JSON.stringify({ query, variables: { search } }),
      signal: AbortSignal.timeout(8000)
    });
    const payload = await response.json();
    const imageUrl = payload?.data?.Page?.characters?.[0]?.image?.large;
    if (!response.ok || !imageUrl) throw new Error(`角色图片服务暂不可用 (${response.status})`);
    return imageUrl;
  })();
  characterImageCache.set(imageKey, request);
  try {
    const imageUrl = await request;
    characterImageCache.set(imageKey, imageUrl);
    return imageUrl;
  } catch (error) {
    characterImageCache.delete(imageKey);
    throw error;
  }
}

function characterImageFallback() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480"><defs><radialGradient id="g"><stop stop-color="#254b73"/><stop offset="1" stop-color="#071426"/></radialGradient></defs><rect width="360" height="480" rx="28" fill="url(#g)"/><circle cx="180" cy="170" r="74" fill="#65e7ff" opacity=".22"/><path d="M104 390c10-91 43-138 76-138s66 47 76 138" fill="#8b6dff" opacity=".3"/><text x="180" y="420" fill="#9edfeb" font-family="sans-serif" font-size="16" text-anchor="middle">影像信号暂时中断</text></svg>`;
}

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get("/api/games", (_req, res) => res.json({ games: listGames() }));
function adminToken(req) {
  const header = req.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}
async function requireAdmin(req, res, next) {
  const token = adminToken(req);
  const grant = await accessService.status(token);
  if (!grant.active || grant.role !== "admin") {
    await accessService.audit({ actorType: "request", actorId: token ? "invalid-token" : "anonymous", action: "admin_access_denied", ip: req.ip, metadata: { method: req.method, path: req.path } });
    return res.status(403).json({ error: "需要管理员权限" });
  }
  await accessService.audit({ actorType: "admin", actorId: grant.actorId || "admin-token", action: "admin_access", ip: req.ip, metadata: { method: req.method, path: req.path } });
  req.adminActorId = grant.actorId || "admin-token";
  next();
}
app.get("/api/admin/overview", requireAdmin, (_req, res) => {
  const overview = [...rooms.values()].map((room) => ({
    code: room.code,
    gameId: room.gameId,
    title: getGame(room.gameId).title,
    host: room.players.find((player) => player.id === room.hostId)?.name || "未知房主",
    players: room.players.map((player) => ({ name: player.name, connected: Boolean(player.connected) })),
    started: Boolean(room.game),
    createdAt: room.createdAt || null
  }));
  res.json({ rooms: overview, total: overview.length });
});
app.get("/api/admin/audit", requireAdmin, async (req, res) => {
  res.json({ logs: await accessService.listAudit(req.query.limit) });
});
app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.post("/api/admin/rooms/:code/close", requireAdmin, async (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: "房间不存在" });
  rooms.delete(code);
  await accessService.audit({ actorType: "admin", actorId: req.adminActorId, action: "room_closed", roomCode: code, ip: req.ip, metadata: { reason: "administrator_action" } });
  for (const client of io.sockets.sockets.values()) {
    if (client.data.roomCode === code) {
      client.emit("game:error", "房间已被管理员关闭");
      client.disconnect(true);
    }
  }
  res.json({ ok: true });
});
app.get("/api/games/quiz-arena/question-pack", (_req, res) => res.json(questionPackInfo()));
app.get("/api/games/quiz-arena/character-image/:imageKey", async (req, res) => {
  try {
    const imageUrl = await resolveCharacterImage(req.params.imageKey);
    res.set("Cache-Control", "public, max-age=86400").redirect(302, imageUrl);
  } catch (_error) {
    res.set("Cache-Control", "public, max-age=300").type("image/svg+xml").send(characterImageFallback());
  }
});
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
  socket.on("access:status", async ({ token } = {}, ack = () => {}) => {
    const status = await accessService.status(token);
    if (status.role === "admin") await accessService.audit({ actorType: "admin", actorId: status.actorId || "admin-token", action: "admin_login", ip: socket.handshake.address });
    ack(status);
  });

  socket.on("access:redeem", async ({ code } = {}, ack = () => {}) => {
    try {
      const grant = await accessService.issue(code);
      await accessService.audit({ actorType: grant.role === "admin" ? "admin" : "tester", actorId: grant.actorId || (grant.role === "admin" ? "admin-token" : "tester-token"), action: grant.role === "admin" ? "admin_redeem" : "tester_redeem", ip: socket.handshake.address });
      ack({ ok: true, ...grant });
    } catch (error) {
      await accessService.audit({ actorType: "request", actorId: "invalid-activation", action: "activation_failed", ip: socket.handshake.address, metadata: { codeLength: String(code || "").length } });
      ack({ ok: false, error: error.message });
    }
  });

  socket.on("room:create", async ({ name, playerToken, accessToken, gameId = DEFAULT_GAME_ID } = {}, ack = () => {}) => {
    try {
      if (!(await accessService.valid(accessToken))) throw new Error("请先输入有效的内部激活码");
      const { room, player } = roomService.createRoom({ name, playerToken, gameId });
      await accessService.audit({ actorType: "player", actorId: player.id, action: "room_created", roomCode: room.code, ip: socket.handshake.address, metadata: { gameId } });
      socket.join(room.code);
      trackPlayerSocket(socket, room, player);
      ack({ ok: true, code: room.code, playerId: player.id, playerToken: player.token });
      sendRoom(room);
    } catch (error) { replyError(socket, error); ack({ ok: false, error: error.message }); }
  });

  socket.on("room:join", async ({ code: rawCode, name, playerToken, accessToken } = {}, ack = () => {}) => {
    try {
      if (!(await accessService.valid(accessToken))) throw new Error("请先输入有效的内部激活码");
      const { room, player } = roomService.joinRoom({ rawCode, name, playerToken });
      await accessService.audit({ actorType: "player", actorId: player.id, action: "room_joined", roomCode: room.code, ip: socket.handshake.address });
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
