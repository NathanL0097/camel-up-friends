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
const { installRemoteQuestions, questionPackInfo, CHARACTER_IMAGE_TERMS } = require("./src/games/quiz-arena/questions");

const app = express();
const server = createServer(app);
const io = new Server(server);
const rooms = new Map();
const socketPresence = createSocketPresence();
const PORT = Number(process.env.PORT || 3000);
const characterImageCache = new Map();
const database = createDatabase();
const accessService = createPersistentAccessService({ database, fallback: createAccessService() });
const retiredQuizKeys = new Set();
const retiredDrawWords = new Set();
const retiredQuizKeysReady = (async () => {
  if (!database.enabled) return;
  await database.ready();
  const result = await database.query("SELECT knowledge_key FROM quiz_retired_questions");
  result.rows.forEach((row) => retiredQuizKeys.add(row.knowledge_key));
  console.log(`站神永久废题库已载入：${retiredQuizKeys.size}题`);
})().catch((error) => console.error(`站神永久废题库载入失败：${error.message}`));
const retiredDrawWordsReady = (async () => {
  if (!database.enabled) return;
  await database.ready();
  const result = await database.query("SELECT word FROM draw_retired_words");
  result.rows.forEach((row) => retiredDrawWords.add(row.word));
  console.log(`你画我猜永久废题库已载入：${retiredDrawWords.size}题`);
})().catch((error) => console.error(`你画我猜永久废题库载入失败：${error.message}`));
accessService.ready().then(() => console.log(database.enabled ? "Neon 数据库已连接，权限与审计日志已持久化" : "未配置 DATABASE_URL，暂时使用内存权限存储")).catch((error) => console.error(`数据库初始化失败：${error.message}`));
async function recordAudit(event) {
  try { await accessService.audit(event); } catch (error) { console.warn(`审计日志写入失败：${error.message}`); }
}

function quizOwnerHash(token) {
  return crypto.createHash("sha256").update(String(token || "anonymous-host")).digest("hex");
}

async function loadQuizHistory(room, player) {
  if (room.gameId !== "quiz-arena") return;
  room.quizOwnerHash = quizOwnerHash(player.token);
  room.quizHistoryKeys = new Set();
  room.quizPersistedKeys = new Set();
  await retiredQuizKeysReady;
  retiredQuizKeys.forEach((key) => room.quizHistoryKeys.add(key));
  if (!database.enabled) return;
  await database.ready();
  const result = await database.query("SELECT knowledge_key FROM quiz_question_history WHERE owner_hash = $1", [room.quizOwnerHash]);
  for (const row of result.rows) {
    room.quizHistoryKeys.add(row.knowledge_key);
    room.quizPersistedKeys.add(row.knowledge_key);
  }
}

async function loadDrawHistory(room) {
  if (room.gameId !== "draw-and-guess") return;
  await retiredDrawWordsReady;
  room.drawRetiredWords = new Set(retiredDrawWords);
}

async function retireDrawWord(room) {
  const word = room.gameId === "draw-and-guess" ? room.game?.word : null;
  if (!word || retiredDrawWords.has(word)) return;
  retiredDrawWords.add(word);
  room.drawRetiredWords?.add(word);
  if (!database.enabled) return;
  try {
    await database.query(`
      INSERT INTO draw_retired_words (word, room_code)
      VALUES ($1, $2)
      ON CONFLICT (word) DO NOTHING
    `, [word, room.code]);
  } catch (error) {
    retiredDrawWords.delete(word);
    console.warn(`你画我猜废题写入失败：${error.message}`);
  }
}

async function retireQuizQuestion(room) {
  if (room.gameId !== "quiz-arena" || !room.game?.question?.knowledgeKey) return;
  const key = room.game.question.knowledgeKey;
  if (retiredQuizKeys.has(key)) return;
  retiredQuizKeys.add(key);
  room.quizHistoryKeys?.add(key);
  if (!database.enabled) return;
  try {
    await database.query(`
      INSERT INTO quiz_retired_questions (knowledge_key, room_code)
      VALUES ($1, $2)
      ON CONFLICT (knowledge_key) DO NOTHING
    `, [key, room.code]);
  } catch (error) {
    retiredQuizKeys.delete(key);
    console.warn(`站神永久废题写入失败：${error.message}`);
  }
}

