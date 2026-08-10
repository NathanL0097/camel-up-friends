window.GameClientFactories ||= {};
window.GameClientFactories["casino-night"] = ({ socket, $, show, escapeHtml, getMyId, copyInvite }) => {
  const act = (action, payload = {}) => socket.emit("game:action", { action, payload });
  let chip = 10, straight = 17, soundOn = true, audio = null, lastEvent = -1;
  const tableNames = { roulette: "单零轮盘", blackjack: "Blackjack", holdem: "Casino Hold’em" };
  const labels = { red: "红", black: "黑", odd: "单", even: "双", low: "1–18", high: "19–36", dozen1: "1st 12", dozen2: "2nd 12", dozen3: "3rd 12", column1: "第1列", column2: "第2列", column3: "第3列" };
  function tone(freq = 360, duration = .08, delay = 0) {
    if (!soundOn) return; audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume();
    const oscillator = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime + delay;
    oscillator.type = "triangle"; oscillator.frequency.value = freq; gain.gain.setValueAtTime(.001, start); gain.gain.exponentialRampToValueAtTime(.05, start + .015); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain).connect(audio.destination); oscillator.start(start); oscillator.stop(start + duration + .02);
  }
  function card(value, index = 0) {
    if (!value || value === "back") return `<i class="casino-card back" style="--card-i:${index}"><b>✦</b></i>`;
    const rank = value[0] === "T" ? "10" : value[0], suit = { c: "♣", d: "♦", h: "♥", s: "♠" }[value[1]], color = value[1] === "h" || value[1] === "d" ? "red" : "black";
    return `<i class="casino-card ${color}" style="--card-i:${index}"><b>${rank}</b><span>${suit}</span><em>${suit}</em></i>`;
  }
  function rules() {
    $("rulesContent").innerHTML = `<div class="casino-rules"><small>PLAY CHIPS ONLY · 无现金价值</small><h2>🎰 星光赌场之夜</h2><h3>单零欧式轮盘</h3><p>轮盘包含 0–36。单号35:1、十二数与列2:1、红黑/单双/大小1:1；0不属于红黑、单双或大小。理论返还率97.30%。</p><h3>Blackjack</h3><p>使用6副牌；庄家16点或以下要牌，所有17点停牌；天然Blackjack赔3:2，普通胜局1:1，同点和局。初始两张同点数牌可分至最多4手；初始两张牌可加倍并只再拿一张。分A后每手只补一张。</p><h3>Casino Hold’em</h3><p>先下Ante，发玩家2张、庄家2张及3张公共牌。看翻牌后可弃牌，或用2倍Ante跟注；随后发转牌与河牌。庄家至少需要一对4才能成牌。Ante按牌型赔率支付，AA附加注从一对A或更高牌型起赔。</p><h3>公平随机</h3><p>每局开始先显示SHA-256承诺值，牌局结束后公开服务器随机种子。洗牌与轮盘结果均在服务器生成，房主和玩家都不能选择结果。</p><div class="casino-warning">本游戏只使用房主派发、不能购买和不能提现的娱乐筹码，不提供真实金钱赌博。</div></div>`;
  }
  function renderLobby(room) {
    rules(); const mine = room.hostId === getMyId(), settings = room.settings || { defaultChips: 1000, allocations: {} };
    $("gameLobbySettings").innerHTML = `<div class="casino-lobby"><div><span>🎰</span><b>娱乐筹码设置</b><small>房主派发 · 无购买 · 无提现 · AI 荷官</small></div><label>默认筹码<input id="casinoDefault" type="number" min="100" max="100000" value="${settings.defaultChips || 1000}" ${mine ? "" : "disabled"}></label><section>${room.players.map(p => `<label>${escapeHtml(p.name)}<input data-casino-player="${p.id}" type="number" min="100" max="100000" value="${settings.allocations?.[p.id] || settings.defaultChips || 1000}" ${mine ? "" : "disabled"}></label>`).join("")}</section>${mine ? '<button id="saveCasinoChips">保存筹码分配</button>' : '<em>等待房主确认每位玩家的娱乐筹码</em>'}<p>进入后房主仍可补发筹码，但无法改变任何牌或轮盘结果。</p></div>`;
    if (mine) $("saveCasinoChips").onclick = () => socket.emit("game:configure", { defaultChips: Number($("casinoDefault").value), allocations: Object.fromEntries([...document.querySelectorAll("[data-casino-player]")].map(input => [input.dataset.casinoPlayer, Number(input.value)])) });
  }
  function mount() {
    if ($("casinoNight")) return;
    $("gameMount").innerHTML = `<div id="casinoNight"><div class="casino-aurora"></div><header class="casino-head"><div><small>PRIVATE PLAY-CHIP SALON · <span id="casinoCode"></span></small><h2>星光赌场之夜</h2></div><nav id="casinoTableNav"></nav><div><button id="casinoSound">🔊</button><button id="casinoRules">规则</button><button id="casinoInvite">邀请</button></div></header><main class="casino-stage"><aside id="casinoPlayers"></aside><section id="casinoTable"><div id="casinoDealer"></div><div id="casinoSurface"></div><div id="casinoControls"></div></section><aside id="casinoLedger"></aside></main><div id="casinoResult"></div></div>`;
    $("casinoRules").onclick = () => $("rulesDialog").showModal(); $("casinoInvite").onclick = copyInvite; $("casinoSound").onclick = () => { soundOn = !soundOn; $("casinoSound").textContent = soundOn ? "🔊" : "🔇"; tone(); }; rules();
  }
  function chipsInput(max) { return `<div class="casino-chip-picker"><span>下注</span><div>${[1,5,10,25,50,100].map(v => `<button data-chip="${v}" class="${chip === v ? "selected" : ""}" ${v > max ? "disabled" : ""}>${v}</button>`).join("")}</div><label>自定<input id="casinoStake" type="number" min="1" max="${Math.max(1, max)}" value="${Math.min(chip, Math.max(1, max))}"></label></div>`; }
  function bindChipPicker() { document.querySelectorAll("[data-chip]").forEach(button => button.onclick = () => { chip = Number(button.dataset.chip); document.querySelectorAll("[data-chip]").forEach(item => item.classList.toggle("selected", item === button)); if ($("casinoStake")) $("casinoStake").value = chip; tone(480); }); }
  function stake() { return Math.max(1, Number($("casinoStake")?.value || chip)); }
  function renderPlayers(room) {
    const g = room.game;
    $("casinoPlayers").innerHTML = `<header><b>玩家筹码</b><small>仅供娱乐</small></header>${g.players.map(p => `<article class="${p.playerId === getMyId() ? "mine" : ""}"><span>${p.playerId === room.hostId ? "♛" : "◆"}</span><div><b>${escapeHtml(p.playerName)}${p.playerId === getMyId() ? "（你）" : ""}</b><strong>${Number(p.chips).toLocaleString()} <small>CHIPS</small></strong></div>${g.phase === "result" && p.lastNet ? `<em class="${p.lastNet > 0 ? "win" : "loss"}">${p.lastNet > 0 ? "+" : ""}${p.lastNet}</em>` : ""}</article>`).join("")}`;
  }
  function renderNav(room) {
    $("casinoTableNav").innerHTML = Object.entries(tableNames).map(([id, name]) => `<button data-table="${id}" class="${room.game.table === id ? "selected" : ""}" ${room.hostId === getMyId() && room.game.phase === "betting" ? "" : "disabled"}>${id === "roulette" ? "◉" : id === "blackjack" ? "21" : "♠"} ${name}</button>`).join("");
    document.querySelectorAll("[data-table]").forEach(button => button.onclick = () => act("select-table", { table: button.dataset.table }));
  }
  function dealer(room) {
    const g = room.game, title = g.table === "roulette" ? "轮盘荷官" : g.table === "blackjack" ? "Blackjack 荷官" : "Casino Hold’em 荷官";
    $("casinoDealer").innerHTML = `<div class="ai-dealer"><div class="dealer-halo"></div><span>AI</span><section><small>ST★RLIGHT DEALER</small><b>${title}</b><em>${g.phase === "betting" ? "正在接受下注" : g.phase === "result" ? "本局结算完成" : "牌局进行中"}</em></section></div><div class="fairness"><small>FAIRNESS COMMIT</small><code>${g.fairness?.commit ? g.fairness.commit.slice(0, 18) + "…" : "等待下一局"}</code>${g.fairness?.seed ? `<span title="${g.fairness.seed}">种子已公开 ✓</span>` : ""}</div>`;
  }
  function roulette(room, me) {
    const g = room.game, bets = me.rouletteBets || [], total = bets.reduce((s, b) => s + b.amount, 0);
    $("casinoSurface").innerHTML = `<div class="roulette-layout"><div class="roulette-wheel ${g.phase === "result" ? "landed" : ""}"><div class="wheel-ring">${Array.from({ length: 37 }, (_, i) => `<i style="--n:${i}">${i}</i>`).join("")}</div><div class="wheel-ball"></div><strong>${g.wheel?.result ?? "◉"}</strong></div><div class="roulette-board"><button class="zero ${straight === 0 ? "picked" : ""}" data-number="0">0</button><div class="number-grid">${Array.from({ length: 36 }, (_, i) => i + 1).map(n => `<button data-number="${n}" class="${[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(n) ? "red" : "black"} ${straight === n ? "picked" : ""}">${n}</button>`).join("")}</div><div class="outside-grid">${Object.entries(labels).map(([type, label]) => `<button data-outside="${type}">${label}</button>`).join("")}</div></div></div>`;
    $("casinoControls").innerHTML = g.phase === "betting" ? `${chipsInput(me.chips)}<div class="roulette-actions"><button id="betStraight">下注号码 ${straight}</button><button id="clearRoulette" ${bets.length ? "" : "disabled"}>撤回我的下注</button><button id="spinRoulette" class="gold">AI 荷官转动轮盘</button></div><div class="my-bets"><b>我的下注 ${total}</b>${bets.map(b => `<span>${b.type === "straight" ? `号码 ${b.value}` : labels[b.type]} · ${b.amount} · ${b.odds}:1</span>`).join("") || "<small>点击号码或外盘位置下注</small>"}</div>` : `<button id="nextCasinoRound" class="gold">开始下一局</button>`;
    document.querySelectorAll("[data-number]").forEach(button => button.onclick = () => { straight = Number(button.dataset.number); render(room); });
    document.querySelectorAll("[data-outside]").forEach(button => button.onclick = () => act("roulette-bet", { type: button.dataset.outside, amount: stake() }));
    if (g.phase === "betting") { bindChipPicker(); $("betStraight").onclick = () => act("roulette-bet", { type: "straight", value: straight, amount: stake() }); $("clearRoulette").onclick = () => act("roulette-clear"); $("spinRoulette").onclick = () => act("roulette-spin"); }
    else $("nextCasinoRound").onclick = () => act("reset-round");
  }
  function blackjack(room, me) {
    const g = room.game, bj = me.blackjack;
    $("casinoSurface").innerHTML = `<div class="blackjack-felt"><div class="dealer-hand"><small>AI 庄家</small><div>${g.dealer.cards.map(card).join("") || '<i class="empty-card">等待发牌</i>'}</div></div><div class="table-inscription">BLACKJACK PAYS 3 TO 2 <span>DEALER STANDS ON ALL 17</span></div><div class="player-hands">${bj?.hands?.length ? bj.hands.map((hand, hi) => `<section class="${hi === bj.active && !hand.done ? "active" : ""}"><div>${hand.cards.map(card).join("")}</div><b>${hand.cards[0] === "back" ? "对手手牌" : `第${hi + 1}手 · ${hand.bet}筹码`}</b><em>${hand.result || ""}</em></section>`).join("") : '<p>下注后由 AI 荷官发牌</p>'}</div></div>`;
    if (g.phase === "betting") $("casinoControls").innerHTML = `${chipsInput(me.chips)}<div class="casino-main-actions"><button id="bjBet">锁定 ${me.blackjack?.bet || chip} 筹码</button><button id="bjDeal" class="gold">AI 荷官发牌</button></div>`;
    else if (g.phase === "playing") { const hand = bj?.hands?.[bj.active]; $("casinoControls").innerHTML = hand && !hand.done ? `<div class="casino-main-actions blackjack-actions"><button data-bj="hit">要牌</button><button data-bj="stand">停牌</button><button data-bj="double" ${hand.cards.length === 2 && me.chips >= hand.bet ? "" : "disabled"}>加倍</button><button data-bj="split" ${hand.cards.length === 2 && hand.cards[0][0] === hand.cards[1][0] && me.chips >= hand.bet ? "" : "disabled"}>分牌</button></div>` : '<div class="dealer-wait">等待其他玩家完成行动…</div>'; }
    else $("casinoControls").innerHTML = `<button id="nextCasinoRound" class="gold">收起结算 · 下一局</button>`;
    if (g.phase === "betting") { bindChipPicker(); $("bjBet").onclick = () => act("blackjack-bet", { amount: stake() }); $("bjDeal").onclick = () => act("blackjack-deal"); }
    document.querySelectorAll("[data-bj]").forEach(button => button.onclick = () => act("blackjack-action", { action: button.dataset.bj })); $("nextCasinoRound")?.addEventListener("click", () => act("reset-round"));
  }
  function holdem(room, me) {
    const g = room.game, hand = me.holdem;
    $("casinoSurface").innerHTML = `<div class="holdem-felt"><div class="holdem-dealer"><small>AI 庄家</small>${g.dealer.cards.map(card).join("") || card("back") + card("back")}</div><div class="community-cards">${g.board.map(card).join("")}${Array.from({ length: Math.max(0, 5 - g.board.length) }, () => '<i class="empty-card"></i>').join("")}</div><div class="holdem-player"><small>你的手牌</small>${hand?.cards?.map(card).join("") || card("back") + card("back")}<b>${hand?.handName || ""}</b><em>${hand?.result || ""}</em></div><div class="holdem-bets"><span>ANTE</span><span>CALL 2×</span><span>AA BONUS</span></div></div>`;
    if (g.phase === "betting") $("casinoControls").innerHTML = `${chipsInput(Math.floor(me.chips / 3))}<label class="aa-bet">AA附加注 <input id="aaStake" type="number" min="0" max="${me.chips}" value="0"></label><div class="casino-main-actions"><button id="holdemBet">锁定 Ante</button><button id="holdemDeal" class="gold">AI 荷官发牌</button></div>`;
    else if (g.phase === "decision") $("casinoControls").innerHTML = hand && !hand.decision ? `<div class="casino-main-actions holdem-actions"><button id="holdemFold">弃牌</button><button id="holdemCall" class="gold">跟注 ${hand.ante * 2}</button></div>` : '<div class="dealer-wait">等待其他玩家选择…</div>';
    else $("casinoControls").innerHTML = `<button id="nextCasinoRound" class="gold">收起结算 · 下一局</button>`;
    if (g.phase === "betting") { bindChipPicker(); $("holdemBet").onclick = () => act("holdem-bet", { ante: stake(), aa: Number($("aaStake").value) }); $("holdemDeal").onclick = () => act("holdem-deal"); }
    $("holdemFold")?.addEventListener("click", () => act("holdem-decision", { decision: "fold" })); $("holdemCall")?.addEventListener("click", () => act("holdem-decision", { decision: "call" })); $("nextCasinoRound")?.addEventListener("click", () => act("reset-round"));
  }
  function hostDesk(room) {
    if (room.hostId !== getMyId() || room.game.phase !== "betting") return "";
    return `<div class="host-chip-desk"><b>房主筹码台</b><select id="grantPlayer">${room.game.players.map(p => `<option value="${p.playerId}">${escapeHtml(p.playerName)}</option>`).join("")}</select><input id="grantAmount" type="number" min="1" max="100000" value="500"><button id="grantChips">派发</button></div>`;
  }
  function result(room) {
    const g = room.game;
    $("casinoResult").innerHTML = g.phase === "result" ? `<div class="casino-result"><small>ROUND ${g.round} SETTLED</small><h2>${g.log[0]}</h2><div>${g.players.filter(p => p.lastNet !== 0).map(p => `<span>${escapeHtml(p.playerName)} <b class="${p.lastNet > 0 ? "win" : "loss"}">${p.lastNet > 0 ? "+" : ""}${p.lastNet}</b></span>`).join("") || "本局全部和局"}</div><em>公平种子已公开，可与本局承诺值核对</em></div>` : "";
  }
  function render(room) {
    show("game"); mount(); const g = room.game, me = g.players.find(p => p.playerId === getMyId()); if (!me) return;
    $("casinoCode").textContent = room.code; renderNav(room); renderPlayers(room); dealer(room);
    if (g.table === "roulette") roulette(room, me); else if (g.table === "blackjack") blackjack(room, me); else holdem(room, me);
    $("casinoLedger").innerHTML = `${hostDesk(room)}<header><b>荷官记录</b><small>${tableNames[g.table]} · 第${g.round}局</small></header>${g.log.slice(0, 8).map(line => `<p>${escapeHtml(line)}</p>`).join("")}`;
    $("grantChips")?.addEventListener("click", () => act("grant-chips", { playerId: $("grantPlayer").value, amount: Number($("grantAmount").value) })); result(room);
    if (g.eventSeq !== lastEvent) { lastEvent = g.eventSeq; tone(g.phase === "result" ? 720 : 420, .12); }
  }
  return { prepare: () => null, renderLobby, render };
};
