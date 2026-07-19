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
  assert.throws(() => getGame("unknown-game"), /暂未开放/);
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
