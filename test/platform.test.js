const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_GAME_ID, getGame, listGames } = require("../src/games");
const { createRoomService } = require("../src/platform/room-service");

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
