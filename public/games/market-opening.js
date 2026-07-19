(() => {
  const PREDICTION_NAMES = { up: "上涨", down: "下跌", flat: "不变", none: "不预测" };
  const TRADE_NAMES = { buy: "买入", sell: "卖出", hold: "观望" };

  window.GameClientFactories ||= {};
  window.GameClientFactories["market-opening"] = ({ socket, $, show, escapeHtml, getMyId, copyInvite }) => {
    let predictionChoice = "up";
    let tradeChoice = "hold";
    let latestRoom = null;
    let feedbackTimer = null;
    const emitAction = (action, payload = {}) => socket.emit("game:action", { action, payload });

    $("gameMount").innerHTML = `
      <div class="market-game">
        <div class="game-head market-head">
          <div><div class="eyebrow"><span id="marketTitleBadge">开盘！</span> · 房间 <span id="marketCode"></span></div><h2 id="marketRound">第 1 轮</h2></div>
          <div id="marketPhase" class="turn-badge market-phase"></div>
          <div class="game-head-actions"><button id="marketRulesButton" class="ghost-button rules-shortcut">📖 规则速查</button><button id="marketCopyButton" class="ghost-button">邀请好友</button></div>
        </div>
        <section id="characterDraft" class="character-draft hidden"></section>
        <div id="marketLayout" class="market-layout">
          <aside class="market-side market-players-panel"><div class="market-panel-title"><span>交易席</span><small>持股公开 · 资金私密</small></div><div id="marketPlayers"></div></aside>
          <main class="market-center">
            <section id="listingEvent" class="listing-event hidden"></section>
            <section class="market-chart-card">
              <div class="ticker-heading"><div><span>FRIENDS MARKET</span><small>好友综合指数</small></div><div id="marketQuote" class="market-quote"></div></div>
              <div class="market-chart-wrap"><svg id="marketChart" viewBox="0 0 800 320" preserveAspectRatio="none"></svg><div id="marketOpeningFeedback" class="market-opening-feedback"></div></div>
              <div class="market-stats"><span>主牌已公开 <b id="revealedCount">0</b> 张</span><span>开局秘密移除 <b>6</b> 张</span><span>本局共 <b>8</b> 轮</span></div>
            </section>
            <section id="marketDecision" class="market-decision-card paper">
              <div id="skillPanel" class="skill-panel"></div>
              <div id="pendingEffectNotice" class="pending-effect-notice hidden"></div>
              <div class="decision-section"><label>① 预测本轮走势</label><div id="predictionChoices" class="segmented prediction-segments"><button data-prediction="up">↗ 上涨</button><button data-prediction="down">↘ 下跌</button><button data-prediction="flat">→ 不变</button><button data-prediction="none">跳过</button></div><div id="wagerRow" class="wager-row"><span>下注</span><input id="marketWager" type="range" min="1" max="5" value="1"><b><span id="wagerValue">1</span> 🪙</b></div></div>
              <div class="decision-section"><label>② 按当前价格交易</label><div id="tradeChoices" class="segmented trade-segments"><button data-trade="buy">买入</button><button data-trade="sell">卖出</button><button data-trade="hold">不操作</button></div><div id="shareRow" class="share-row hidden"><button id="shareMinus">−</button><input id="marketShares" type="number" min="1" value="1"><button id="sharePlus">＋</button><span>股</span></div><small id="tradeCapacity"></small></div>
              <button id="lockDecision" class="market-lock-button">锁定预测与交易 <span>→</span></button>
              <div id="lockedDecision" class="locked-decision hidden"></div>
              <div id="effectChoice" class="effect-choice hidden"><div><label>③ 选择一张盖下，影响下一轮</label><small>另一张将直接弃掉</small></div><div id="effectCards" class="effect-cards"></div></div>
            </section>
            <section id="marketFinish" class="market-finish hidden"></section>
          </main>
          <aside class="market-side market-tape-panel"><div class="market-panel-title"><span>市场记录</span><small>公开信息</small></div><div id="marketHistory"></div></aside>
        </div>
      </div>`;

    $("rulesContent").innerHTML = `<div class="eyebrow">原创好友房原型 · 第三版</div><h2>《开盘！》规则速查</h2><ol><li><strong>选角：</strong>开局自动掷骰，按点数从高到低依次选择10位商业奇才。主动技能整局只能使用一次，而且必须在本轮买卖与预测锁定前发动。</li><li><strong>目标：</strong>8轮后以“现金＋最终股价×持股＋预测金币×50＋角色加成”计算最终财富。长线投资家终局每持有1股额外获得8资金。</li><li><strong>预测：</strong>可选择不预测，也可投入1–5金币猜上涨、下跌或不变。猜中涨跌净赚等额金币；猜中不变净赚2倍；猜错损失下注，实际横盘而猜涨跌只扣1枚。</li><li><strong>交易：</strong>按开盘前价格秘密买卖，不限制持股总数，但不能透支或做空。所有人完成后才统一公开买卖量与最新持股。</li><li><strong>趣味事件：</strong>每轮都有一条突发新闻，与主牌同时揭示并提供−10、0或+10影响。预言家可整局一次提前私下查看当轮新闻及数值。</li><li><strong>玩家效果牌：</strong>每轮抽2选1盖下，下一轮匿名公开。数值效果合计最多影响±20；稀有“交易所停摆”会取消本轮交易，价格不动，所有已下注预测都亏损。</li><li><strong>上市事件：</strong>角色选择完成后公开，只在第一轮额外提供−10、0或+10影响。</li><li><strong>结算：</strong>每轮中央会显示约5秒的全员持仓与本轮变动；右侧记录保留趣味事件、玩家效果牌和主牌。</li></ol><p class="rules-note">停牌时选择“不预测”的玩家不会损失金币；被取消的股票交易不会扣除资金或改变持股。</p>`;

    $("marketRulesButton").onclick = () => $("rulesDialog").showModal();
    $("marketCopyButton").onclick = copyInvite;
    $("marketWager").oninput = () => { $("wagerValue").textContent = $("marketWager").value; };
    document.querySelectorAll("[data-prediction]").forEach((button) => button.onclick = () => { predictionChoice = button.dataset.prediction; paintChoices(); });
    document.querySelectorAll("[data-trade]").forEach((button) => button.onclick = () => { tradeChoice = button.dataset.trade; paintChoices(); });
    $("shareMinus").onclick = () => { $("marketShares").value = Math.max(1, Number($("marketShares").value) - 1); };
    $("sharePlus").onclick = () => { $("marketShares").value = Number($("marketShares").value) + 1; };
    $("lockDecision").onclick = () => emitAction("submit", { prediction: predictionChoice, wager: predictionChoice === "none" ? 0 : Number($("marketWager").value), trade: tradeChoice, shares: Number($("marketShares").value) });

    function paintChoices() {
      document.querySelectorAll("[data-prediction]").forEach((button) => button.classList.toggle("selected", button.dataset.prediction === predictionChoice));
      document.querySelectorAll("[data-trade]").forEach((button) => button.classList.toggle("selected", button.dataset.trade === tradeChoice));
      $("shareRow").classList.toggle("hidden", tradeChoice === "hold");
      $("wagerRow").classList.toggle("hidden", predictionChoice === "none");
      if (predictionChoice !== "none" && Number($("marketWager").value) < 1) $("marketWager").value = 1;
      $("wagerValue").textContent = $("marketWager").value;
      updateTradeCapacity();
    }

    function updateTradeCapacity() {
      const game = latestRoom?.game;
      const me = latestRoom?.players?.find((player) => player.id === getMyId());
      if (!game || !me || game.status === "finished") return;
      const capacity = tradeChoice === "buy" ? Math.floor(me.cash / game.price) : tradeChoice === "sell" ? me.shares : 0;
      $("tradeCapacity").textContent = tradeChoice === "buy" ? `最多可买 ${capacity} 股` : tradeChoice === "sell" ? `最多可卖 ${capacity} 股` : "本轮保持现有仓位";
      $("marketShares").max = Math.max(1, capacity);
    }

    function formatSigned(value) { return `${value > 0 ? "+" : ""}${value}`; }

    function chartMarkup(prices) {
      const width = 800, height = 320, padX = 34, padY = 34;
      const low = Math.min(...prices, 20);
      const high = Math.max(...prices, 80);
      const range = Math.max(40, high - low);
      const minY = Math.max(0, low - range * 0.18);
      const maxY = high + range * 0.18;
      const points = prices.map((price, index) => ({
        x: prices.length === 1 ? padX : padX + index * (width - padX * 2) / 8,
        y: height - padY - (price - minY) / (maxY - minY) * (height - padY * 2),
        price
      }));
      const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
      const area = `${line} L ${points.at(-1).x.toFixed(1)} ${height - padY} L ${points[0].x.toFixed(1)} ${height - padY} Z`;
      const grids = [0, 1, 2, 3, 4].map((index) => { const y = padY + index * (height - padY * 2) / 4; const value = Math.round(maxY - index * (maxY - minY) / 4); return `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" class="chart-grid"/><text x="${width - padX - 5}" y="${y - 7}" class="chart-label">${value}</text>`; }).join("");
      const dots = points.map((point, index) => `<g class="chart-point ${index === points.length - 1 ? "latest" : ""}"><circle cx="${point.x}" cy="${point.y}" r="${index === points.length - 1 ? 7 : 4}"/><text x="${point.x}" y="${point.y - 15}">${point.price}</text></g>`).join("");
      return `<defs><linearGradient id="marketArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55e6a5" stop-opacity=".34"/><stop offset="1" stop-color="#55e6a5" stop-opacity="0"/></linearGradient><filter id="lineGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${grids}<path d="${area}" class="chart-area"/><path id="pricePath" d="${line}" class="price-path" filter="url(#lineGlow)"/>${dots}`;
    }

    function animateChart() {
      const path = document.getElementById("pricePath");
      if (!path) return;
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.getBoundingClientRect();
      path.style.transition = "stroke-dashoffset 1.15s cubic-bezier(.2,.8,.25,1)";
      path.style.strokeDashoffset = "0";
    }

    function showOpening(event, players) {
      const feedback = $("marketOpeningFeedback");
      if (!feedback || !event) return;
      clearTimeout(feedbackTimer);
      const direction = event.halted ? "halt" : event.change > 0 ? "up" : event.change < 0 ? "down" : "flat";
      const playerById = Object.fromEntries(players.map((player) => [player.id, player]));
      const rows = event.orders.map((order) => {
        const change = order.cancelled || order.trade === "hold" ? 0 : order.trade === "buy" ? order.shares : -order.shares;
        return `<tr><td>${escapeHtml(playerById[order.playerId]?.name || "玩家")}</td><td><b>${order.holding}</b> 股</td><td class="${change > 0 ? "up" : change < 0 ? "down" : "flat"}">${order.cancelled ? "交易取消" : change ? `${change > 0 ? "+" : ""}${change} 股` : "0 股"}</td></tr>`;
      }).join("");
      feedback.innerHTML = `<div class="opening-summary"><span class="opening-kicker">ROUND ${event.round} · ${event.halted ? "MARKET HALT" : "OPEN"}</span><strong>${event.priceBefore} <i>→</i> ${event.priceAfter}</strong><b>${event.halted ? "⏸ 交易所停摆" : `${direction === "up" ? "▲" : direction === "down" ? "▼" : "●"} ${formatSigned(event.change)}`}</b><small>主牌 ${formatSigned(event.main)} · 玩家效果 ${formatSigned(event.playerEffect)}${event.openingImpact ? ` · 上市事件 ${formatSigned(event.openingImpact)}` : ""}</small></div><div class="round-event-reveal"><span>${event.roundEvent.icon}</span><div><small>本轮趣味事件 · ${formatSigned(event.roundEvent.impact)}</small><strong>${escapeHtml(event.roundEvent.title)}</strong></div></div><div class="holdings-settlement"><div><strong>全员持仓结算</strong><small>持股总数与本轮实际变动</small></div><table><thead><tr><th>玩家</th><th>结算后持仓</th><th>本轮变动</th></tr></thead><tbody>${rows}</tbody></table></div>${event.halted ? `<em>本轮交易取消 · 所有已下注预测亏损</em>` : ""}`;
      feedback.className = `market-opening-feedback ${direction}`;
      void feedback.offsetWidth;
      feedback.classList.add("showing");
      feedbackTimer = setTimeout(() => feedback.classList.remove("showing"), 5200);
    }

    function renderDraft(room) {
      const game = room.game;
      const draft = $("characterDraft");
      const drafting = game.phase === "character-draft";
      draft.classList.toggle("hidden", !drafting);
      $("marketLayout").classList.toggle("hidden", drafting);
      if (!drafting) return;
      const playerById = Object.fromEntries(room.players.map((player) => [player.id, player]));
      const myTurn = game.draftCurrentPlayerId === getMyId();
      draft.innerHTML = `<div class="draft-heading"><div><span class="draft-kicker">🎲 角色骰已完成</span><h2>${myTurn ? "轮到你选择商业奇才" : `等待 ${escapeHtml(playerById[game.draftCurrentPlayerId]?.name || "玩家")} 选择`}</h2><p>点数从高到低依次选择，每个角色一局中只会出现一次。</p></div><div class="draft-order">${game.draftOrder.map((entry, index) => { const player = playerById[entry.playerId]; return `<div class="draft-seat ${entry.playerId === game.draftCurrentPlayerId ? "current" : ""}"><b>${index + 1}</b><span>${escapeHtml(player?.name || "玩家")}</span><em>🎲 ${entry.roll}</em>${player?.character ? `<small>${player.character.avatar} ${player.character.name}</small>` : ""}</div>`; }).join("")}</div></div><div class="character-grid">${game.availableCharacters.map((character) => `<button class="character-card ${character.type}" data-character="${character.id}" ${myTurn ? "" : "disabled"}><span class="character-avatar">${character.avatar}</span><span class="character-type">${character.type === "passive" ? "开局被动" : "一次性技能"}</span><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(character.description)}</small><em>选择角色 →</em></button>`).join("")}</div>`;
      document.querySelectorAll("[data-character]").forEach((button) => button.onclick = () => emitAction("character", { characterId: button.dataset.character }));
    }

    function renderListingEvent(game) {
      const event = game.openingEvent;
      $("listingEvent").classList.toggle("hidden", !event || game.round !== 1 || game.history.length > 0);
      if (!event || game.round !== 1 || game.history.length > 0) return;
      $("listingEvent").innerHTML = `<span>${event.icon}</span><div><small>上市首日公开新闻</small><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.description)}</p></div><b class="${event.impact > 0 ? "up" : event.impact < 0 ? "down" : "flat"}">${formatSigned(event.impact)}</b>`;
    }

    function renderSkill(room) {
      const game = room.game;
      const me = room.players.find((player) => player.id === getMyId());
      const panel = $("skillPanel");
      if (!me?.character) return panel.classList.add("hidden");
      panel.classList.remove("hidden");
      const character = me.character;
      const locked = Boolean(game.mySubmission);
      if (character.type === "passive") {
        panel.innerHTML = `<div class="skill-avatar">${character.avatar}</div><div><small>你的角色 · 被动生效</small><strong>${escapeHtml(character.name)}</strong><p>${escapeHtml(character.description)}</p></div><b>常驻</b>`;
        return;
      }
      if (character.skillUsed) {
        panel.innerHTML = `<div class="skill-avatar used">${character.avatar}</div><div><small>你的角色 · 技能已发动</small><strong>${escapeHtml(character.name)}</strong><p>${me.skillInfo ? `侦察结果：${escapeHtml(me.skillInfo)}` : escapeHtml(character.description)}</p></div><b class="used">已用</b>`;
        return;
      }
      const others = room.players.filter((player) => player.id !== getMyId());
      let controls = `<button id="activateSkill" ${locked ? "disabled" : ""}>发动一次性技能</button>`;
      if (character.id === "cleaner") controls = `<select id="skillTarget">${others.map((player) => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join("")}</select><button id="activateSkill" ${locked || game.round === 1 ? "disabled" : ""}>使其盖牌失效</button>`;
      if (character.id === "prophet") controls = `<button id="activateSkill" ${locked ? "disabled" : ""}>查看本轮趣味事件</button>`;
      panel.innerHTML = `<div class="skill-avatar">${character.avatar}</div><div class="skill-copy"><small>你的角色 · 整局限一次</small><strong>${escapeHtml(character.name)}</strong><p>${escapeHtml(character.description)}</p>${character.id === "card-master" && me.secretRoleCard ? `<span class="secret-role-card">私藏：${me.secretRoleCard.icon} ${escapeHtml(me.secretRoleCard.title)}（${formatSigned(me.secretRoleCard.impact)}）</span>` : ""}</div><div class="skill-controls">${controls}${character.id === "cleaner" && game.round === 1 ? `<small>第二轮起可发动</small>` : ""}</div>`;
      $("activateSkill")?.addEventListener("click", () => emitAction("skill", { targetId: $("skillTarget")?.value, direction: $("skillDirection")?.value }));
    }

    function renderPlayers(room) {
      const finished = room.game.status === "finished";
      const players = finished ? room.players.slice().sort((a, b) => a.rank - b.rank) : room.players;
      $("marketPlayers").innerHTML = players.map((player) => {
        const mine = player.id === getMyId();
        const waiting = room.game.waitingFor.includes(player.id);
        return `<div class="market-player ${mine ? "mine" : ""} ${player.ready && !waiting ? "ready" : ""}"><div class="market-player-name"><span>${finished ? `<b>#${player.rank}</b>` : player.connected ? "●" : "○"} ${mine ? "你 · " : ""}${escapeHtml(player.name)}</span><em>${player.shares} 股</em></div>${player.character ? `<div class="player-character"><i>${player.character.avatar}</i><span>${escapeHtml(player.character.name)}</span><small>${player.character.type === "passive" ? "被动" : player.character.skillUsed ? "技能已用" : "技能可用"}</small></div>` : `<div class="player-character pending">等待选角</div>`}${mine || finished ? `<div class="private-wallet"><span>${player.cash} 资金</span><span>${player.predictionCoins} 🪙</span></div>` : `<div class="private-wallet"><span>${player.ready ? player.effectReady || room.game.round === 8 ? "决定已锁定" : "正在选择消息" : "思考中…"}</span><span>资金 🔒</span></div>`}${finished ? `<div class="final-player-wealth">最终财富 <strong>${player.finalWealth}</strong>${player.characterBonus ? `<small>含角色加成 +${player.characterBonus}</small>` : ""}</div>` : ""}</div>`;
      }).join("");
    }

    function renderDecision(room) {
      const game = room.game;
      const me = room.players.find((player) => player.id === getMyId());
      if (game.status === "finished") {
        $("marketDecision").classList.add("hidden");
        return;
      }
      $("marketDecision").classList.remove("hidden");
      renderSkill(room);
      const pending = game.myPendingEffect;
      $("pendingEffectNotice").classList.toggle("hidden", !pending);
      if (pending) $("pendingEffectNotice").innerHTML = `<span>${pending.icon}</span><div><small>你上一轮盖下 · 本轮开盘时揭示</small><strong>${escapeHtml(pending.title)}</strong><p>${escapeHtml(pending.description)}</p></div><b class="${pending.tone}">${pending.halt ? "停牌" : formatSigned(pending.impact)}</b>`;
      const submitted = game.mySubmission;
      $("lockedDecision").classList.toggle("hidden", !submitted);
      [...$("marketDecision").querySelectorAll(".decision-section"), $("lockDecision")].forEach((element) => element.classList.toggle("hidden", Boolean(submitted)));
      if (submitted) {
        $("lockedDecision").innerHTML = `<span>✓ 本轮已锁定</span><b>${PREDICTION_NAMES[submitted.prediction]}${submitted.prediction === "none" ? "" : ` · ${submitted.wager} 🪙`}</b><b>${TRADE_NAMES[submitted.trade]}${submitted.trade === "hold" ? "" : ` ${submitted.shares}股`}</b>`;
      }
      const showEffects = Boolean(game.myOffer) && game.round < game.totalRounds;
      $("effectChoice").classList.toggle("hidden", !showEffects);
      if (showEffects) {
        $("effectCards").innerHTML = game.myOffer.map((effect, index) => `<button class="effect-card ${effect.tone} ${game.myEffect?.key === effect.key ? "chosen" : ""}" data-effect="${effect.key}" ${game.myEffect ? "disabled" : ""}><span>${effect.icon}</span><strong>${escapeHtml(effect.title)}</strong><b>${effect.halt ? "停牌" : formatSigned(effect.impact)}</b><small>${escapeHtml(effect.description)}${game.myOffer[0].key === game.myOffer[1].key ? ` · 第${index + 1}张` : ""}</small></button>`).join("");
        document.querySelectorAll("[data-effect]").forEach((button) => button.onclick = () => emitAction("effect", { effect: button.dataset.effect }));
      }
      $("marketWager").min = 1;
      $("marketWager").max = Math.min(5, me.predictionCoins);
      if (me.predictionCoins === 0) predictionChoice = "none";
      if (Number($("marketWager").value) > Number($("marketWager").max)) $("marketWager").value = $("marketWager").max;
      $("wagerValue").textContent = $("marketWager").value;
      paintChoices();
    }

    function renderHistory(room) {
      const playerById = Object.fromEntries(room.players.map((player) => [player.id, player]));
      $("marketHistory").innerHTML = room.game.history.length ? room.game.history.map((event) => `<article class="market-round-log ${event.halted ? "halted" : ""}"><header><b>第 ${event.round} 轮${event.halted ? " · 停牌" : ""}</b><strong class="${event.change > 0 ? "up" : event.change < 0 ? "down" : "flat"}">${event.priceBefore} → ${event.priceAfter}</strong></header><div class="fun-event-log"><span>${event.roundEvent.icon}</span><div><small>趣味事件 ${formatSigned(event.roundEvent.impact)}</small><strong>${escapeHtml(event.roundEvent.title)}</strong></div></div><div class="main-card-reveal"><span>主市场牌</span><b>${formatSigned(event.main)}</b></div><div class="anonymous-effects"><small>匿名效果牌</small>${event.effects.length ? `<div>${event.effects.map((item) => `<span class="revealed-effect ${item.card.tone} ${item.cancelled ? "cancelled" : ""}" title="${escapeHtml(item.card.description)}">${item.card.icon} ${escapeHtml(item.card.title)} <b>${item.card.halt ? "停牌" : formatSigned(item.card.impact)}</b>${item.cancelled ? " · 已失效" : ""}</span>`).join("")}</div>` : `<em>本轮没有上一轮效果牌</em>`}</div><div class="market-card-result"><span>玩家效果合计 ${formatSigned(event.playerEffect)}</span>${event.openingImpact ? `<span>上市事件 ${formatSigned(event.openingImpact)}</span>` : ""}</div><details><summary>查看公开交易与预测</summary>${event.orders.map((order) => { const prediction = event.predictions.find((item) => item.playerId === order.playerId); return `<p><b>${escapeHtml(playerById[order.playerId]?.name || "玩家")}</b><span>${order.cancelled ? "交易取消" : `${TRADE_NAMES[order.trade]}${order.trade === "hold" ? "" : ` ${order.shares}股`} · 持股 ${order.holding}`}<br>${PREDICTION_NAMES[prediction?.prediction] || ""}${prediction?.prediction === "none" ? "" : ` ${prediction?.wager}🪙 · ${formatSigned(prediction?.reward || 0)}🪙`}</span></p>`; }).join("")}</details></article>`).join("") : `<div class="empty-market-log">尚未开盘<br><small>第一轮结果将在这里公布</small></div>`;
    }

    function renderFinish(room) {
      const finish = $("marketFinish");
      if (room.game.status !== "finished") return finish.classList.add("hidden");
      const winner = room.players.find((player) => player.rank === 1);
      finish.classList.remove("hidden");
      finish.innerHTML = `<div class="finish-ribbon">FINAL CLOSING BELL</div><h2>🏆 ${escapeHtml(winner.name)} 赢得市场</h2><p>最终财富 <strong>${winner.finalWealth}</strong></p><div class="final-formula">现金 ＋ 最终股价 × 持股 ＋ 预测金币 × 50 ＋ 角色加成</div>${room.hostId === getMyId() ? `<button id="marketRestart">再开一局 ↻</button>` : `<small>等待房主开启下一局</small>`}`;
      $("marketRestart")?.addEventListener("click", () => socket.emit("game:restart"));
    }

    function render(room) {
      latestRoom = room;
      show("game");
      const game = room.game;
      $("marketTitleBadge").textContent = room.gameInfo.title;
      $("marketCode").textContent = room.code;
      $("marketRound").textContent = game.phase === "character-draft" ? "商业奇才选拔" : game.status === "finished" ? "最终收盘" : `第 ${game.round} / ${game.totalRounds} 轮`;
      const waiting = game.waitingFor.length;
      $("marketPhase").textContent = game.phase === "character-draft" ? game.draftCurrentPlayerId === getMyId() ? "轮到你选角色" : "角色选择中" : game.status === "finished" ? "比赛结束" : game.mySubmission ? game.myEffect || game.round === 8 ? `等待其他玩家 · ${waiting}人` : "请选择下轮消息" : "秘密决策中";
      const lastPrice = game.priceHistory.at(-2) ?? game.price;
      const delta = game.price - lastPrice;
      $("marketQuote").className = `market-quote ${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`;
      $("marketQuote").innerHTML = `<strong>${game.price}</strong><span>${delta > 0 ? "▲" : delta < 0 ? "▼" : "●"} ${formatSigned(delta)}</span>`;
      $("revealedCount").textContent = game.revealedMain.length;
      $("marketChart").innerHTML = chartMarkup(game.priceHistory);
      renderDraft(room);
      renderPlayers(room);
      renderListingEvent(game);
      renderDecision(room);
      renderHistory(room);
      renderFinish(room);
    }

    paintChoices();
    return {
      prepare(previousRoom) { return { previousEventId: previousRoom?.game?.lastEvent?.id ?? null, previousPhase: previousRoom?.game?.phase || null, wasLobby: Boolean(previousRoom && !previousRoom.game) }; },
      render(room, transition) {
        render(room);
        requestAnimationFrame(animateChart);
        const event = room.game.lastEvent;
        if (event && event.id !== transition.previousEventId) requestAnimationFrame(() => showOpening(event, room.players));
      }
    };
  };
})();