async function persistQuizHistory(room) {
  if (room.gameId !== "quiz-arena" || !room.game || !room.quizOwnerHash) return;
  const persisted = room.quizPersistedKeys || (room.quizPersistedKeys = new Set());
  const pending = room.game.usedKnowledgeKeys.filter((key) => !persisted.has(key));
  if (!pending.length) return;
  pending.forEach((key) => persisted.add(key));
  if (!database.enabled) return;
  try {
    await database.query(`
      INSERT INTO quiz_question_history (owner_hash, knowledge_key)
      SELECT $1, value FROM UNNEST($2::text[]) AS value
      ON CONFLICT (owner_hash, knowledge_key)
      DO UPDATE SET last_seen_at = NOW(), seen_count = quiz_question_history.seen_count + 1
    `, [room.quizOwnerHash, pending]);
  } catch (error) {
    pending.forEach((key) => persisted.delete(key));
    console.warn(`站神历史记录写入失败：${error.message}`);
  }
}

async function fetchImageBytes(imageUrl) {
  const parsed = new URL(imageUrl);
  const trustedHosts = new Set(["upload.wikimedia.org", "commons.wikimedia.org"]);
  if (!trustedHosts.has(parsed.hostname)) throw new Error("角色图片来源不受信任");
  const response = await fetch(parsed, {
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*", "User-Agent": "FriendsBoardGameQuiz/2.0" },
    signal: AbortSignal.timeout(10_000)
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) throw new Error(`图片下载失败 (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("角色图片大小异常");
  return { bytes, contentType: contentType.split(";")[0] };
}

async function wikidataPortraitImage(term) {
  if (term.filename) return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(term.filename)}?width=720`;
  if (!/^Q\d+$/.test(term.wikidataId || "")) throw new Error("人物实体编号无效");
  const entityUrl = new URL("https://www.wikidata.org/w/api.php");
  Object.entries({ action: "wbgetentities", format: "json", ids: term.wikidataId, props: "claims" })
    .forEach(([key, value]) => entityUrl.searchParams.set(key, value));
  const entityResponse = await fetch(entityUrl, { headers: { "User-Agent": "FriendsBoardGameQuiz/3.0" }, signal: AbortSignal.timeout(10_000) });
  const entity = (await entityResponse.json())?.entities?.[term.wikidataId];
  const filename = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!entityResponse.ok || !filename) throw new Error("该人物没有已核实主图");

  const commonsUrl = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({ action: "query", format: "json", formatversion: "2", titles: `File:${filename}`, prop: "imageinfo", iiprop: "url", iiurlwidth: "720" })
    .forEach(([key, value]) => commonsUrl.searchParams.set(key, value));
  const commonsResponse = await fetch(commonsUrl, { headers: { "User-Agent": "FriendsBoardGameQuiz/3.0" }, signal: AbortSignal.timeout(10_000) });
  const page = (await commonsResponse.json())?.query?.pages?.[0];
  const imageUrl = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
  if (!commonsResponse.ok || !imageUrl) throw new Error("该人物主图无法下载");
  return imageUrl;
}

async function resolveCharacterImage(imageKey) {
  const cached = characterImageCache.get(imageKey);
  if (cached) return await cached;
  const term = CHARACTER_IMAGE_TERMS[imageKey];
  if (!term) throw new Error("未知人物图鉴编号");
  const request = (async () => {
    const imageUrl = await wikidataPortraitImage(term);
    return fetchImageBytes(imageUrl);
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
    await recordAudit({ actorType: "request", actorId: token ? "invalid-token" : "anonymous", action: "admin_access_denied", ip: req.ip, metadata: { method: req.method, path: req.path } });
    return res.status(403).json({ error: "需要管理员权限" });
  }
  await recordAudit({ actorType: "admin", actorId: grant.actorId || "admin-token", action: "admin_access", ip: req.ip, metadata: { method: req.method, path: req.path } });
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
  await recordAudit({ actorType: "admin", actorId: req.adminActorId, action: "room_closed", roomCode: code, ip: req.ip, metadata: { reason: "administrator_action" } });
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
    const image = await resolveCharacterImage(req.params.imageKey);
    res.set("Cache-Control", "public, max-age=604800, immutable").type(image.contentType).send(image.bytes);
  } catch (error) {
    console.warn(`角色图片加载失败 [${req.params.imageKey}]：${error.message}`);
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
  void persistQuizHistory(room);
  void retireQuizQuestion(room);
  void retireDrawWord(room);
}

function broadcastDrawStroke(room, payload) {
  for (const client of io.sockets.sockets.values()) {
    if (client.data.roomCode === room.code) client.emit("draw:stroke", payload);
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
    if (status.role === "admin") await recordAudit({ actorType: "admin", actorId: status.actorId || "admin-token", action: "admin_login", ip: socket.handshake.address });
    ack(status);
  });

  socket.on("access:redeem", async ({ code } = {}, ack = () => {}) => {
    try {
      const grant = await accessService.issue(code);
      await recordAudit({ actorType: grant.role === "admin" ? "admin" : "tester", actorId: grant.actorId || (grant.role === "admin" ? "admin-token" : "tester-token"), action: grant.role === "admin" ? "admin_redeem" : "tester_redeem", ip: socket.handshake.address });
      ack({ ok: true, ...grant });
    } catch (error) {
      await recordAudit({ actorType: "request", actorId: "invalid-activation", action: "activation_failed", ip: socket.handshake.address, metadata: { codeLength: String(code || "").length } });
      ack({ ok: false, error: error.message });
    }
  });

  socket.on("room:create", async ({ name, playerToken, roomPassword, gameId = DEFAULT_GAME_ID } = {}, ack = () => {}) => {
    try {
      const { room, player } = roomService.createRoom({ name, playerToken, roomPassword, gameId });
      await loadQuizHistory(room, player);
      await loadDrawHistory(room);
      await recordAudit({ actorType: "player", actorId: player.id, action: "room_created", roomCode: room.code, ip: socket.handshake.address, metadata: { gameId } });
      socket.join(room.code);
      trackPlayerSocket(socket, room, player);
      ack({ ok: true, code: room.code, playerId: player.id, playerToken: player.token });
      sendRoom(room);
    } catch (error) { replyError(socket, error); ack({ ok: false, error: error.message }); }
  });

  socket.on("room:join", async ({ code: rawCode, name, playerToken, roomPassword } = {}, ack = () => {}) => {
    try {
      const joiningRoom = rooms.get(String(rawCode || "").toUpperCase());
      const { room, player } = roomService.joinRoom({ rawCode, name, playerToken, roomPassword });
      await recordAudit({ actorType: "guest", actorId: player.id, action: "room_joined", roomCode: room.code, ip: socket.handshake.address, metadata: { hadActiveGame: Boolean(joiningRoom?.game) } });
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
  socket.on("game:action", (data = {}) => {
    if (data.action === "draw") {
      try {
        const room = rooms.get(socket.data.roomCode);
        if (!room) throw new Error("房间已经关闭");
        syncRoomConnections(room);
        roomService.applyGameAction(room, socket.data.playerId, data.action, data.payload);
        const points = Array.isArray(data.payload?.points) ? data.payload.points.slice(0, 32).map((point) => ({
          x: Math.max(0, Math.min(1, Number(point.x) || 0)),
          y: Math.max(0, Math.min(1, Number(point.y) || 0))
        })) : [];
        broadcastDrawStroke(room, {
          playerId: socket.data.playerId,
          strokeId: String(data.payload?.strokeId || "").slice(0, 50),
          color: String(data.payload?.color || "").slice(0, 20),
          width: Math.max(2, Math.min(24, Number(data.payload?.width) || 5)),
          tool: ["eraser", "crayon"].includes(data.payload?.tool) ? data.payload.tool : "brush",
          points
        });
      } catch (error) { replyError(socket, error); }
      return;
    }
    action((room, id, message) => roomService.applyGameAction(room, id, message.action, message.payload))(data);
  });
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
