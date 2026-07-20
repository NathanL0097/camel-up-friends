(() => {
  const COLORS = ["#172b2b", "#ffffff", "#ef5350", "#ff9f43", "#f5c842", "#39a96b", "#3498db", "#845ec2", "#e35d9f"];

  window.GameClientFactories ||= {};
  window.GameClientFactories["draw-and-guess"] = ({ socket, $, show, escapeHtml, getMyId, copyInvite }) => {
    let roomState = null;
    let brushColor = COLORS[0];
    let brushWidth = 6;
    let tool = "brush";
    let drawing = false;
    let strokeId = null;
    let queuedPoints = [];
    let lastPoint = null;
    let lastSend = 0;
    const emitAction = (action, payload = {}) => socket.emit("game:action", { action, payload });

    $("gameMount").innerHTML = `<div class="draw-game"><div class="game-head draw-head"><div><div class="eyebrow">创意派对 · 房间 <span id="drawCode"></span></div><h2>你画我猜</h2></div><div id="drawPhase" class="draw-phase"></div><div class="game-head-actions"><button id="drawRulesButton" class="ghost-button rules-shortcut">📖 规则</button><button id="drawCopyButton" class="ghost-button">邀请好友</button></div></div><div class="draw-layout"><aside class="draw-panel draw-players"><div class="draw-panel-title"><span>🏆 积分榜</span><small id="drawTurnLabel"></small></div><div id="drawPlayerList"></div></aside><main class="draw-stage"><div class="draw-word-bar"><div><small id="drawWordKicker">等待画家选词</small><strong id="drawWordHint">准备好你的脑洞</strong></div><div id="drawTimer" class="draw-timer">--</div></div><div class="canvas-card"><div id="drawToolbar" class="draw-toolbar"><div id="drawColors" class="draw-colors"></div><button id="brushTool" class="tool-button selected">✏️ 画笔</button><button id="eraserTool" class="tool-button">◻︎ 橡皮</button><label>粗细 <input id="brushWidth" type="range" min="2" max="24" value="6"></label><button id="undoDraw" class="tool-button">↶ 撤销</button><button id="clearDraw" class="tool-button danger">清空</button></div><div id="canvasWrap" class="canvas-wrap"><canvas id="drawingCanvas"></canvas><div id="canvasNotice" class="canvas-notice hidden"></div><div id="wordChoice" class="word-choice hidden"></div><div id="roundReveal" class="round-reveal hidden"></div></div></div></main><aside class="draw-panel guess-panel"><div class="draw-panel-title"><span>💬 猜词区</span><small>答案不会公开</small></div><div id="guessMessages" class="guess-messages"></div><div class="guess-compose"><input id="guessInput" maxlength="40" placeholder="输入你的答案…"><button id="guessButton">发送</button></div></aside></div><div id="drawFinish" class="draw-finish hidden"></div></div>`;

    $("rulesContent").innerHTML = `<div class="eyebrow">轻松上手</div><h2>你画我猜 · 规则</h2><ol><li><strong>轮流作画：</strong>每位玩家会担任两次画家，游戏自动决定顺序。</li><li><strong>秘密选词：</strong>画家从三个词中选择一个，其他玩家只能看到类别、字数和提示。</li><li><strong>限时75秒：</strong>画家只能用画板表达，不能在聊天中透露答案。时间过半会揭示第一个字。</li><li><strong>实时猜词：</strong>错误答案会出现在聊天中；正确答案不会泄露，只会显示“猜中了”。</li><li><strong>计分：</strong>猜得越早分数越高；每有一位玩家猜中，画家也获得40分。</li><li><strong>提前结束：</strong>所有在线猜题玩家都猜中后，本轮立即公布答案。</li><li><strong>最终胜利：</strong>所有人完成两次作画后，总分最高者获胜。</li></ol>`;

    $("drawRulesButton").onclick = () => $("rulesDialog").showModal();
    $("drawCopyButton").onclick = copyInvite;
    $("guessButton").onclick = sendGuess;
    $("guessInput").addEventListener("keydown", (event) => { if (event.key === "Enter") sendGuess(); });
    $("brushTool").onclick = () => setTool("brush");
    $("eraserTool").onclick = () => setTool("eraser");
    $("brushWidth").oninput = (event) => { brushWidth = Number(event.target.value); };
    $("undoDraw").onclick = () => emitAction("undo");
    $("clearDraw").onclick = () => emitAction("clear");

    $("drawColors").innerHTML = COLORS.map((color) => `<button class="draw-color ${color === brushColor ? "selected" : ""}" data-draw-color="${color}" style="--swatch:${color}" aria-label="选择颜色 ${color}"></button>`).join("");
    document.querySelectorAll("[data-draw-color]").forEach((button) => button.onclick = () => {
      brushColor = button.dataset.drawColor;
      tool = "brush";
      document.querySelectorAll("[data-draw-color]").forEach((item) => item.classList.toggle("selected", item === button));
      updateToolButtons();
    });

    const canvas = $("drawingCanvas");
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);

    function setTool(next) {
      tool = next;
      updateToolButtons();
    }

    function updateToolButtons() {
      $("brushTool").classList.toggle("selected", tool === "brush");
      $("eraserTool").classList.toggle("selected", tool === "eraser");
    }

    function canDraw() {
      return roomState?.game?.status === "playing" && roomState.game.phase === "drawing" && roomState.game.artistId === getMyId();
    }

    function canvasPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
    }

    function pointerDown(event) {
      if (!canDraw()) return;
      drawing = true;
      strokeId = `${getMyId().slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      queuedPoints = [canvasPoint(event)];
      lastPoint = queuedPoints[0];
      canvas.setPointerCapture(event.pointerId);
      flushStroke();
    }

    function pointerMove(event) {
      if (!drawing || !canDraw()) return;
      const point = canvasPoint(event);
      drawLocalSegment(lastPoint, point);
      lastPoint = point;
      queuedPoints.push(point);
      if (Date.now() - lastSend >= 35) flushStroke();
    }

    function pointerUp(event) {
      if (!drawing) return;
      queuedPoints.push(canvasPoint(event));
      flushStroke();
      drawing = false;
      lastPoint = null;
    }

    function flushStroke() {
      if (!queuedPoints.length || !strokeId) return;
      emitAction("draw", { strokeId, color: brushColor, width: brushWidth, tool, points: queuedPoints.splice(0) });
      lastSend = Date.now();
    }

    function setupCanvas() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const context = canvas.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { context, width: rect.width, height: rect.height };
    }

    function renderCanvas(strokes = []) {
      const { context, width, height } = setupCanvas();
      context.clearRect(0, 0, width, height);
      strokes.forEach((stroke) => drawStroke(context, stroke, width, height));
    }

    function drawStroke(context, stroke, width, height) {
      if (!stroke.points?.length) return;
      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = stroke.width;
      context.strokeStyle = stroke.color;
      context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      context.beginPath();
      context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
      if (stroke.points.length === 1) context.lineTo(stroke.points[0].x * width + .1, stroke.points[0].y * height + .1);
      else stroke.points.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height));
      context.stroke();
      context.restore();
    }

    function drawLocalSegment(from, to) {
      if (!from || !to) return;
      const rect = canvas.getBoundingClientRect();
      const context = canvas.getContext("2d");
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      context.save();
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = brushWidth;
      context.strokeStyle = brushColor;
      context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      context.beginPath(); context.moveTo(from.x * rect.width, from.y * rect.height); context.lineTo(to.x * rect.width, to.y * rect.height); context.stroke();
      context.restore();
    }

    function sendGuess() {
      const text = $("guessInput").value.trim();
      if (!text) return;
      emitAction("guess", { text });
      $("guessInput").value = "";
    }

    function render(room) {
      roomState = room;
      show("game");
      const game = room.game;
      const myId = getMyId();
      const artist = room.players.find((player) => player.id === game.artistId);
      const guessedIds = new Set(game.guesses.filter((guess) => guess.correct).map((guess) => guess.playerId));
      $("drawCode").textContent = room.code;
      $("drawTurnLabel").textContent = `第 ${Math.min(game.turnNumber, game.totalTurns)} / ${game.totalTurns} 轮`;
      $("drawPlayerList").innerHTML = room.players.slice().sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, index) => `<div class="draw-player ${player.id === game.artistId ? "artist" : ""} ${guessedIds.has(player.id) ? "guessed" : ""}"><b>${index + 1}</b><div><strong>${escapeHtml(player.name)}${player.id === myId ? "（你）" : ""}</strong><small>${player.id === game.artistId ? "🎨 本轮画家" : guessedIds.has(player.id) ? "✨ 已猜中" : player.connected ? "正在思考" : "暂时离线"}</small></div><span>${player.score || 0}</span></div>`).join("");

      const phaseNames = { choosing: "画家选词", drawing: "正在作画", reveal: "答案揭晓", finished: "游戏结束" };
      $("drawPhase").textContent = phaseNames[game.phase] || "准备中";
      if (game.phase === "choosing") {
        $("drawWordKicker").textContent = game.isArtist ? "从三个词中选择一个" : `等待 ${artist?.name || "画家"} 选词`;
        $("drawWordHint").textContent = game.isArtist ? "你的选择只有自己能看到" : "题目即将揭晓";
      } else if (game.phase === "drawing") {
        $("drawWordKicker").textContent = game.isArtist ? `你的题目 · ${game.category}` : `${game.category} · ${game.word?.length || game.hint?.replaceAll(" ", "").length || "?"} 个字`;
        $("drawWordHint").textContent = game.isArtist ? game.word : game.hint;
      } else if (game.lastResult) {
        $("drawWordKicker").textContent = `${game.lastResult.category} · 本轮答案`;
        $("drawWordHint").textContent = game.lastResult.word;
      }

      const choosingMine = game.phase === "choosing" && game.isArtist;
      $("wordChoice").classList.toggle("hidden", !choosingMine);
      if (choosingMine) {
        $("wordChoice").innerHTML = `<small>选择你最想画的题目</small><div>${game.wordChoices.map((choice) => `<button data-word="${escapeHtml(choice.word)}"><span>${escapeHtml(choice.category)}</span><strong>${escapeHtml(choice.word)}</strong></button>`).join("")}</div>`;
        document.querySelectorAll("[data-word]").forEach((button) => button.onclick = () => emitAction("choose", { word: button.dataset.word }));
      }

      const notice = $("canvasNotice");
      const noticeText = game.phase === "choosing" && !game.isArtist ? `🎨 ${artist?.name || "画家"} 正在秘密选词…` : game.phase === "drawing" && !game.isArtist ? `仔细观察 ${artist?.name || "画家"} 的画` : game.phase === "drawing" ? "用画笔表达题目，不能写出答案哦" : "";
      notice.textContent = noticeText;
      notice.classList.toggle("hidden", !noticeText || game.phase === "drawing");
      $("drawToolbar").classList.toggle("disabled", !canDraw());
      [...$("drawToolbar").querySelectorAll("button,input")].forEach((control) => { control.disabled = !canDraw(); });
      canvas.classList.toggle("can-draw", canDraw());

      $("guessMessages").innerHTML = game.messages.length ? game.messages.map((message) => `<div class="guess-message ${message.correct ? "correct" : ""}"><b>${escapeHtml(message.playerName)}</b><span>${message.correct ? "✨ 猜中了！" : escapeHtml(message.text)}</span></div>`).join("") : `<div class="empty-guesses">答案会在这里飞过<br><small>大胆猜，不扣分</small></div>`;
      $("guessMessages").scrollTop = $("guessMessages").scrollHeight;
      const canGuess = game.phase === "drawing" && game.artistId !== myId && !guessedIds.has(myId);
      $("guessInput").disabled = !canGuess;
      $("guessButton").disabled = !canGuess;
      $("guessInput").placeholder = guessedIds.has(myId) ? "你已经猜中了！" : game.artistId === myId ? "画家不能猜词" : "输入你的答案…";

      const reveal = $("roundReveal");
      reveal.classList.toggle("hidden", game.phase !== "reveal");
      if (game.phase === "reveal" && game.lastResult) {
        const result = game.lastResult;
        reveal.innerHTML = `<small>本轮答案</small><strong>${escapeHtml(result.word)}</strong><p>${result.correctPlayers.length ? `${result.correctPlayers.length} 人猜中 · 画家 ${escapeHtml(result.artistName)} 获得 ${result.turnScores[result.artistId] || 0} 分` : "无人猜中 · 这幅画太有灵魂了"}</p><div>${result.correctPlayers.map((player) => `<span>${escapeHtml(player.playerName)} +${player.score}</span>`).join("")}</div>`;
      }

      $("drawFinish").classList.toggle("hidden", game.status !== "finished");
      if (game.status === "finished") {
        const ranked = game.ranking.map((id) => room.players.find((player) => player.id === id)).filter(Boolean);
        $("drawFinish").innerHTML = `<div class="finish-ribbon">创意之王诞生</div><h2>🏆 ${escapeHtml(ranked[0]?.name || "玩家")} 获胜！</h2><div class="draw-final-ranking">${ranked.map((player, index) => `<div><b>#${index + 1}</b><span>${escapeHtml(player.name)}</span><strong>${player.score || 0} 分</strong></div>`).join("")}</div>${room.hostId === myId ? `<button id="drawRestart">再玩一局 ↻</button>` : `<small>等待房主开启下一局</small>`}`;
        $("drawRestart")?.addEventListener("click", () => socket.emit("game:restart"));
      }

      requestAnimationFrame(() => renderCanvas(game.strokes));
      updateCountdown();
    }

    function updateCountdown() {
      const game = roomState?.game;
      if (!game || !game.deadline) { $("drawTimer").textContent = game?.status === "finished" ? "✓" : "--"; return; }
      const seconds = Math.max(0, Math.ceil((game.deadline - Date.now()) / 1000));
      $("drawTimer").textContent = seconds;
      $("drawTimer").classList.toggle("urgent", seconds <= 10);
    }

    setInterval(updateCountdown, 250);
    window.addEventListener("resize", () => roomState?.game && renderCanvas(roomState.game.strokes));

    return {
      prepare(previousRoom) { return { previousPhase: previousRoom?.game?.phase }; },
      render(room) { render(room); }
    };
  };
})();
