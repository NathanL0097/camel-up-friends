window.GameClientFactories ||= {};

window.GameClientFactories["las-vegas-royale"] = ({ socket, $, show, escapeHtml, getMyId, copyInvite }) => {
  const emit = (action, payload = {}) => socket.emit("game:action", { action, payload });
  const COLOR_NAMES = { ruby: "红宝石", cyan: "霓虹蓝", gold: "金色", violet: "紫晶", emerald: "翡翠", orange: "琥珀橙" };
  let previous = null;
  let lastPresentedEventId = 0;
  const eventQueue = [];
  let eventPlaying = false;
  let tileDemoTimer = null;
  let audioContext = null;
  function sound(kind) {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    const notes = kind === "cash" ? [523, 659, 784, 1047] : kind === "place" ? [240, 180] : [190, 260, 220, 330];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), start = audioContext.currentTime + index * .055;
      oscillator.type = kind === "roll" ? "square" : "sine"; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(kind === "roll" ? .045 : .08, start + .012); gain.gain.exponentialRampToValueAtTime(.0001, start + .12);
      oscillator.connect(gain).connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + .13);
    });
  }

  function renderLobby(room) {
    previous = room;
    lastPresentedEventId = 0;
    const mine = room.hostId === getMyId();
    const settings = room.settings || { mode: "royale", tileCount: 3 };
    $("rulesContent").innerHTML = rulesMarkup();
    $("gameLobbySettings").innerHTML = `<div class="vegas-lobby-settings"><header><span>🎰</span><div><strong>赌城规则</strong><small>纯真人好友局，不加入电脑或中立玩家</small></div></header><label>玩法<select id="vegasMode" ${mine ? "" : "disabled"}><option value="royale" ${settings.mode === "royale" ? "selected" : ""}>豪华规则 · 随机赌场模块</option><option value="base" ${settings.mode === "base" ? "selected" : ""}>基础规则 · 不使用模块</option></select></label><label>本轮模块数<select id="vegasTileCount" ${mine && settings.mode === "royale" ? "" : "disabled"}>${[1,2,3,4,5,6].map((n) => `<option value="${n}" ${Number(settings.tileCount) === n ? "selected" : ""}>${n} 块${n === 3 ? "（标准）" : "（变体）"}</option>`).join("")}</select></label>${mine ? '<button id="saveVegasSettings">保存设置</button>' : '<p>等待房主确认规则…</p>'}<footer>2–6人 · 3轮 · 纯真人好友局</footer></div>`;
    if (mine) {
      $("vegasMode").onchange = () => { $("vegasTileCount").disabled = $("vegasMode").value === "base"; };
      $("saveVegasSettings").onclick = () => socket.emit("game:configure", { mode: $("vegasMode").value, tileCount: Number($("vegasTileCount").value) });
    }
  }

  function rulesMarkup() {
    return `<div class="eyebrow">LAS VEGAS ROYALE · 2–6人</div><h2>拉斯维加斯骰城 · 规则速查</h2><ol><li>共进行 <b>3轮</b>。轮到你时掷出所有剩余骰子，必须选择一个点数，并把该点数的全部骰子放进对应号码的赌场。</li><li>每人有6颗普通骰和1颗明显更大的 <b>Biggy</b>；Biggy结算多数时算2颗。</li><li><b>好友房增强规则：</b>Biggy进入赌场时，若那里已有对手普通骰，可以选择一颗踢回对方骰池，也可以不发动；Biggy不能被踢回。</li><li>每轮获得2枚筹码。不满意掷骰可花1枚筹码跳过；未花完的筹码可留到后续轮，终局每枚价值$10K。</li><li>每座赌场有两张奖金牌。结算时先将所有票数相同的玩家一起淘汰，再由剩余第一、第二名依次取得高额、低额奖金。</li><li>豪华规则会在赌场1起依次放置随机模块；放骰后立即按中央提示完成效果。</li><li>三轮后现金加剩余筹码价值最高者获胜；平手依次比较奖金牌与筹码的总张数。</li></ol><p class="rules-note">双人测试局同样只使用两位真人玩家，不补电脑或中立骰。Biggy“踢回普通骰”按本好友房的指定增强规则实现。</p>`;
  }

  $("gameMount").innerHTML = `
    <div class="vegas-shell">
      <header class="vegas-head">
        <div><div class="vegas-kicker">LAS VEGAS · 好友房 <span id="vegasCode"></span></div><h2>拉斯维加斯豪华版</h2></div>
        <div id="vegasRound" class="vegas-round"></div>
        <div class="game-head-actions"><button id="vegasRules" class="ghost-button">📖 规则速查</button><button id="vegasInvite" class="ghost-button">邀请好友</button></div>
      </header>
      <div id="vegasFinish" class="vegas-finish hidden"></div>
      <div id="vegasPayout" class="vegas-payout hidden"></div>
      <div id="vegasEventStage" class="vegas-event-stage hidden"><div class="vegas-event-card"><div id="vegasEventKicker" class="event-kicker"></div><h3 id="vegasEventTitle"></h3><div id="vegasEventVisual" class="event-visual"></div><p id="vegasEventDetail"></p><div id="vegasEventControls" class="event-controls"></div></div></div>
      <dialog id="vegasTileDialog" class="vegas-tile-dialog"><button id="closeVegasTile" class="tile-dialog-close" aria-label="关闭豪华板块说明">×</button><div id="vegasTileRule"></div></dialog>
      <section id="vegasPlayers" class="vegas-players"></section>
      <main class="vegas-table">
        <div id="casinoGrid" class="casino-grid"></div>
        <section class="dice-arena">
          <div class="arena-lights"></div>
          <div id="turnPrompt" class="turn-prompt"></div>
          <div id="rolledDice" class="rolled-dice"></div>
          <div id="rollActions" class="roll-actions"></div>
        </section>
      </main>
      <section class="vegas-bottom">
        <div class="vegas-panel"><h3>本轮状态</h3><div id="roundStatus"></div></div>
        <div class="vegas-panel vegas-log"><h3>赌场播报</h3><div id="vegasLog"></div></div>
      </section>
    </div>`;

  $("vegasInvite").onclick = copyInvite;
  $("vegasRules").onclick = () => $("rulesDialog").showModal();
  function stopTileDemo() { clearInterval(tileDemoTimer); tileDemoTimer = null; }
  $("closeVegasTile").onclick = () => { stopTileDemo(); $("vegasTileDialog").close(); };
  $("vegasTileDialog").onclick = (event) => { if (event.target === $("vegasTileDialog")) { stopTileDemo(); $("vegasTileDialog").close(); } };
  $("vegasTileDialog").addEventListener("close", stopTileDemo);

  const PIP_POSITIONS = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9] };
  function dieFaceHtml(face) {
    return `<span class="cube-pips">${PIP_POSITIONS[face].map((position) => `<i class="pip pip-${position}"></i>`).join("")}</span><small>${face}</small>`;
  }
  function dieHtml(item, extra = "", color = "") {
    const face = Number(item.face) || 1;
    return `<span class="die-cube-wrap ${item.big ? "biggy" : ""} ${color} ${extra}" title="${item.big ? "Biggy：结算算两颗，可选择踢回一颗对手普通骰" : `${face}点普通骰`}"><span class="die-cube show-${face}">${[1,6,3,4,2,5].map((side) => `<span class="die-face face-${side}">${dieFaceHtml(side)}</span>`).join("")}</span><em class="die-number">${face}</em>${item.big ? '<b class="biggy-mark">BIG<br>×2</b>' : ""}</span>`;
  }

  function playerName(room, id) {
    if (id === "__neutral") return "中立玩家";
    if (id === "__blank") return "灰骰玩家";
    return room.players.find((p) => p.id === id)?.name || "玩家";
  }

  function renderPlayers(room) {
    const game = room.game;
    $("vegasPlayers").innerHTML = room.players.map((player) => {
      const active = player.id === game.currentTurnId;
      const waiting = game.pending?.actorId === player.id;
      return `<article class="vegas-player ${player.color} ${active ? "active" : ""} ${waiting ? "deciding" : ""}">
        <span class="player-color"></span><div><b>${escapeHtml(player.name)}${player.id === getMyId() ? "（你）" : ""}</b><small>${active ? "正在行动" : waiting ? "正在作出选择" : player.connected ? "已入座" : "暂时离线"}</small></div>
        <div class="player-assets"><span>🎲 ${player.diceLeft}</span><span>🔴 ${player.chips}</span><strong>${player.cash == null ? "资产保密" : `$${player.cash}K`}</strong></div>
      </article>`;
    }).join("");
  }

  function renderCasino(room, casino) {
    const game = room.game;
    const groups = {};
    casino.dice.forEach((item) => (groups[item.playerId] ||= []).push(item));
    const dice = Object.entries(groups).map(([id, items]) => `<div class="casino-dice-group ${room.players.find((p) => p.id === id)?.color || "neutral"}"><small>${escapeHtml(playerName(room, id))}</small><div>${items.map((d) => dieHtml(d)).join("")}</div><b>${items.reduce((sum, d) => sum + (d.big ? 2 : 1), 0)}票</b></div>`).join("");
    const tile = casino.tile;
    const rolledFaces = new Set(game.currentRoll?.map((item) => item.face) || []);
    const selectable = game.currentTurnId === getMyId() && rolledFaces.has(casino.number) && game.closedCasino !== casino.number && !game.pending;
    return `<article class="casino-card casino-${casino.number} ${game.closedCasino === casino.number ? "closed" : ""} ${selectable ? "selectable" : ""}" data-casino="${casino.number}" ${selectable ? 'role="button" tabindex="0"' : ""}><div class="casino-sector-content">
      <div class="casino-sign"><span>${casino.number}</span><div><b>${["日落大道", "埃及艳后", "海市蜃楼", "金色马蹄", "霓虹宫殿", "幸运之星"][casino.number - 1]}</b><small>LAS VEGAS CASINO</small></div></div>
      <div class="money-cards">${casino.money.map((value) => `<span class="casino-banknote"><small>LAS VEGAS</small><b>${value},000</b><i>CASINO DOLLARS</i></span>`).join("")}</div>
      ${tile ? `<button type="button" class="royale-tile" data-tile="${tile.id}" aria-label="查看${escapeHtml(tile.name)}玩法"><span>${tile.icon}</span><div><small>豪华板块 ${tile.id}</small><b>${escapeHtml(tile.name)}</b></div>${tile.state.jackpot ? `<em>$${tile.state.jackpot}K</em>` : ""}<i>查看玩法</i></button>` : ""}
      <div class="casino-dice">${dice || "<span class=\"empty-table\">等待骰子入场</span>"}${casino.blankDice ? `<div class="blank-dice">灰骰 × ${casino.blankDice}</div>` : ""}</div>
      ${game.closedCasino === casino.number ? "<div class=\"closed-stamp\">禁止入场</div>" : ""}
      ${selectable ? `<div class="casino-select-callout">选择 ${casino.number} 点</div>` : ""}</div>
    </article>`;
  }

  function actionButton(label, onclick, className = "") {
    const button = document.createElement("button"); button.className = `vegas-action ${className}`; button.textContent = label; button.onclick = onclick; return button;
  }

  function showTileRules(room, tileId) {
    const casino = room.game.casinos.find((item) => item.tile?.id === tileId);
    if (!casino?.tile) return;
    const tile = casino.tile;
    const guide = tile.guide || { trigger: "骰子进入板块后触发。", action: tile.rule, result: "按中央提示完成效果。", example: "实际可选内容会在触发后显示。" };
    const steps = [
      ["①", "什么时候触发", guide.trigger], ["②", "你需要做什么", guide.action],
      ["③", "最后怎么算", guide.result], ["④", "举个例子", guide.example]
    ];
    stopTileDemo();
    $("vegasTileRule").innerHTML = `<div class="tile-rule-kicker">ROYAL CASINO TILE · ${escapeHtml(tile.id)}</div><div class="tile-rule-title"><span>${tile.icon}</span><div><small>${casino.number}号赌场豪华板块</small><h3>${escapeHtml(tile.name)}</h3></div></div><div class="tile-demo-stage" style="--demo-step:0"><div class="tile-demo-track">${steps.map(([icon, label], index) => `<div class="tile-demo-node ${index === 0 ? "active" : ""}" data-step="${index}"><b>${icon}</b><small>${escapeHtml(label)}</small></div>`).join("")}</div><div class="tile-demo-mover">🎲</div><strong id="tileDemoCaption">${escapeHtml(steps[0][2])}</strong></div><div class="tile-guide-list">${steps.map(([icon, label, text], index) => `<article class="${index === 0 ? "active" : ""}" data-step="${index}"><b>${icon} ${escapeHtml(label)}</b><p>${escapeHtml(text)}</p></article>`).join("")}</div>${tile.state.jackpot ? `<div class="tile-live-state">当前累积奖池 <strong>$${tile.state.jackpot}K</strong></div>` : ""}<button type="button" id="replayTileDemo" class="replay-tile-demo">↻ 重新演示</button><small class="tile-rule-note">这段演示只在你的屏幕播放，不会打断其他玩家，也不会消耗行动。</small>`;
    let step = 0;
    const paintStep = (next) => {
      step = next % steps.length;
      const stage = $("vegasTileRule").querySelector(".tile-demo-stage");
      if (!stage) return;
      stage.style.setProperty("--demo-step", step);
      $("tileDemoCaption").textContent = steps[step][2];
      $("vegasTileRule").querySelectorAll("[data-step]").forEach((item) => item.classList.toggle("active", Number(item.dataset.step) === step));
    };
    const play = () => { stopTileDemo(); paintStep(0); tileDemoTimer = setInterval(() => paintStep(step + 1), 2200); };
    $("replayTileDemo").onclick = play;
    $("vegasTileDialog").showModal();
    play();
  }

  function optionSelect(options, id = "pendingSelect") {
    return `<select id="${id}" class="vegas-select">${options.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join("")}</select>`;
  }

  function ownPlacedDice(room) {
    return room.game.casinos.flatMap((casino) => casino.dice.filter((d) => d.playerId === getMyId()).map((d) => [d.id, `${casino.number}号赌场 · ${d.big ? "Biggy" : "普通骰"}`]));
  }

  function renderPending(room, pending, mine) {
    const area = $("rollActions");
    const actor = playerName(room, pending.actorId);
    if (!mine) { area.innerHTML = `<div class="waiting-choice">等待 <b>${escapeHtml(actor)}</b> 完成「${pendingLabel(pending.type)}」…</div>`; return; }
    const resolve = (payload) => emit("resolve", payload);
    switch (pending.type) {
      case "biggyKick":
        area.innerHTML = `<p><b>Biggy 入场！</b>你可以踢回一颗对手普通骰，也可以保留当前局面。</p>${optionSelect(pending.targets.map((target) => [target.id, `${playerName(room, target.playerId)} 的普通骰`]))}`;
        area.append(actionButton("不发动能力", () => resolve({ skip: true }), "muted"));
        area.append(actionButton("踢回这颗骰子", () => resolve({ dieId: $("pendingSelect").value }), "biggy-power")); break;
      case "luckyChoose":
        area.innerHTML = `<p>秘密握住 1–3 枚标记，让左手边玩家猜。</p>${optionSelect([[1,"握 1 枚 · 奖励2筹码"],[2,"握 2 枚 · 奖励$30K"],[3,"握 3 枚 · 奖励$40K"]])}`;
        area.append(actionButton("握好，请对方猜", () => resolve({ count: +$("pendingSelect").value }))); break;
      case "luckyGuess":
        area.innerHTML = "<p>猜一猜对方秘密握了几枚标记。</p>";
        [1, 2, 3].forEach((n) => area.append(actionButton(`猜 ${n} 枚`, () => resolve({ count: n })))); break;
      case "fifty":
        area.innerHTML = `<p>当前点数 <strong>${pending.last}</strong> · 现在收手可得 <strong>$${pending.reward}K</strong></p>`;
        area.append(actionButton("收手拿钱", () => resolve({ choice: "cashout" }), "safe"));
        area.append(actionButton("下一次更大", () => resolve({ choice: "higher" })));
        area.append(actionButton("下一次更小", () => resolve({ choice: "lower" }))); break;
      case "noEntry":
        area.innerHTML = `<p>选择另一座赌场封锁，直到本板块再次激活。</p>${optionSelect(room.game.casinos.filter((c) => c.number !== pending.casino).map((c) => [c.number, `${c.number}号赌场`]))}`;
        area.append(actionButton("放置禁止入场标记", () => resolve({ casino: +$("pendingSelect").value }))); break;
      case "block":
        area.innerHTML = `<p>选择一组灰骰，再选择要堵住的赌场。</p>${optionSelect([...new Set(pending.clusters)].map((n) => [n, `${n} 颗灰骰`]), "clusterSelect")}${optionSelect(room.game.casinos.filter((c) => c.number !== room.game.closedCasino).map((c) => [c.number, `${c.number}号赌场`]), "casinoSelect")}`;
        area.append(actionButton("放置灰骰", () => resolve({ cluster: +$("clusterSelect").value, casino: +$("casinoSelect").value }))); break;
      case "handicap":
        area.innerHTML = `<p>可取走一颗场上的灰骰换取奖励，也可以放弃。</p>${optionSelect(room.game.casinos.filter((c) => c.blankDice && c.number !== room.game.closedCasino).map((c) => [c.number, `${c.number}号赌场 · ${c.blankDice}颗`]), "sourceSelect")}${optionSelect(pending.slots.map((kind, i) => [i, kind === "chip" ? "1筹码" : kind === "30" ? "$30K" : "操纵一颗己方骰子"]), "slotSelect")}${manipulationControls(room)}`;
        area.append(actionButton("放弃效果", () => resolve({ skip: true }), "muted"));
        area.append(actionButton("领取奖励", () => resolve({ source: +$("sourceSelect").value, slot: +$("slotSelect").value, ...readManipulation() }))); break;
      case "doubleDown":
        area.innerHTML = `<p>可把这里任意数量的己方骰子移到副桌，副桌独立奖励 $60K / $30K。</p>${optionSelect(Array.from({ length: pending.max + 1 }, (_, n) => [n, `移动 ${n} 颗`]))}`;
        area.append(actionButton("确认双倍下注", () => resolve({ count: +$("pendingSelect").value }))); break;
      case "niceDice":
        area.innerHTML = `<p>可把刚放下的一颗骰子放到妙骰奖励格，或跳过。</p>${optionSelect([["", "不放置"], ...pending.dieIds.map((id, i) => [id, `第 ${i + 1} 颗骰子`])])}`;
        area.append(actionButton("确认", () => resolve({ dieId: $("pendingSelect").value }))); break;
      case "myChoice":
        area.innerHTML = `<p>两颗黑骰给出了以下选项，选择其中一个执行。</p>${optionSelect(pending.options.map((n) => [n, ["", "+1筹码", "+2筹码", "+$30K", "激活另一板块", "操纵己方骰子", "占据$60K金格"][n]]))}${optionSelect(room.game.casinos.filter((c) => c.tile && c.number !== pending.casino && c.number !== room.game.closedCasino).map((c) => [c.number, `${c.number}号 · ${c.tile.name}`]), "casinoSelect")}${manipulationControls(room)}`;
        area.append(actionButton("执行所选效果", () => resolve({ option: +$("pendingSelect").value, casino: +$("casinoSelect")?.value || 1, ...readManipulation() }))); break;
      case "primeTime":
        area.innerHTML = `<p>黄金时刻：你掷出 ${pending.roll.join("、")}。选择要额外放入对应赌场的黑骰。</p><div class="prime-options">${pending.roll.map((face, i) => `<label><input type="checkbox" value="${i}" checked> ${face}点</label>`).join("")}</div>`;
        area.append(actionButton("放置所选黑骰", () => resolve({ indices: [...area.querySelectorAll("input:checked")].map((x) => +x.value) }))); break;
      case "blackDivide":
        area.innerHTML = `<p>你坐在赢家左边。把 2筹码、$40K、$60K、$80K、$100K 分成两组。</p><div class="black-tokens">${["1筹码","1筹码","$40K","$60K","$80K","$100K"].map((x, i) => `<label><input type="checkbox" value="${i}" ${i < 3 ? "checked" : ""}>${x}</label>`).join("")}</div>`;
        area.append(actionButton("完成分组", () => resolve({ indices: [...area.querySelectorAll("input:checked")].map((x) => +x.value) }))); break;
      case "blackChoose":
        area.innerHTML = `<p>黑箱奖励已被分成两组。选择一组，翻开后立即领取。</p>`;
        area.append(actionButton(`选择 A 组（${pending.piles[0].length}枚）`, () => resolve({ pile: 0 })));
        area.append(actionButton(`选择 B 组（${pending.piles[1].length}枚）`, () => resolve({ pile: 1 }))); break;
      default: area.innerHTML = `<div class="waiting-choice">正在处理 ${escapeHtml(pendingLabel(pending.type))}…</div>`;
    }
  }

  function pendingLabel(type) {
    return ({ biggyKick: "Biggy 踢骰", luckyChoose: "幸运一拳", luckyGuess: "猜拳", fifty: "猜高猜低", noEntry: "禁止入场", block: "堵住它", handicap: "让分局", doubleDown: "双倍下注", niceDice: "妙骰", myChoice: "任我选", primeTime: "黄金时刻", blackDivide: "黑箱分组", blackChoose: "黑箱选奖" })[type] || "板块效果";
  }

  function manipulationControls(room) {
    const me = room.players.find((player) => player.id === getMyId());
    const placed = ownPlacedDice(room);
    const modes = me?.diceLeft ? [["force","翻转一颗剩余骰并放置"],["return","收回一颗已放骰"]] : [["return","收回一颗已放骰"],["force","已经没有剩余骰"]];
    return `<span class="manipulation-controls">${optionSelect(modes, "manipulationMode")}${optionSelect([[1,"1点"],[2,"2点"],[3,"3点"],[4,"4点"],[5,"5点"],[6,"6点"]], "manipulationFace")}${optionSelect(placed.length ? placed : [["","暂无已放骰"]], "manipulationDie")}</span>`;
  }

  function readManipulation() {
    return { mode: $("manipulationMode")?.value || "force", face: +$("manipulationFace")?.value || 1, dieId: $("manipulationDie")?.value || "" };
  }

  function renderArena(room) {
    const game = room.game; const mine = game.currentTurnId === getMyId(); const pendingMine = game.pending?.actorId === getMyId();
    $("turnPrompt").innerHTML = game.pending ? `<span>豪华板块</span><strong>${pendingLabel(game.pending.type)}</strong>` : mine ? `<span>轮到你</span><strong>${game.currentRoll ? "选择一个点数，全部放入对应赌场" : "掷出你剩余的全部骰子"}</strong>` : `<span>等待行动</span><strong>${escapeHtml(playerName(room, game.currentTurnId))} 的回合</strong>`;
    const activeColor = room.players.find((player) => player.id === game.currentTurnId)?.color || "";
    $("rolledDice").innerHTML = game.currentRoll?.length ? game.currentRoll.map((item) => dieHtml(item, "rolling", activeColor)).join("") : "<span class=\"arena-placeholder\">🎲</span>";
    const area = $("rollActions"); area.innerHTML = ""; area.classList.remove("face-choice");
    if (game.pending) return renderPending(room, game.pending, pendingMine);
    if (!mine) { area.innerHTML = "<div class=\"waiting-choice\">赌场正在等待下一次掷骰…</div>"; return; }
    const me = room.players.find((p) => p.id === getMyId());
    if (!game.currentRoll) {
      area.append(actionButton(`掷全部 ${me.diceLeft} 颗骰子`, () => { sound("roll"); emit("roll"); }, "roll-main"));
      if (game.powerToken === getMyId()) {
        area.insertAdjacentHTML("beforeend", optionSelect([[1,"1点"],[2,"2点"],[3,"3点"],[4,"4点"],[5,"5点"],[6,"6点"]], "powerFace"));
        area.append(actionButton("使用强势控场", () => emit("power", { face: +$("powerFace").value }), "power"));
      }
      return;
    }
    area.classList.add("face-choice");
    [...new Set(game.currentRoll.map((d) => d.face))].sort().forEach((face) => {
      const count = game.currentRoll.filter((d) => d.face === face).length;
      const closed = game.closedCasino === face;
      const button = actionButton(`${face} 点 × ${count}${closed ? "（封锁）" : ""}`, () => { sound("place"); emit("place", { face }); }); button.disabled = closed; area.append(button);
    });
    const hasLegalFace = game.currentRoll.some((d) => d.face !== game.closedCasino);
    const passButton = actionButton(hasLegalFace ? "花 1 筹码跳过" : "无合法赌场 · 免费跳过", () => emit("pass"), "muted"); passButton.disabled = hasLegalFace && me.chips < 1; area.append(passButton);
  }

  function renderFinish(room) {
    const game = room.game; const box = $("vegasFinish");
    if (game.status !== "finished") { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    box.innerHTML = `<h3>🎉 赌城之夜结束</h3><div>${game.finalRanking.map((item, index) => { const player = room.players.find((p) => p.id === item.id); return `<p><b>${index + 1}</b><span>${escapeHtml(player.name)}</span><strong>$${player.total}K</strong></p>`; }).join("")}</div>${room.hostId === getMyId() ? "<button id=\"vegasRestart\" class=\"primary-button\">再来一局</button>" : "<small>等待房主开启下一局…</small>"}`;
    $("vegasRestart")?.addEventListener("click", () => socket.emit("game:restart"));
  }

  function renderPayout(room) {
    const report = room.game.lastSettlement, box = $("vegasPayout");
    const isNew = report && report.id !== previous?.game?.lastSettlement?.id;
    if (!isNew || room.game.status === "finished") return;
    sound("cash"); box.classList.remove("hidden");
    box.innerHTML = `<button id="closeVegasPayout">×</button><div class="payout-kicker">ROUND ${report.round} · PAYOUT</div><h3>赌场派彩</h3><div>${report.awards.length ? report.awards.map((award) => `<p><span>${award.casino}号赌场</span><b>${escapeHtml(playerName(room, award.playerId))}</b><strong>${award.playerId.startsWith("__") ? "奖金退回银行" : `+$${award.value}K`}</strong></p>`).join("") : "<p>本轮所有赌场均因平票无人获奖</p>"}</div><small>下一轮已经就位，可随时关闭本报告继续观察。</small>`;
    $("closeVegasPayout").onclick = () => box.classList.add("hidden");
  }

  const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  function eventPlayer(room, id) { return id?.startsWith("__") ? playerName(room, id) : playerName(room, id); }
  function eventDiceMarkup(dice, hidden = false, color = "") {
    return dice.map((item, index) => dieHtml({ ...item, face: hidden ? 1 : item.face }, `event-cube ${hidden ? "mystery" : ""} ${item.black ? "black" : ""}`, color).replace('class="die-cube ', `style="--delay:${index * 55}ms" class="die-cube `)).join("");
  }

  async function presentEvent(room, event) {
    // 普通行动掷骰只由行动玩家进入放大确认层；其他玩家直接看中央骰盅中的同步结果。
    if (event.type === "dice-roll" && event.reason === "行动掷骰" && event.playerId !== getMyId()) return;
    const stage = $("vegasEventStage"), visual = $("vegasEventVisual"), title = $("vegasEventTitle"), detail = $("vegasEventDetail"), kicker = $("vegasEventKicker"), controls = $("vegasEventControls");
    if (!stage) return;
    stage.className = `vegas-event-stage ${event.type}`; visual.className = "event-visual";
    kicker.textContent = event.reason || "赌场播报"; detail.textContent = ""; controls.innerHTML = "";
    if (event.type === "dice-roll") {
      title.textContent = `${eventPlayer(room, event.playerId)} 正在掷骰`;
      const color = room.players.find((player) => player.id === event.playerId)?.color || "";
      visual.innerHTML = eventDiceMarkup(event.dice || [], true, color); sound("roll");
      await pause(1250);
      visual.classList.add("revealed"); visual.innerHTML = eventDiceMarkup(event.dice || [], false, color);
      title.textContent = `${eventPlayer(room, event.playerId)} 掷出的结果`;
      detail.textContent = `结果：${(event.dice || []).map((item) => item.face).join("、")}。骰子会保留在中央，看清后再选择赌场。`;
      await pause(1600);
      await new Promise((resolve) => {
        const button = actionButton(event.playerId === getMyId() ? "我已看清 · 开始选择赌场" : "看清结果 · 返回牌桌", resolve, "event-confirm");
        controls.append(button);
      });
    } else if (event.type === "dice-place") {
      title.textContent = `${eventPlayer(room, event.playerId)} 放置骰子`;
      const color = room.players.find((player) => player.id === event.playerId)?.color || "";
      visual.innerHTML = eventDiceMarkup(event.dice || [], false, color); detail.textContent = event.casino ? `飞向 ${event.casino} 号赌场` : event.reason;
      sound("place"); await pause(250); visual.classList.add("flying"); await pause(850);
    } else if (event.type === "dice-kick") {
      title.textContent = "Biggy 发动踢骰";
      const color = room.players.find((player) => player.id === event.targetPlayerId)?.color || "";
      visual.innerHTML = eventDiceMarkup(event.dice || [], false, color); detail.textContent = `${eventPlayer(room, event.targetPlayerId)} 的普通骰被踢回骰池`;
      sound("place"); await pause(250); visual.classList.add("kicked"); await pause(1000);
    } else if (event.type === "money") {
      const gain = event.amount > 0;
      title.textContent = gain ? "奖金正在派发" : "罚款正在收取";
      visual.innerHTML = `<span class="event-banknote face-down">BANK</span>`; await pause(420);
      visual.innerHTML = `<span class="event-banknote ${gain ? "gain" : "loss"}">${gain ? "+" : "−"}$${Math.abs(event.amount)}K</span>`;
      detail.textContent = `${eventPlayer(room, event.playerId)} · ${event.reason}`; sound("cash"); await pause(1800);
    } else if (event.type === "chips") {
      const gain = event.amount > 0;
      title.textContent = gain ? "筹码奖励" : "支付筹码";
      visual.innerHTML = `<span class="event-chip ${gain ? "gain" : "loss"}">${gain ? "+" : "−"}${Math.abs(event.amount)}</span>`;
      detail.textContent = `${eventPlayer(room, event.playerId)} · ${event.reason}`; sound(gain ? "cash" : "place"); await pause(1600);
    } else if (event.type === "reveal") {
      title.textContent = "结果揭晓"; visual.innerHTML = '<span class="event-reveal-card">?</span>'; await pause(500);
      visual.classList.add("revealed"); visual.innerHTML = '<span class="event-reveal-card open">✓</span>'; detail.textContent = event.reason; await pause(850);
    } else if (event.type === "round-start") {
      title.textContent = `第 ${event.round} 轮开场`; visual.innerHTML = '<span class="event-marquee">WELCOME</span>'; detail.textContent = "奖金、筹码与赌场模块正在入场"; await pause(1050);
    }
    stage.classList.add("leaving"); await pause(230); stage.classList.add("hidden"); stage.classList.remove("leaving");
  }

  async function playEventQueue(room) {
    if (eventPlaying) return;
    eventPlaying = true;
    while (eventQueue.length) await presentEvent(room, eventQueue.shift());
    eventPlaying = false;
  }

  function queuePresentation(room) {
    const events = room.game.animationEvents || [];
    if (!previous?.game && previous !== null) lastPresentedEventId = 0;
    else if (previous === null && lastPresentedEventId === 0) lastPresentedEventId = Math.max(0, ...events.map((event) => event.id));
    const fresh = events.filter((event) => event.id > lastPresentedEventId);
    if (!fresh.length) return;
    lastPresentedEventId = fresh[fresh.length - 1].id; eventQueue.push(...fresh); playEventQueue(room);
  }

  function render(room) {
    show("game"); const game = room.game;
    $("rulesContent").innerHTML = rulesMarkup();
    $("vegasCode").textContent = room.code; $("vegasRound").innerHTML = `<span>ROUND</span><b>${game.round} / 3</b>`;
    renderPlayers(room); $("casinoGrid").innerHTML = game.casinos.map((casino) => renderCasino(room, casino)).join(""); renderArena(room); renderPayout(room); queuePresentation(room);
    const choosing = game.currentTurnId === getMyId() && game.currentRoll?.length && !game.pending;
    document.querySelector(".vegas-table")?.classList.toggle("choosing-casino", Boolean(choosing));
    document.querySelectorAll(".casino-card.selectable").forEach((card) => {
      const choose = () => { sound("place"); emit("place", { face: Number(card.dataset.casino) }); };
      card.onclick = choose;
      card.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(); } };
    });
    document.querySelectorAll(".royale-tile").forEach((button) => {
      button.onclick = (event) => { event.stopPropagation(); showTileRules(room, button.dataset.tile); };
      button.onkeydown = (event) => { event.stopPropagation(); };
    });
    $("roundStatus").innerHTML = `<p><span>当前回合</span><b>${escapeHtml(playerName(room, game.currentTurnId))}</b></p><p><span>封锁赌场</span><b>${game.closedCasino ? `${game.closedCasino}号` : "无"}</b></p><p><span>强势控场</span><b>${game.powerToken ? escapeHtml(playerName(room, game.powerToken)) : "无人持有"}</b></p>`;
    $("vegasLog").innerHTML = game.log.map((line) => `<p>${escapeHtml(line)}</p>`).join(""); renderFinish(room); previous = room;
  }

  return { prepare: () => previous, renderLobby, render };
};
