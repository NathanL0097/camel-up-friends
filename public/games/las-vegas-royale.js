window.GameClientFactories ||= {};

window.GameClientFactories["las-vegas-royale"] = ({ socket, $, show, escapeHtml, getMyId, copyInvite }) => {
  const emit = (action, payload = {}) => socket.emit("game:action", { action, payload });
  const COLOR_NAMES = { ruby: "红宝石", cyan: "霓虹蓝", gold: "金色", violet: "紫晶", emerald: "翡翠" };
  let previous = null;

  $("gameMount").innerHTML = `
    <div class="vegas-shell">
      <header class="vegas-head">
        <div><div class="vegas-kicker">LAS VEGAS · 好友房 <span id="vegasCode"></span></div><h2>拉斯维加斯豪华版</h2></div>
        <div id="vegasRound" class="vegas-round"></div>
        <div class="game-head-actions"><button id="vegasRules" class="ghost-button">📖 规则速查</button><button id="vegasInvite" class="ghost-button">邀请好友</button></div>
      </header>
      <div id="vegasFinish" class="vegas-finish hidden"></div>
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

  function dieHtml(item, extra = "") {
    return `<span class="vegas-die ${item.big ? "biggy" : ""} ${extra}" title="${item.big ? "Biggy：结算时算两颗" : "普通骰"}"><i>${item.face || "◆"}</i>${item.big ? "<b>×2</b>" : ""}</span>`;
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
    return `<article class="casino-card casino-${casino.number} ${game.closedCasino === casino.number ? "closed" : ""}">
      <div class="casino-sign"><span>${casino.number}</span><div><small>CASINO</small><b>${["日落大道", "埃及艳后", "海市蜃楼", "金色马蹄", "霓虹宫殿", "幸运之星"][casino.number - 1]}</b></div></div>
      <div class="money-cards">${casino.money.map((value) => `<span>$${value}K</span>`).join("")}</div>
      ${tile ? `<div class="royale-tile" title="${escapeHtml(tile.name)}"><span>${tile.icon}</span><div><small>豪华板块 ${tile.id}</small><b>${escapeHtml(tile.name)}</b></div>${tile.state.jackpot ? `<em>$${tile.state.jackpot}K</em>` : ""}</div>` : ""}
      <div class="casino-dice">${dice || "<span class=\"empty-table\">等待骰子入场</span>"}${casino.blankDice ? `<div class="blank-dice">灰骰 × ${casino.blankDice}</div>` : ""}</div>
      ${game.closedCasino === casino.number ? "<div class=\"closed-stamp\">禁止入场</div>" : ""}
    </article>`;
  }

  function actionButton(label, onclick, className = "") {
    const button = document.createElement("button"); button.className = `vegas-action ${className}`; button.textContent = label; button.onclick = onclick; return button;
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
    return ({ luckyChoose: "幸运一拳", luckyGuess: "猜拳", fifty: "猜高猜低", noEntry: "禁止入场", block: "堵住它", handicap: "让分局", doubleDown: "双倍下注", niceDice: "妙骰", myChoice: "任我选", primeTime: "黄金时刻", blackDivide: "黑箱分组", blackChoose: "黑箱选奖" })[type] || "板块效果";
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
    $("rolledDice").innerHTML = game.currentRoll?.length ? game.currentRoll.map((item) => dieHtml(item, "rolling")).join("") : "<span class=\"arena-placeholder\">◆</span>";
    const area = $("rollActions"); area.innerHTML = "";
    if (game.pending) return renderPending(room, game.pending, pendingMine);
    if (!mine) { area.innerHTML = "<div class=\"waiting-choice\">赌场正在等待下一次掷骰…</div>"; return; }
    const me = room.players.find((p) => p.id === getMyId());
    if (!game.currentRoll) {
      area.append(actionButton(`掷全部 ${me.diceLeft} 颗骰子`, () => emit("roll"), "roll-main"));
      if (game.powerToken === getMyId()) {
        area.insertAdjacentHTML("beforeend", optionSelect([[1,"1点"],[2,"2点"],[3,"3点"],[4,"4点"],[5,"5点"],[6,"6点"]], "powerFace"));
        area.append(actionButton("使用强势控场", () => emit("power", { face: +$("powerFace").value }), "power"));
      }
      return;
    }
    [...new Set(game.currentRoll.map((d) => d.face))].sort().forEach((face) => {
      const count = game.currentRoll.filter((d) => d.face === face).length;
      const closed = game.closedCasino === face;
      const button = actionButton(`${face} 点 × ${count}${closed ? "（封锁）" : ""}`, () => emit("place", { face })); button.disabled = closed; area.append(button);
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

  function render(room) {
    show("game"); const game = room.game;
    $("rulesContent").innerHTML = `<div class="eyebrow">LAS VEGAS ROYALE</div><h2>拉斯维加斯豪华版 · 规则速查</h2><ol><li>游戏共 <b>3轮</b>。回合中掷出所有剩余骰子，选择一个点数，并把该点数的全部骰子放进对应赌场。</li><li>每人有7颗普通骰和1颗 <b>Biggy</b>；Biggy结算时算2颗，但放置和被淘汰时仍是一颗骰子。</li><li>不满意结果可花1枚筹码跳过。每轮开始补2枚筹码；游戏结束时每枚筹码值$10K。</li><li>每座赌场有两张奖金。结算前，相同票数的玩家全部淘汰；其余玩家按票数由高到低拿走较高、较低奖金。</li><li>赌场1–3每轮各有一块随机豪华板块。放骰后立即按中央提示完成效果；部分板块会在轮末结算。</li><li>两人游戏会加入一组中立骰。中立骰照常竞争，但赢得的钱退回银行。</li><li>三轮后总资产最高者获胜；平手时奖金牌与筹码总张数较多者胜。</li></ol><p class="rules-note">在线私人技术原型。玩法依据 Ravensburger 官方说明书实现；美术与界面为原创重绘。</p>`;
    $("vegasCode").textContent = room.code; $("vegasRound").innerHTML = `<span>ROUND</span><b>${game.round} / 3</b>`;
    renderPlayers(room); $("casinoGrid").innerHTML = game.casinos.map((casino) => renderCasino(room, casino)).join(""); renderArena(room);
    $("roundStatus").innerHTML = `<p><span>当前回合</span><b>${escapeHtml(playerName(room, game.currentTurnId))}</b></p><p><span>封锁赌场</span><b>${game.closedCasino ? `${game.closedCasino}号` : "无"}</b></p><p><span>强势控场</span><b>${game.powerToken ? escapeHtml(playerName(room, game.powerToken)) : "无人持有"}</b></p>`;
    $("vegasLog").innerHTML = game.log.map((line) => `<p>${escapeHtml(line)}</p>`).join(""); renderFinish(room); previous = room;
  }

  return { prepare: () => previous, render };
};
