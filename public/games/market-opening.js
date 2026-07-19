(() => {
  const PREDICTION_NAMES = { up: "上涨", down: "下跌", flat: "不变" };
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
        <div class="market-layout">
          <aside class="market-side market-players-panel"><div class="market-panel-title"><span>交易席</span><small>持股公开 · 资金私密</small></div><div id="marketPlayers"></div></aside>
          <main class="market-center">
            <section class="market-chart-card">
              <div class="ticker-heading"><div><span>FRIENDS MARKET</span><small>好友综合指数</small></div><div id="marketQuote" class="market-quote"></div></div>
              <div class="market-chart-wrap"><svg id="marketChart" viewBox="0 0 800 320" preserveAspectRatio="none"></svg><div id="marketOpeningFeedback" class="market-opening-feedback"></div></div>
              <div class="market-stats"><span>主牌已公开 <b id="revealedCount">0</b> 张</span><span>开局秘密移除 <b>6</b> 张</span><span>本局共 <b>8</b> 轮</span></div>
            </section>
            <section id="marketDecision" class="market-decision-card paper">
              <div class="decision-section"><label>① 预测本轮走势</label><div id="predictionChoices" class="segmented prediction-segments"><button data-prediction="up">↗ 上涨</button><button data-prediction="down">↘ 下跌</button><button data-prediction="flat">→ 不变</button></div><div class="wager-row"><span>下注</span><input id="marketWager" type="range" min="1" max="3" value="1"><b><span id="wagerValue">1</span> 🪙</b></div></div>
              <div class="decision-section"><label>② 按当前价格交易</label><div id="tradeChoices" class="segmented trade-segments"><button data-trade="buy">买入</button><button data-trade="sell">卖出</button><button data-trade="hold">不操作</button></div><div id="shareRow" class="share-row hidden"><button id="shareMinus">−</button><input id="marketShares" type="number" min="1" max="20" value="1"><button id="sharePlus">＋</button><span>股</span></div><small id="tradeCapacity"></small></div>
              <button id="lockDecision" class="market-lock-button">锁定预测与交易 <span>→</span></button>
              <div id="lockedDecision" class="locked-decision hidden"></div>
              <div id="effectChoice" class="effect-choice hidden"><div><label>③ 选择一张盖下，影响下一轮</label><small>另一张将直接弃掉</small></div><div id="effectCards" class="effect-cards"></div></div>
            </section>
            <section id="marketFinish" class="market-finish hidden"></section>
          </main>
          <aside class="market-side market-tape-panel"><div class="market-panel-title"><span>市场记录</span><small>公开信息</small></div><div id="marketHistory"></div></aside>
        </div>
      </div>`;

    $("rulesContent").innerHTML = `<div class="eyebrow">原创好友房原型</div><h2>《开盘！》规则速查</h2><ol><li><strong>目标：</strong>8轮后以“现金＋最终股价×持股＋预测金币×50”计算最终财富。</li><li><strong>秘密决策：</strong>每轮同时预测上涨、下跌或不变，下注1–3金币，并按开盘前价格买卖股票。每人最多持有20股，不能做空。</li><li><strong>效果牌：</strong>提交交易后抽2选1盖下，下一轮公开。利好多于利空时+10，利空较多时−10，数量相同为0。</li><li><strong>开盘：</strong>所有人锁定后，一起公开本轮买卖、持股、主市场牌和上一轮效果牌。新股价最低为10。</li><li><strong>预测收益：</strong>猜中涨跌净赚等额金币；猜错损失下注。实际不变而猜涨跌只损失1枚；猜中不变净赚下注的2倍。</li><li><strong>主牌：</strong>26张中开局秘密移除6张，比赛只翻8张，允许推测但无法精确算出后续。</li></ol><p class="rules-note">当前是第一版试玩规则，数值和效果会根据真实对局继续调整。</p>`;

    $("marketRulesButton").onclick = () => $("rulesDialog").showModal();
    $("marketCopyButton").onclick = copyInvite;
    $("marketWager").oninput = () => { $("wagerValue").textContent = $("marketWager").value; };
    document.querySelectorAll("[data-prediction]").forEach((button) => button.onclick = () => { predictionChoice = button.dataset.prediction; paintChoices(); });
    document.querySelectorAll("[data-trade]").forEach((button) => button.onclick = () => { tradeChoice = button.dataset.trade; paintChoices(); });
    $("shareMinus").onclick = () => { $("marketShares").value = Math.max(1, Number($("marketShares").value) - 1); };
    $("sharePlus").onclick = () => { $("marketShares").value = Math.min(20, Number($("marketShares").value) + 1); };
    $("lockDecision").onclick = () => emitAction("submit", { prediction: predictionChoice, wager: Number($("marketWager").value), trade: tradeChoice, shares: Number($("marketShares").value) });

    function paintChoices() {
      document.querySelectorAll("[data-prediction]").forEach((button) => button.classList.toggle("selected", button.dataset.prediction === predictionChoice));
      document.querySelectorAll("[data-trade]").forEach((button) => button.classList.toggle("selected", button.dataset.trade === tradeChoice));
      $("shareRow").classList.toggle("hidden", tradeChoice === "hold");
      updateTradeCapacity();
    }

    function updateTradeCapacity() {
      const game = latestRoom?.game;
      const me = latestRoom?.players?.find((player) => player.id === getMyId());
      if (!game || !me || game.status === "finished") return;
      const capacity = tradeChoice === "buy" ? Math.min(20 - me.shares, Math.floor(me.cash / game.price)) : tradeChoice === "sell" ? me.shares : 0;
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
      const direction = event.change > 0 ? "up" : event.change < 0 ? "down" : "flat";
      const effects = event.bulls === event.bears ? "多空平衡" : `${event.bulls > event.bears ? "利好" : "利空"}占优 ${event.bulls}:${event.bears}`;
      feedback.innerHTML = `<span class="opening-kicker">ROUND ${event.round} · OPEN</span><strong>${event.priceBefore} <i>→</i> ${event.priceAfter}</strong><b>${direction === "up" ? "▲" : direction === "down" ? "▼" : "●"} ${formatSigned(event.change)}</b><small>主牌 ${formatSigned(event.main)} · ${effects}（${formatSigned(event.playerEffect)}）</small>`;
      feedback.className = `market-opening-feedback ${direction}`;
      void feedback.offsetWidth;
      feedback.classList.add("showing");
      feedbackTimer = setTimeout(() => feedback.classList.remove("showing"), 3900);
    }

    function renderPlayers(room) {
      const finished = room.game.status === "finished";
      const players = finished ? room.players.slice().sort((a, b) => a.rank - b.rank) : room.players;
      $("marketPlayers").innerHTML = players.map((player) => {
        const mine = player.id === getMyId();
        const waiting = room.game.waitingFor.includes(player.id);
        return `<div class="market-player ${mine ? "mine" : ""} ${player.ready && !waiting ? "ready" : ""}"><div class="market-player-name"><span>${finished ? `<b>#${player.rank}</b>` : player.connected ? "●" : "○"} ${mine ? "你 · " : ""}${escapeHtml(player.name)}</span><em>${player.shares} 股</em></div>${mine || finished ? `<div class="private-wallet"><span>${player.cash} 资金</span><span>${player.predictionCoins} 🪙</span></div>` : `<div class="private-wallet"><span>${player.ready ? player.effectReady || room.game.round === 8 ? "决定已锁定" : "正在选择消息" : "思考中…"}</span><span>资金 🔒</span></div>`}${finished ? `<div class="final-player-wealth">最终财富 <strong>${player.finalWealth}</strong></div>` : ""}</div>`;
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
      const submitted = game.mySubmission;
      $("lockedDecision").classList.toggle("hidden", !submitted);
      [...$("marketDecision").querySelectorAll(".decision-section"), $("lockDecision")].forEach((element) => element.classList.toggle("hidden", Boolean(submitted)));
      if (submitted) {
        $("lockedDecision").innerHTML = `<span>✓ 本轮已锁定</span><b>${PREDICTION_NAMES[submitted.prediction]} · ${submitted.wager} 🪙</b><b>${TRADE_NAMES[submitted.trade]}${submitted.trade === "hold" ? "" : ` ${submitted.shares}股`}</b>`;
      }
      const showEffects = Boolean(game.myOffer) && game.round < game.totalRounds;
      $("effectChoice").classList.toggle("hidden", !showEffects);
      if (showEffects) {
        $("effectCards").innerHTML = game.myOffer.map((effect, index) => `<button class="effect-card ${effect} ${game.myEffect === effect ? "chosen" : ""}" data-effect="${effect}" ${game.myEffect ? "disabled" : ""}><span>${effect === "bull" ? "↗" : "↘"}</span><strong>${effect === "bull" ? "利好消息" : "利空消息"}</strong><small>${effect === "bull" ? "支持下一轮上涨" : "推动下一轮下跌"}${game.myOffer[0] === game.myOffer[1] ? ` · 第${index + 1}张` : ""}</small></button>`).join("");
        document.querySelectorAll("[data-effect]").forEach((button) => button.onclick = () => emitAction("effect", { effect: button.dataset.effect }));
      }
      $("marketWager").min = me.predictionCoins > 0 ? 1 : 0;
      $("marketWager").max = Math.min(3, me.predictionCoins);
      if (me.predictionCoins === 0) $("marketWager").value = 0;
      if (Number($("marketWager").value) > Number($("marketWager").max)) $("marketWager").value = $("marketWager").max;
      $("wagerValue").textContent = $("marketWager").value;
      paintChoices();
    }

    function renderHistory(room) {
      const playerById = Object.fromEntries(room.players.map((player) => [player.id, player]));
      $("marketHistory").innerHTML = room.game.history.length ? room.game.history.map((event) => `<article class="market-round-log"><header><b>第 ${event.round} 轮</b><strong class="${event.change > 0 ? "up" : event.change < 0 ? "down" : "flat"}">${event.priceBefore} → ${event.priceAfter}</strong></header><div class="market-card-result"><span>主牌 ${formatSigned(event.main)}</span><span>消息 ${formatSigned(event.playerEffect)}</span></div><details><summary>查看公开交易</summary>${event.orders.map((order) => `<p><b>${escapeHtml(playerById[order.playerId]?.name || "玩家")}</b><span>${TRADE_NAMES[order.trade]}${order.trade === "hold" ? "" : ` ${order.shares}股`} · 持股 ${order.holding}</span></p>`).join("")}</details></article>`).join("") : `<div class="empty-market-log">尚未开盘<br><small>第一轮结果将在这里公布</small></div>`;
    }

    function renderFinish(room) {
      const finish = $("marketFinish");
      if (room.game.status !== "finished") return finish.classList.add("hidden");
      const winner = room.players.find((player) => player.rank === 1);
      finish.classList.remove("hidden");
      finish.innerHTML = `<div class="finish-ribbon">FINAL CLOSING BELL</div><h2>🏆 ${escapeHtml(winner.name)} 赢得市场</h2><p>最终财富 <strong>${winner.finalWealth}</strong></p><div class="final-formula">现金 ＋ 最终股价 × 持股 ＋ 预测金币 × 50</div>${room.hostId === getMyId() ? `<button id="marketRestart">再开一局 ↻</button>` : `<small>等待房主开启下一局</small>`}`;
      $("marketRestart")?.addEventListener("click", () => socket.emit("game:restart"));
    }

    function render(room) {
      latestRoom = room;
      show("game");
      const game = room.game;
      $("marketTitleBadge").textContent = room.gameInfo.title;
      $("marketCode").textContent = room.code;
      $("marketRound").textContent = game.status === "finished" ? "最终收盘" : `第 ${game.round} / ${game.totalRounds} 轮`;
      const waiting = game.waitingFor.length;
      $("marketPhase").textContent = game.status === "finished" ? "比赛结束" : game.mySubmission ? game.myEffect || game.round === 8 ? `等待其他玩家 · ${waiting}人` : "请选择下轮消息" : "秘密决策中";
      const lastPrice = game.priceHistory.at(-2) ?? game.price;
      const delta = game.price - lastPrice;
      $("marketQuote").className = `market-quote ${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`;
      $("marketQuote").innerHTML = `<strong>${game.price}</strong><span>${delta > 0 ? "▲" : delta < 0 ? "▼" : "●"} ${formatSigned(delta)}</span>`;
      $("revealedCount").textContent = game.revealedMain.length;
      $("marketChart").innerHTML = chartMarkup(game.priceHistory);
      renderPlayers(room);
      renderDecision(room);
      renderHistory(room);
      renderFinish(room);
    }

    paintChoices();
    return {
      prepare(previousRoom) { return { previousEventId: previousRoom?.game?.lastEvent?.id ?? null, wasLobby: Boolean(previousRoom && !previousRoom.game) }; },
      render(room, transition) {
        render(room);
        requestAnimationFrame(animateChart);
        const event = room.game.lastEvent;
        if (event && event.id !== transition.previousEventId) requestAnimationFrame(() => showOpening(event, room.players));
      }
    };
  };
})();
