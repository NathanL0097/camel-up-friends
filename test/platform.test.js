const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_GAME_ID, getGame, listGames } = require("../src/games");
const { createRoomService } = require("../src/platform/room-service");
const { createSocketPresence } = require("../src/platform/socket-presence");
const { createAccessService } = require("../src/platform/access-service");

function service() {
  const rooms = new Map();
  let id = 0;
  return {
    rooms,
    roomService: createRoomService({
      rooms,
      getGame,
      makeCode: () => "ABC234",
      makeId: () => `player-${++id}`
    })
  };
}

test("平台游戏注册表公开元数据但不公开服务端处理器", () => {
  const catalog = listGames();
  assert.equal(DEFAULT_GAME_ID, "camel-race");
  assert.equal(catalog[0].title, "沙漠驼队竞速");
  assert.equal(catalog[0].clientScript, "/games/camel-race.js");
  assert.equal(catalog[0].actions, undefined);
  assert.equal(catalog[1].title, "开盘！");
  assert.equal(catalog[1].clientScript, "/games/market-opening.js");
  assert.equal(catalog[2].title, "你画我猜");
  assert.equal(catalog[2].clientScript, "/games/draw-and-guess.js");
  assert.equal(catalog[3].title, "扑克之夜");
  assert.equal(catalog[3].maxPlayers, 9);
  assert.equal(catalog[4].title, "文明奇迹：双城对决");
  assert.equal(catalog[4].maxPlayers, 2);
  assert.equal(catalog[5].title, "云端机组：协同降落");
  assert.equal(catalog[5].maxPlayers, 2);
  assert.equal(catalog[6].title, "诡镇调查：午夜档案");
  assert.equal(catalog[6].maxPlayers, 4);
  assert.equal(catalog[7].title, "骗子酒馆");
  assert.equal(catalog[7].maxPlayers, 6);
  assert.equal(catalog[8].title, "站神答题王");
  assert.equal(catalog[8].maxPlayers, 6);
  assert.throws(() => getGame("unknown-game"), /暂未开放/);
});

test("你画我猜复用好友房并要求至少两人开局", () => {
  const { roomService } = service();
  const { room, player: host } = roomService.createRoom({ name: "画家", playerToken: "host-token", gameId: "draw-and-guess" });
  assert.throws(() => roomService.startGame(room, host.id), /至少需要 2 人/);
  const { player: friend } = roomService.joinRoom({ rawCode: room.code, name: "猜题者", playerToken: "friend-token" });
  roomService.startGame(room, host.id);
  assert.equal(room.game.totalTurns, 6);
  const artistView = roomService.publicRoom(room, room.game.artistId);
  const friendView = roomService.publicRoom(room, friend.id === room.game.artistId ? host.id : friend.id);
  assert.equal(artistView.game.wordChoices.length, 3);
  assert.equal(friendView.game.wordChoices.length, 0);
});

test("平台房间保存游戏类型并生成对应的公开状态", () => {
  const { roomService } = service();
  const { room, player } = roomService.createRoom({ name: "房主", playerToken: "host-token", gameId: "camel-race" });
  const publicState = roomService.publicRoom(room, player.id);
  assert.equal(room.gameId, "camel-race");
  assert.equal(publicState.gameInfo.title, "沙漠驼队竞速");
  assert.equal(publicState.players[0].token, undefined);
});

test("平台用统一动作入口分发到独立游戏模块", () => {
  const { roomService } = service();
  const { room, player } = roomService.createRoom({ name: "房主", playerToken: "host-token", gameId: "camel-race" });
  roomService.startGame(room, player.id);
  roomService.applyGameAction(room, player.id, "bet", { color: "red" });
  assert.equal(room.game.legBets[0].playerId, player.id);
  assert.equal(room.game.legBets[0].value, 5);
  assert.throws(() => roomService.applyGameAction(room, player.id, "missing"), /不支持/);
});

test("刷新重连时旧连接断开不会把新连接误判为离线", () => {
  const presence = createSocketPresence();
  const player = { id: "p1", connected: false };
  const room = { code: "ABC234", players: [player] };
  presence.track("old-socket", room, player);
  presence.track("new-socket", room, player);
  assert.equal(presence.untrack("old-socket", room.code, player.id), 1);
  presence.sync(room);
  assert.equal(player.connected, true);
  assert.equal(presence.untrack("new-socket", room.code, player.id), 0);
  presence.sync(room);
  assert.equal(player.connected, false);
});

test("首页游戏选择器使用可收起的双列抽屉且取消卡片倾斜", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
  const client = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../public/styles.css"), "utf8");
  assert.ok(html.includes('id="gamePickerToggle"'));
  assert.ok(html.includes('id="gameDrawer"'));
  assert.ok(client.includes("setGameDrawer(false)"));
  assert.ok(css.includes(".game-drawer .game-catalog{display:grid;grid-template-columns:repeat(2"));
  assert.ok(css.includes(".entry-card{position:relative;transform:none!important}"));
});

test("四款重点游戏加载移动端专属响应式布局", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
  const mobile = fs.readFileSync(path.join(__dirname, "../public/games/mobile-responsive.css"), "utf8");
  assert.ok(html.includes('/games/mobile-responsive.css'));
  for (const selector of [".poker-game", "#track > .actions", ".quiz-question-card", "#liarHandDock"]) assert.ok(mobile.includes(selector));
  assert.ok(mobile.includes("@media (max-width: 720px)"));
    assert.ok(mobile.includes("position: fixed"));
});

test("平台提供可安装网页 App 所需的 PWA 资源", () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const html = read("public/index.html");
  const manifest = read("public/manifest.webmanifest");
  const worker = read("public/sw.js");
  const pwa = read("public/pwa.js");
  assert.ok(html.includes('rel="manifest"'));
  assert.ok(html.includes("/pwa.js"));
  assert.ok(manifest.includes('"display": "standalone"'));
  assert.ok(manifest.includes("/icons/icon.svg"));
  assert.ok(worker.includes("self.addEventListener(\"install\""));
  assert.ok(worker.includes("/games/mobile-responsive.css"));
  assert.ok(pwa.includes("beforeinstallprompt"));
});

test("内部激活码只能兑换一次并提供三十小时服务器授权", () => {
  const access = createAccessService({ durationMs: 30 * 60 * 60_000 });
  const grant = access.issue("0579-47D1-4AF0-D07D");
  assert.equal(access.valid(grant.token), true);
  assert.equal(grant.expiresAt - Date.now() > 29 * 60 * 60_000, true);
  assert.throws(() => access.issue("0579-47D1-4AF0-D07D"), /无效或已经使用/);
  assert.throws(() => access.issue("0000-0000-0000-0000"), /无效或已经使用/);
});

test("专属管理员激活码获得后台权限且普通激活码不能越权", () => {
  const access = createAccessService();
  const admin = access.issue("70A1-DDEB-9AE1-C41F");
  const secondAdmin = access.issue("736B-4EA8-2F10-625A");
  const tester = access.issue("C73A-15CD-DB37-C700");
  assert.equal(admin.role, "admin");
  assert.equal(admin.expiresAt, null);
  assert.equal(secondAdmin.role, "admin");
  assert.equal(access.adminValid(admin.token), true);
  assert.equal(access.adminValid(tester.token), false);
});
