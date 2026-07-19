const socket = io();
const $ = (id) => document.getElementById(id);
let identity = JSON.parse(localStorage.getItem("tabletopIdentity") || localStorage.getItem("camelIdentity") || "null");
let myId = null;
let state = null;
let selectedGameId = "camel-race";
const gameClients = new Map();
const gameCatalog = new Map([["camel-race", { id: "camel-race", clientScript: "/games/camel-race.js" }]]);

const savedName = localStorage.getItem("tabletopName") || localStorage.getItem("camelName");
if (savedName) $("nameInput").value = savedName;

function show(id) { ["landing", "lobby", "game"].forEach((key) => $(key).classList.toggle("hidden", key !== id)); }
function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(el.timer); el.timer = setTimeout(() => el.classList.remove("show"), 2600); }
function escapeHtml(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML; }
function roomFromUrl() { return location.pathname.match(/^\/room\/([A-Z0-9]+)/i)?.[1]?.toUpperCase(); }
function name() { return $("nameInput").value.trim() || localStorage.getItem("tabletopName") || localStorage.getItem("camelName") || "桌游旅人"; }
function roomUrl(code) { return `${location.origin}/room/${code}`; }
function saveIdentity(result) {
  identity = { code: result.code, playerToken: result.playerToken };
  myId = result.playerId;
  localStorage.setItem("tabletopIdentity", JSON.stringify(identity));
  localStorage.setItem("tabletopName", name());
}

function loadClientScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-game-client="${src}"]`);
    if (existing?.dataset.loaded === "true") return resolve();
    if (existing) { existing.addEventListener("load", resolve, { once: true }); return; }
    const script = document.createElement("script");
    script.src = src;
    script.dataset.gameClient = src;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("游戏客户端模块加载失败"));
    document.head.appendChild(script);
  });
}

async function getGameClient(gameId, clientScript = gameCatalog.get(gameId)?.clientScript) {
  if (!gameClients.has(gameId)) {
    if (!window.GameClientFactories?.[gameId] && clientScript) await loadClientScript(clientScript);
    const factory = window.GameClientFactories?.[gameId];
    if (!factory) throw new Error("这款游戏的客户端模块尚未加载");
    gameClients.set(gameId, factory({ socket, $, show, escapeHtml, getMyId: () => myId, copyInvite }));
  }
  return gameClients.get(gameId);
}

async function loadGameCatalog() {
  try {
    const response = await fetch("/api/games");
    const { games } = await response.json();
    games.forEach((game) => gameCatalog.set(game.id, game));
    $("gameCatalog").innerHTML = games.map((game) => `<button class="game-choice ${game.id === selectedGameId ? "selected" : ""}" data-game-id="${game.id}"><span>${game.id === "camel-race" ? "🐪" : "🎲"}</span><b>${escapeHtml(game.title)}</b><small>${game.minPlayers}–${game.maxPlayers}人 · ${game.status === "prototype" ? "技术演示" : "已开放"}</small></button>`).join("");
    document.querySelectorAll("[data-game-id]").forEach((button) => button.onclick = () => {
      selectedGameId = button.dataset.gameId;
      document.querySelectorAll("[data-game-id]").forEach((choice) => choice.classList.toggle("selected", choice === button));
    });
  } catch {
    // 保留HTML内的默认游戏卡，临时网络故障不会阻止创建房间。
  }
}

function join(code) {
  socket.emit("room:join", { code, name: name(), playerToken: identity?.code === code ? identity.playerToken : null }, (result) => {
    if (result?.ok) {
      saveIdentity(result);
      history.replaceState({}, "", `/room/${result.code}`);
    }
  });
}

function prepareInviteJoin(code) {
  show("landing");
  $("codeInput").value = code;
  $("codeInput").readOnly = true;
  $("createButton").classList.add("hidden");
  document.querySelector(".divider").classList.add("hidden");
  document.querySelector(".entry-card").classList.add("invite-mode");
  $("joinButton").textContent = "确认昵称并加入";
  $("entryHint").textContent = `你将加入好友房 ${code}，请先确认或修改昵称。`;
  $("nameInput").focus();
}

function renderLobby(room) {
  show("lobby");
  $("shareUrl").textContent = roomUrl(room.code);
  $("roomCode").textContent = room.code;
  $("lobbyGameTitle").textContent = room.gameInfo?.title || "好友桌游";
  $("lobbyPlayers").innerHTML = room.players.map((player) => `<div class="lobby-player ${player.connected ? "" : "offline"}">${player.id === room.hostId ? "👑 " : ""}${escapeHtml(player.name)}${player.id === myId ? "（你）" : ""}</div>`).join("");
  $("startButton").classList.toggle("hidden", room.hostId !== myId);
  $("hostHint").textContent = room.hostId === myId ? `已有 ${room.players.length} 人；本房间最多 ${room.gameInfo?.maxPlayers || 8} 人。` : "等待房主开始比赛…";
}

async function copyInvite() {
  if (!state) return;
  try { await navigator.clipboard.writeText(roomUrl(state.code)); toast("邀请链接已复制"); }
  catch { toast("请从地址栏复制链接"); }
}

$("createButton").onclick = () => socket.emit("room:create", { name: name(), playerToken: crypto.randomUUID(), gameId: selectedGameId }, (result) => {
  if (result?.ok) {
    saveIdentity(result);
    history.replaceState({}, "", `/room/${result.code}`);
  } else if (result?.error) toast(result.error);
});
$("joinButton").onclick = () => { const code = $("codeInput").value.trim().toUpperCase(); if (code.length !== 6) return toast("请输入 6 位房间码"); join(code); };
$("codeInput").addEventListener("keydown", (event) => { if (event.key === "Enter") $("joinButton").click(); });
$("startButton").onclick = () => socket.emit("game:start");
$("rulesButton").onclick = async () => { await getGameClient(state?.gameId || selectedGameId, state?.gameInfo?.clientScript); $("rulesDialog").showModal(); };
$("closeRules").onclick = () => $("rulesDialog").close();
$("copyButton").onclick = copyInvite;

socket.on("room:update", async (room) => {
  let gameClient;
  let transition;
  try {
    gameClient = await getGameClient(room.gameId, room.gameInfo?.clientScript);
    transition = gameClient.prepare(state);
  } catch (error) {
    return toast(error.message);
  }
  state = room;
  room.game ? gameClient.render(room, transition) : renderLobby(room);
});
socket.on("game:error", (message) => toast(message));
socket.on("connect", () => {
  const code = roomFromUrl();
  if (!code) return show("landing");
  if (identity?.code === code) {
    $("entryHint").textContent = `正在重新连接房间 ${code}…`;
    join(code);
  } else prepareInviteJoin(code);
});
socket.on("disconnect", () => toast("连接中断，正在尝试重连…"));

loadGameCatalog();
