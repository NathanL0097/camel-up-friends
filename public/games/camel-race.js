(() => {
  const COLORS = ["red", "blue", "green", "yellow", "purple"];
  const ALL_CAMELS = [...COLORS, "black", "white"];
  const BET_VALUES = [5, 3, 3, 2, 1];
  const COLOR_NAMES = { red: "红驼", blue: "蓝驼", green: "绿驼", yellow: "黄驼", purple: "紫驼", black: "黑色疯狂骆驼", white: "白色疯狂骆驼", gray: "疯狂骆驼灰骰" };

  window.GameClientFactories ||= {};
  window.GameClientFactories["camel-race"] = ({ socket, $, show, escapeHtml, getMyId, copyInvite }) => {
    let feedbackTimer = null;
    let resultTimer = null;
    const emitAction = (action, payload = {}) => socket.emit("game:action", { action, payload });

    $("gameMount").innerHTML = `<div class="game-head"><div><div class="eyebrow"><span id="gameTitleBadge">好友桌游</span> · 房间 <span id="gameCode"></span></div><h2 id="legTitle">第 1 赛段</h2></div><div id="turnBadge" class="turn-badge"></div><div class="game-head-actions"><button id="gameRulesButton" class="ghost-button rules-shortcut">📖 规则速查</button><button id="gameCopyButton" class="ghost-button">邀请好友</button></div></div><div class="game-layout"><aside class="panel players-panel"><h3>探险队</h3><div id="playerList"></div></aside><section class="board-wrap"><div id="finishBanner" class="finish-banner hidden"></div><div id="track" class="track"></div><div id="diceZone" class="dice-zone"><span>金字塔内剩余</span><div id="diceLeft"></div></div><div id="actions" class="actions paper"><button id="rollButton" class="roll-button"><span class="die">◆</span><span><strong>掷金字塔骰子</strong><small>获得 1 金币并结束回合</small></span></button><div class="action-block bet-action"><strong>赛段投注牌</strong><small class="action-hint">越早下注 · 奖励越高</small><div id="betButtons" class="color-buttons"></div></div><div class="action-block tile-action"><strong>赛道板块</strong><small class="action-hint">选择格数与正反面</small><div class="tile-controls"><input id="tileSpace" type="number" min="2" max="15" value="8"><button data-tile="oasis">🌴 绿洲 +1</button><button data-tile="mirage">🌀 幻境 −1</button></div></div><div class="action-block prediction"><strong>秘密终局预测</strong><small class="action-hint">仅你可见 · 消耗行动</small><div><select id="predictionColor"></select><button data-predict="winner">冠军</button><button data-predict="loser">末名</button></div><div id="predictionCards" class="prediction-cards"></div></div></div><div id="partnershipAction" class="partnership-dock hidden"><div><strong>🤝 本赛段结盟</strong><small id="partnershipStatus">仅限6人以上游戏</small></div><div class="partnership-controls"><select id="partnershipPlayer"></select><button id="partnershipButton">结盟并结束回合</button></div></div></section><aside class="panel log-panel"><h3>赛况播报</h3><div id="gameLog"></div></aside></div>`;
    $("rulesContent").innerHTML = `<div class="eyebrow">比赛中随时查看</div><h2>沙漠驼队竞速 · 规则速查</h2><ol><li><strong>轮到你时选一个行动：</strong>掷骰子、拿一张赛段投注牌、放置自己的赛道板块、提交一次秘密终局预测；6人以上还可选择结盟。每项都会结束你的回合。</li><li><strong>骆驼会叠在一起：</strong>下方骆驼移动时，会带走它上面的所有骆驼；同格最上面的骆驼领先。</li><li><strong>骰子与疯狂骆驼：</strong>每赛段从5颗彩色骰和1颗灰骰中抽5颗。跑道中央五格骰盘会显示已使用骰子，第5颗放入后赛段立刻结束。灰骰让黑/白骆驼逆向移动，它们可能驮着彩色骆驼后退，但不参与名次。</li><li><strong>赛段投注：</strong>每匹骆驼有5、3、3、2、1金币牌，越早拿收益越高。赛段结束时猜中第一获得牌面金币，猜中第二获得1金币，其余扣1。</li><li><strong>财富保密：</strong>你可以看到自己的金币，但其他玩家的金币不公开。每赛段结束只匿名公布当前最高和最低财富；比赛结束后才公开所有人的金币与排名。</li><li><strong>赛道板块：</strong>放在第2–15格的空位，不能与其他板块相邻。绿洲使驼队前进1格，幻境使其后退1格；触发时板块主人获得1金币。</li><li><strong>秘密终局预测：</strong>只能在自己的回合提交且算作一次行动。每位玩家的每种颜色卡只能使用一次，可放入冠军或末名。正确预测按提交先后奖励8、5、3、2、1金币，错误扣1。</li><li><strong>结盟（6–8人）：</strong>结盟会消耗一次行动，双方本赛段内不能再与别人结盟且对方不能拒绝。赛段结算时，双方各自复制伙伴一张收益最高的赛段投注牌或金字塔牌；没有正收益可以不复制，结算后自动解除。</li><li><strong>比赛结束：</strong>任一骆驼越过第16格立刻结算，总金币最多的玩家获胜。</li></ol><p class="rules-note">这是采用原创界面与简化好友房规则的私人技术演示，不作为正式商业发行版本。</p>`;

    $("rollButton").onclick = () => emitAction("roll");
    document.querySelectorAll("[data-tile]").forEach((button) => button.onclick = () => emitAction("tile", { space: $("tileSpace").value, type: button.dataset.tile }));
    document.querySelectorAll("[data-predict]").forEach((button) => button.onclick = () => emitAction("predict", { color: $("predictionColor").value, type: button.dataset.predict }));
    $("partnershipButton").onclick = () => emitAction("partner", { partnerId: $("partnershipPlayer").value });
    $("gameRulesButton").onclick = () => $("rulesDialog").showModal();
    $("gameCopyButton").onclick = copyInvite;

    function renderGame(room) {
      const myId = getMyId();
      show("game");
      const game = room.game;
      const current = room.players[game.turn % room.players.length];
      const myTurn = current?.id === myId && game.status === "playing";
      const revealWealth = game.status === "finished";
      const displayedPlayers = revealWealth ? room.players.slice().sort((a, b) => b.coins - a.coins) : room.players;
      $("gameTitleBadge").textContent = room.gameInfo?.title || "好友桌游";
      $("gameCode").textContent = room.code;
      $("legTitle").textContent = game.status === "finished" ? "比赛结束" : `第 ${game.leg} 赛段`;
      $("turnBadge").textContent = game.status === "finished" ? "已完成" : myTurn ? "轮到你行动" : `等待 ${current.name}`;
      $("playerList").innerHTML = displayedPlayers.map((player, index) => {
        const isMe = player.id === myId;
        const partnership = game.partnerships?.find((item) => item.players.includes(player.id));
        const partnerId = partnership?.players.find((id) => id !== player.id);
        const partner = room.players.find((item) => item.id === partnerId);
        return `<div class="player-card ${player.id === current?.id && game.status === "playing" ? "active" : ""} ${revealWealth ? "wealth-revealed" : ""} ${partner ? "partnered" : ""}"><div class="player-line"><span>${revealWealth ? `<b class="wealth-rank">#${index + 1}</b>` : ""}${isMe ? "你 · " : ""}${escapeHtml(player.name)}</span><span>${revealWealth || isMe ? `${player.coins} 🪙` : "🔒 保密"}</span></div><div class="player-status">${player.connected ? "在线" : "暂时离线"}${player.id === room.hostId ? " · 房主" : ""}${revealWealth ? " · 最终财富" : isMe ? " · 仅你可见" : " · 财富未公开"}${partner ? ` · 🤝 ${escapeHtml(partner.name)}` : ""}</div></div>`;
      }).join("");
      renderTrack(game, room);
      $("diceLeft").innerHTML = game.dice.map((color) => `<i class="mini-die ${color}" title="${COLOR_NAMES[color]}">${color === "gray" ? "↶" : ""}</i>`).join("");
      $("gameLog").innerHTML = game.log.slice(0, 30).map((line) => `<div class="log-item">${translateLog(escapeHtml(line))}</div>`).join("");
      $("rollButton").disabled = !myTurn;
      $("betButtons").innerHTML = COLORS.map((color) => {
        const remaining = game.bets[color]?.length || 0;
        const taken = BET_VALUES.length - remaining;
        return `<button class="bet-stack ${color}" data-color="${color}" aria-label="投注${COLOR_NAMES[color]}，下一张 ${game.bets[color]?.[0] || 0} 金币" ${!myTurn || !remaining ? "disabled" : ""}><span class="bet-camel"><i class="dot ${color}"></i>${COLOR_NAMES[color]}</span><span class="bet-values">${BET_VALUES.map((value, index) => `<b class="${index < taken ? "taken" : ""}">${index < taken ? "×" : value}</b>`).join("")}</span></button>`;
      }).join("");
      document.querySelectorAll("[data-color]").forEach((button) => button.onclick = () => emitAction("bet", { color: button.dataset.color }));
      document.querySelectorAll("[data-tile]").forEach((button) => button.disabled = !myTurn);
      const mine = game.predictions.filter((item) => item.playerId === myId && !item.secret);
      const usedColors = mine.map((item) => item.color);
      const colorsLeft = COLORS.filter((color) => !usedColors.includes(color));
      $("predictionColor").innerHTML = COLORS.map((color) => `<option value="${color}" ${usedColors.includes(color) ? "disabled" : ""}>${COLOR_NAMES[color]}${usedColors.includes(color) ? " · 已使用" : ""}</option>`).join("");
      if (colorsLeft.length) $("predictionColor").value = colorsLeft[0];
      $("predictionColor").disabled = !myTurn || !colorsLeft.length;
      document.querySelectorAll("[data-predict]").forEach((button) => button.disabled = !myTurn || !colorsLeft.length);
      $("predictionCards").innerHTML = mine.length ? mine.map((item) => `<span class="prediction-card ${item.color}"><i class="dot ${item.color}"></i>${COLOR_NAMES[item.color]} · ${item.type === "winner" ? "冠军" : "末名"}</span>`).join("") : `<small>每种颜色卡只能使用一次；还可使用 ${colorsLeft.length} 张</small>`;
      const partnershipEnabled = room.players.length >= 6 && game.status === "playing";
      $("partnershipAction").classList.toggle("hidden", !partnershipEnabled);
      if (partnershipEnabled) {
        const myPartnership = game.partnerships?.find((item) => item.players.includes(myId));
        const myPartnerId = myPartnership?.players.find((id) => id !== myId);
        const myPartner = room.players.find((player) => player.id === myPartnerId);
        const partneredIds = new Set((game.partnerships || []).flatMap((item) => item.players));
        const availablePartners = room.players.filter((player) => player.id !== myId && !partneredIds.has(player.id));
        $("partnershipPlayer").innerHTML = availablePartners.map((player) => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join("");
        $("partnershipPlayer").disabled = !myTurn || Boolean(myPartner) || !availablePartners.length;
        $("partnershipButton").disabled = !myTurn || Boolean(myPartner) || !availablePartners.length;
        $("partnershipStatus").textContent = myPartner ? `本赛段伙伴：${myPartner.name}` : availablePartners.length ? "结盟消耗本回合行动；对方不能拒绝" : "当前没有可结盟的玩家";
      }
      if (game.status === "finished") {
        const best = room.players.slice().sort((a, b) => b.coins - a.coins)[0];
        $("finishBanner").classList.remove("hidden");
        $("finishBanner").innerHTML = `${COLOR_NAMES[game.winner]}率先冲线 · <strong>${escapeHtml(best.name)}</strong> 以 ${best.coins} 金币赢得本局！${room.hostId === myId ? `<button id="restartButton" class="restart-button">再来一局 ↻</button>` : `<small>等待房主开启下一局</small>`}`;
        $("restartButton")?.addEventListener("click", () => socket.emit("game:restart"));
      } else $("finishBanner").classList.add("hidden");
    }

    function renderTrack(game, room) {
      const track = $("track");
      const floatingControls = [$("diceZone"), $("actions")].filter(Boolean);
      const tiles = Object.fromEntries(game.tiles.map((tile) => [tile.space, tile]));
      const leader = getLeader(game);
      let html = `<div class="sun-disc"><i></i></div><div class="dune-lines"><i></i><i></i><i></i></div><div class="oasis-water"><i></i><b></b></div><div class="desert-center"><div class="pyramid">△</div><strong>撒哈拉竞速场</strong><small>疯狂骆驼会逆向奔跑</small></div><div id="usedDiceTray" class="used-dice-tray">${usedDiceMarkup(game.usedDice || [])}</div><div id="rollFeedback" class="roll-feedback"><div class="roll-die"><span></span></div><div class="roll-copy"></div></div><div id="startAnnouncement" class="start-announcement"><strong>起跑位置抽签</strong><small>骆驼正在进入随机起跑位…</small></div><div class="palm-real palm-a"><i class="trunk"></i><span class="fronds"><b></b><b></b><b></b><b></b><b></b><b></b></span></div><div class="palm-real palm-b"><i class="trunk"></i><span class="fronds"><b></b><b></b><b></b><b></b><b></b><b></b></span></div><div class="desert-tent"><i></i><b></b></div><div class="cactus-real"><i></i><b></b><em></em></div><div class="desert-rocks rocks-a"><i></i><b></b><em></em></div><div class="desert-rocks rocks-b"><i></i><b></b></div><div class="desert-shrub shrub-a"></div><div class="desert-shrub shrub-b"></div>`;
      for (let space = 1; space <= 16; space += 1) {
        const stack = game.stacks[space] || [];
        const tile = tiles[space];
        const owner = room.players.find((player) => player.id === tile?.playerId);
        const ownerIndex = room.players.findIndex((player) => player.id === tile?.playerId);
        const angle = (130 + (space - 1) * 22.5) * Math.PI / 180;
        const left = 50 + 43 * Math.cos(angle);
        const top = 50 + 40 * Math.sin(angle);
        html += `<div class="space ${space === 16 ? "finish" : ""}" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%"><span class="space-number">${space}${space === 16 ? " · 终点" : ""}</span>${tile ? `<span class="track-tile ${tile.type}" style="--owner-color:${playerMarkerColor(ownerIndex)}" title="${escapeHtml(owner?.name || "玩家")}的${tile.type === "oasis" ? "绿洲" : "幻境"}"><b>${tile.type === "oasis" ? "+1" : "−1"}</b><em>${escapeHtml((owner?.name || "玩").slice(0, 1))}</em></span>` : ""}<div class="camel-stack">${stack.map((color, stackIndex) => camelMarkup(color, color === leader, stackIndex)).join("")}</div></div>`;
      }
      track.innerHTML = html;
      floatingControls.forEach((control) => track.appendChild(control));
    }

    function getLeader(game) {
      return COLORS.slice().sort((a, b) => {
        const distance = game.camels[b].space - game.camels[a].space;
        if (distance) return distance;
        const stack = game.stacks[game.camels[a].space] || [];
        return stack.indexOf(b) - stack.indexOf(a);
      })[0];
    }

    function camelMarkup(color, isLeader, stackIndex) {
      const crazy = color === "black" || color === "white";
      return `<div class="camel ${color} ${crazy ? "crazy" : ""} ${isLeader ? "race-leader" : ""}" style="--stack-level:${stackIndex + 1}" data-camel="${color}" title="${COLOR_NAMES[color]}"><span class="camel-shadow"></span><span class="camel-body"><i class="camel-hump hump-one"></i><i class="camel-hump hump-two"></i><i class="camel-neck"></i><i class="camel-head"><b></b></i><i class="camel-saddle"></i><i class="camel-tail"></i></span><span class="camel-legs"><i></i><i></i><i></i><i></i></span><span class="camel-dust"><i></i><i></i><i></i></span>${crazy ? `<span class="crazy-direction">↶</span>` : ""}</div>`;
    }

    function usedDiceMarkup(usedDice) {
      const slots = Array.from({ length: 5 }, (_, index) => {
        const used = usedDice[index];
        return used ? `<i class="used-die ${used.die}" title="${COLOR_NAMES[used.die]} · ${used.amount}点"><b>${used.amount}</b></i>` : `<i class="used-die empty"><b>${index + 1}</b></i>`;
      }).join("");
      return `<span><strong>本赛段已使用</strong><small>${usedDice.length} / 5 · 放满即结算</small></span><div>${slots}</div>`;
    }

    function renderUsedDice(usedDice) {
      const tray = $("usedDiceTray");
      if (tray) tray.innerHTML = usedDiceMarkup(usedDice);
    }

    function translateLog(line) { return ALL_CAMELS.reduce((text, color) => text.replaceAll(color, COLOR_NAMES[color]), line); }
    function playerMarkerColor(index) { return ["#e4573f", "#3186ad", "#7c57a5", "#378a5b", "#d08b25", "#b84578", "#49616f", "#73542f"][Math.max(0, index) % 8]; }
    function captureCamelRects() {
      const trackRect = $("track")?.getBoundingClientRect();
      if (!trackRect) return {};
      return Object.fromEntries([...document.querySelectorAll("[data-camel]")].map((camel) => {
        const rect = camel.getBoundingClientRect();
        return [camel.dataset.camel, { left: rect.left - trackRect.left, top: rect.top - trackRect.top }];
      }));
    }
    function animateCamelMove(previousRects, event) {
      const trackRect = $("track")?.getBoundingClientRect();
      if (!trackRect) return;
      Object.keys(previousRects).forEach((color) => {
        const camel = document.querySelector(`[data-camel="${color}"]`);
        const before = previousRects[color];
        if (!camel || !before) return;
        const after = camel.getBoundingClientRect();
        const dx = before.left - (after.left - trackRect.left);
        const dy = before.top - (after.top - trackRect.top);
        if (Math.hypot(dx, dy) < 1) return;
        const visualScale = after.width / camel.offsetWidth || 1;
        const tx = dx / visualScale;
        const ty = dy / visualScale;
        const movingIndex = event.moving.indexOf(color);
        const isMoving = movingIndex >= 0;
        const directionTilt = event.direction > 0 ? 1 : -1;
        const keyframes = isMoving ? [
          { transform: `translate(${tx}px, ${ty}px) rotate(0deg) scale(1)`, zIndex: 20 },
          { transform: `translate(${tx * .78}px, ${ty * .78 - 18}px) rotate(${5 * directionTilt}deg) scale(1.06,.94)`, zIndex: 20, offset: .24 },
          { transform: `translate(${tx * .52}px, ${ty * .52 + 2}px) rotate(${-3 * directionTilt}deg) scale(.96,1.05)`, zIndex: 20, offset: .48 },
          { transform: `translate(${tx * .25}px, ${ty * .25 - 22}px) rotate(${4 * directionTilt}deg) scale(1.05,.95)`, zIndex: 20, offset: .72 },
          { transform: "translate(0, 0) rotate(0deg) scale(.98,1.06)", zIndex: 20, offset: .92 },
          { transform: "translate(0, 0) rotate(0deg) scale(1)", zIndex: 20 }
        ] : [{ transform: `translate(${tx}px, ${ty}px)` }, { transform: "translate(0, 0)" }];
        if (isMoving) camel.classList.add("is-running");
        const animation = camel.animate(keyframes, { duration: isMoving ? 1380 : 720, delay: 900 + Math.max(0, movingIndex) * 55, easing: "cubic-bezier(.2,.72,.22,1)", fill: "backwards" });
        animation.finished.then(() => camel.classList.remove("is-running"), () => camel.classList.remove("is-running"));
      });
    }
    function showRollFeedback(event) {
      const feedback = $("rollFeedback");
      if (!feedback) return;
      clearTimeout(feedbackTimer); clearTimeout(resultTimer);
      const die = feedback.querySelector(".roll-die");
      die.className = `roll-die ${event.die}`;
      die.querySelector("span").textContent = event.amount;
      const rolledName = event.die === "gray" ? `${COLOR_NAMES[event.color]}（灰骰）` : COLOR_NAMES[event.color];
      feedback.querySelector(".roll-copy").innerHTML = `<strong>${escapeHtml(event.playerName)} 掷出了 ${event.amount} 点</strong><small>${rolledName}${event.direction < 0 ? " · 逆向移动" : " · 向前移动"}</small>`;
      feedback.className = "roll-feedback";
      if (event.legEnd?.usedDice) renderUsedDice(event.legEnd.usedDice);
      void feedback.offsetWidth;
      feedback.classList.add("showing");
      feedbackTimer = setTimeout(() => feedback.classList.remove("showing"), event.legEnd ? 2050 : 2200);
      if (event.legEnd) resultTimer = setTimeout(() => showLegWinner(event.legEnd), 2150);
    }
    function animateStartingPositions() {
      const track = $("track");
      const announcement = $("startAnnouncement");
      if (!track || !announcement) return;
      announcement.classList.add("showing");
      const trackRect = track.getBoundingClientRect();
      const centerX = trackRect.left + trackRect.width / 2;
      const centerY = trackRect.top + trackRect.height / 2;
      [...document.querySelectorAll("[data-camel]")].forEach((camel, index) => {
        const target = camel.getBoundingClientRect();
        const dx = centerX - (target.left + target.width / 2);
        const dy = centerY - (target.top + target.height / 2);
        camel.animate([{ transform: `translate(${dx}px, ${dy}px) scale(.35) rotate(-12deg)`, opacity: 0 }, { transform: `translate(${dx * .25}px, ${dy * .25 - 25}px) scale(1.08) rotate(4deg)`, opacity: 1, offset: .72 }, { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 }], { duration: 1050, delay: 500 + index * 240, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" });
      });
      setTimeout(() => announcement.classList.remove("showing"), 2900);
    }
    function showLegWinner(result) {
      const feedback = $("rollFeedback");
      const winner = document.querySelector(`[data-camel="${result.first}"]`);
      if (!feedback) return;
      feedback.querySelector(".roll-die").className = `roll-die winner-medal ${result.first}`;
      feedback.querySelector(".roll-die span").textContent = "★";
      feedback.querySelector(".roll-copy").innerHTML = `<strong>第 ${result.leg} 赛段结束 · ${COLOR_NAMES[result.first]} 领跑</strong><small class="wealth-announcement"><span>财富榜首 <b>${result.wealth.highest}</b> 金币</span><i></i><span>财富榜尾 <b>${result.wealth.lowest}</b> 金币</span></small><em class="anonymous-note">身份保密 · 只公布财富区间</em>`;
      feedback.className = "roll-feedback leg-result showing";
      winner?.classList.add("leg-winner");
      feedbackTimer = setTimeout(() => {
        feedback.classList.remove("showing");
        winner?.classList.remove("leg-winner");
        if (result.usedDice?.length === 5) renderUsedDice([]);
      }, 4500);
    }

    return {
      prepare(previousRoom) {
        const hadGame = Boolean(previousRoom?.game);
        return { hadGame, wasLobby: Boolean(previousRoom && !previousRoom.game), previousEventId: previousRoom?.game?.lastEvent?.id ?? null, previousRects: hadGame ? captureCamelRects() : {} };
      },
      render(room, transition) {
        renderGame(room);
        const event = room.game?.lastEvent;
        if (transition.hadGame && event?.type === "roll" && event.id !== transition.previousEventId) requestAnimationFrame(() => {
          animateCamelMove(transition.previousRects, event);
          showRollFeedback(event);
        });
        if (transition.wasLobby && room.game) requestAnimationFrame(animateStartingPositions);
      }
    };
  };
})();
