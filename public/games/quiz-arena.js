(() => {
  window.GameClientFactories ||= {};
  window.GameClientFactories["quiz-arena"] = ({ socket, $, show, escapeHtml, getMyId, copyInvite }) => {
    const act = (action, payload = {}) => socket.emit("game:action", { action, payload });
    const categories = ["生活常识", "历史", "地理", "科学", "科技", "体育", "影视", "音乐", "游戏", "美食", "文学艺术", "自然动物", "趣味冷知识", "网络文化", "时事政治", "动漫角色"];
    const reactionIcons = { egg: "🥚", tomato: "🍅", question: "❓", applause: "👏" };
    const challengeNames = { truth: "真心话", dare: "大冒险", fun: "欢乐挑战" };
    let latestRoom = null;
    let clockTimer = null;
    let audioContext = null;
    let seenReactionIds = new Set();

    function unlockAudio() { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === "suspended") audioContext.resume(); }
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    function tone(kind) {
      if (!audioContext) return;
      const notes = kind === "correct" ? [523, 659, 784] : kind === "wrong" ? [220, 185, 147] : [660, 880];
      notes.forEach((frequency, index) => {
        const osc = audioContext.createOscillator(), gain = audioContext.createGain(), start = audioContext.currentTime + index * .1;
        osc.type = kind === "wrong" ? "sawtooth" : "sine"; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(.12, start + .02); gain.gain.exponentialRampToValueAtTime(.0001, start + .18);
        osc.connect(gain).connect(audioContext.destination); osc.start(start); osc.stop(start + .2);
      });
    }

    function rules() {
      $("rulesContent").innerHTML = `<div class="eyebrow">知识派对 · 2–6人</div><h2>站神答题王</h2><ol><li><strong>站神模式：</strong>所有玩家按随机顺序循环答题，每人3颗生命和1次跳过。每题20秒；答错或超时失去1颗生命，最后存活者成为站神。</li><li><strong>秘密选项：</strong>所有人都能看到题干，但只有当前玩家能看到选项。答题后公开玩家答案、正确答案与知识解析。</li><li><strong>动漫角色：</strong>出现人物影像时不提供选项，当前答题者必须输入图中角色的完整姓名；常见间隔符号不影响判定。</li><li><strong>传递难题：</strong>跳过不扣生命且不揭晓答案，同一道题交给下一位玩家；下一位如有跳过也能继续传递。</li><li><strong>抢答模式：</strong>题干在8秒内逐字揭示，整题有30秒公共抢答时间。抢到后公共时间暂停，该玩家独享20秒输入时间。</li><li><strong>两次错误：</strong>第一位抢答者答错后，其他玩家可以继续抢；累计两人答错即揭晓。第一位答对7题且仍有生命的玩家获胜。</li><li><strong>捣蛋鬼：</strong>生命归零后可发送鸡蛋、番茄、问号和掌声；每3题共同从三个领域中投票决定下一题。</li><li><strong>赛后：</strong>站神分别为每位失败玩家选择真心话、大冒险或欢乐挑战，每人可以免费刷新一次。</li></ol><p class="rules-note">题库包含3000+道本地题目，并支持服务端在线题包更新；同一场不会重复考察同一个知识点。</p>`;
    }

    function renderLobby(room) {
      rules(); latestRoom = room;
      const mine = room.hostId === getMyId(), settings = room.settings || { mode: "survival", pack: "all", categories };
      $("gameLobbySettings").innerHTML = `<div class="quiz-lobby-settings"><header><span>⚡</span><div><strong>站神赛制设置</strong><small>房主设置后即可开赛</small></div></header><div class="quiz-lobby-row"><label>比赛模式<select id="quizMode" ${mine ? "" : "disabled"}><option value="survival" ${settings.mode === "survival" ? "selected" : ""}>站神模式 · 轮流生存</option><option value="buzzer" ${settings.mode === "buzzer" ? "selected" : ""}>抢答模式 · 率先答对7题</option></select></label><label>题库组合<select id="quizPack" ${mine ? "" : "disabled"}><option value="all" ${settings.pack === "all" ? "selected" : ""}>全领域</option><option value="classic" ${settings.pack === "classic" ? "selected" : ""}>传统知识</option><option value="party" ${settings.pack === "party" ? "selected" : ""}>轻松娱乐</option></select></label></div><div class="quiz-category-select"><b>启用领域</b><div>${categories.map((category) => `<label><input type="checkbox" value="${category}" ${(settings.categories || categories).includes(category) ? "checked" : ""} ${mine ? "" : "disabled"}><span>${category}</span></label>`).join("")}</div></div>${mine ? '<button id="saveQuizSettings">保存答题设置</button>' : `<p>房主已选择：${settings.mode === "buzzer" ? "抢答模式" : "站神模式"}</p>`}<footer><b>3000+</b><span>本地基础题目<small>支持在线题包更新 · 单局知识点不重复</small></span></footer></div>`;
      if (mine) $("saveQuizSettings").onclick = () => {
        const selected = [...document.querySelectorAll(".quiz-category-select input:checked")].map((input) => input.value);
        socket.emit("game:configure", { mode: $("quizMode").value, pack: $("quizPack").value, categories: selected });
      };
      if (mine) $("quizPack").onchange = () => {
        const party = ["网络文化", "影视", "音乐", "游戏", "美食", "动漫角色"], pack = $("quizPack").value;
        document.querySelectorAll(".quiz-category-select input").forEach((input) => { input.checked = pack === "all" || (pack === "party" ? party.includes(input.value) : !party.includes(input.value) && input.value !== "时事政治"); });
      };
    }

    function mount() {
      if ($("quizArena")) return;
      $("gameMount").innerHTML = `<div id="quizArena" class="quiz-arena"><header class="game-head quiz-head"><div><div class="eyebrow">知识竞技场 · 房间 <span id="quizCode"></span></div><h2><span>♛</span> 站神答题王</h2></div><div class="quiz-head-center"><div id="quizModeBadge" class="quiz-mode-badge"></div><strong id="quizRound"></strong></div><div class="game-head-actions"><button id="quizRules" class="ghost-button">📖 规则</button><button id="quizInvite" class="ghost-button">邀请好友</button></div></header><div class="quiz-layout"><main class="quiz-stage"><div class="quiz-starfield"></div><div class="quiz-light-rays"></div><div class="quiz-orbit quiz-orbit-one"></div><div class="quiz-orbit quiz-orbit-two"></div><div class="quiz-arena-core"><i></i><i></i><i></i></div><div id="quizPlayers" class="quiz-player-ring"></div><div id="quizEliminationFx" class="quiz-elimination-layer"></div><div id="quizReactions" class="quiz-reaction-layer"></div><section id="quizQuestionCard" class="quiz-question-card"><div id="quizCategory" class="quiz-category"></div><div id="quizTimer" class="quiz-timer"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"></circle><circle id="quizTimerRing" cx="50" cy="50" r="44"></circle></svg><strong>--</strong><small>SEC</small></div><div id="quizQuestion" class="quiz-question"></div><div id="quizAnswerLength" class="quiz-answer-length"></div><div id="quizControls" class="quiz-controls"></div><div id="quizResult" class="quiz-result"></div></section><section id="quizGhostPanel" class="quiz-ghost-panel"></section><section id="quizFinish" class="quiz-finish"></section></main><aside class="quiz-info"><div class="quiz-info-card"><small>竞技目标</small><strong id="quizGoal"></strong><p id="quizStatus"></p></div><div id="quizAttempts" class="quiz-attempts"></div><div class="quiz-pack-card"><span>知识星图已连接</span><b>3000+</b><small>本场不会重复知识点</small></div></aside></div></div>`;
      $("quizRules").onclick = () => $("rulesDialog").showModal();
      $("quizInvite").onclick = copyInvite;
      rules();
    }

    function clock(deadline, totalSeconds) {
      clearInterval(clockTimer);
      const paint = () => {
        const remain = Math.max(0, deadline - Date.now()), seconds = Math.ceil(remain / 1000), ratio = Math.max(0, Math.min(1, remain / (totalSeconds * 1000)));
        const root = $("quizTimer"); if (!root) return;
        root.querySelector("strong").textContent = seconds; root.classList.toggle("urgent", seconds <= 5);
        $("quizTimerRing").style.strokeDashoffset = String(276.46 * (1 - ratio));
      };
      paint(); clockTimer = setInterval(paint, 200);
    }

    function playerMarkup(room, item, transition = {}) {
      const game = room.game, mine = item.id === getMyId(), active = game.activePlayerId === item.id || game.answererId === item.id;
      const previous = transition.players?.[item.id];
      const lifeHit = previous && previous.lives > item.lives;
      const justEliminated = previous && !previous.eliminated && item.eliminated;
      const cores = Array.from({ length: 3 }, (_, index) => `<i class="${index < item.lives ? "charged" : "broken"}"></i>`).join("");
      return `<article class="quiz-player ${mine ? "mine" : ""} ${active ? "active" : ""} ${item.eliminated ? "ghost" : ""} ${lifeHit ? "life-hit" : ""} ${justEliminated ? "newly-eliminated" : ""}"><div class="quiz-seat-beam"></div><div class="quiz-avatar">${item.eliminated ? "☠" : escapeHtml((item.name || "?").slice(0, 1))}</div><div class="quiz-player-data"><b>${escapeHtml(item.name)}${mine ? "（你）" : ""}</b><small>${item.eliminated ? "捣蛋鬼频道" : `<span class="quiz-life-cores">${cores}</span>`}</small></div><span>${game.mode === "buzzer" ? `${item.correct}/7` : `✓ ${item.correct}`}</span>${game.mode === "survival" && !item.eliminated ? `<em>跳过 ×${item.skips}</em>` : ""}<div class="quiz-seat-platform"></div></article>`;
    }

    function renderControls(room) {
      const game = room.game, me = room.players.find((item) => item.id === getMyId()), question = game.question;
      if (game.phase === "question") {
        if (game.activePlayerId !== getMyId()) return `<div class="quiz-wait"><span>👀</span><b>${escapeHtml(room.players.find((item) => item.id === game.activePlayerId)?.name || "玩家")} 正在作答</b><small>选项只有答题者能够看到</small></div>`;
        if (["fill", "image-fill"].includes(question.kind)) return `<form id="quizAnswerForm" class="quiz-text-answer"><input id="quizAnswerInput" maxlength="60" autocomplete="off" placeholder="${question.kind === "image-fill" ? "输入角色完整姓名…" : "输入诗词答案…"}"><button>提交答案</button>${me.skips ? '<button type="button" id="quizSkip" class="skip">跳过 ×1</button>' : ""}</form>`;
        return `<div class="quiz-options">${question.options.map((option, index) => `<button data-answer="${escapeHtml(option)}"><i>${String.fromCharCode(65 + index)}</i><span>${escapeHtml(option)}</span></button>`).join("")}</div>${me.skips ? '<button id="quizSkip" class="quiz-skip">↷ 跳过并传给下一位</button>' : ""}`;
      }
      if (game.phase === "buzz-open") {
        const attempted = game.attempts.some((attempt) => attempt.playerId === getMyId());
        return me.eliminated ? '<div class="quiz-wait"><span>👻</span><b>你已成为捣蛋鬼</b><small>可以发送表情为朋友增加气氛</small></div>' : attempted ? '<div class="quiz-wait"><span>⏳</span><b>你已回答过本题</b><small>等待其他玩家抢答</small></div>' : '<button id="quizBuzz" class="quiz-buzz"><span>⚡</span><b>抢答</b><small>按下后独享20秒输入</small></button>';
      }
      if (game.phase === "buzz-answer") {
        if (game.answererId !== getMyId()) return `<div class="quiz-wait"><span>⚡</span><b>${escapeHtml(room.players.find((item) => item.id === game.answererId)?.name || "玩家")} 抢到了</b><small>公共30秒已经暂停</small></div>`;
        return '<form id="quizAnswerForm" class="quiz-text-answer buzzer"><input id="quizAnswerInput" maxlength="80" autocomplete="off" placeholder="输入答案…"><button>确认提交</button></form>';
      }
      if (game.phase === "category-vote") return '<div class="quiz-wait"><span>👻</span><b>捣蛋鬼正在决定下一题领域</b></div>';
      return "";
    }

    function bindControls(room) {
      document.querySelectorAll("[data-answer]").forEach((button) => button.onclick = () => act("answer", { answer: button.dataset.answer }));
      const form = $("quizAnswerForm"); if (form) form.onsubmit = (event) => { event.preventDefault(); const input = $("quizAnswerInput"); if (input.value.trim()) act("answer", { answer: input.value.trim() }); };
      const skip = $("quizSkip"); if (skip) skip.onclick = () => act("skip");
      const buzz = $("quizBuzz"); if (buzz) buzz.onclick = () => { unlockAudio(); tone("buzz"); act("buzz"); };
      document.querySelectorAll("[data-ghost-reaction]").forEach((button) => button.onclick = () => act("react", { type: button.dataset.ghostReaction }));
      document.querySelectorAll("[data-category-vote]").forEach((button) => button.onclick = () => act("vote", { category: button.dataset.categoryVote }));
      document.querySelectorAll("[data-challenge-target]").forEach((button) => button.onclick = () => act("challenge", { targetId: button.dataset.challengeTarget, type: button.dataset.challengeType }));
      const reroll = $("rerollMyChallenge"); if (reroll) reroll.onclick = () => act("reroll-challenge");
      const complete = $("completeMyChallenge"); if (complete) complete.onclick = () => act("complete-challenge");
      const restart = $("restartQuiz"); if (restart) restart.onclick = () => socket.emit("game:restart");
      $("quizAnswerInput")?.focus();
    }

    function resultMarkup(room) {
      const game = room.game, result = game.result;
      if (!result || game.phase !== "result") return "";
      const name = result.playerId ? room.players.find((item) => item.id === result.playerId)?.name : "全场";
      return `<div class="quiz-result-card ${result.correct ? "correct" : "wrong"}"><span>${result.correct ? "✓" : "✕"}</span><small>${escapeHtml(name || "玩家")} · ${result.correct ? "回答正确" : result.reason === "no-buzz" ? "无人抢答" : "回答错误"}</small><h3>${escapeHtml(result.value || "未作答")}</h3><div>正确答案 <b>${escapeHtml(result.answer)}</b></div><p>${escapeHtml(result.explanation || "")}</p></div>`;
    }

    function ghostMarkup(room) {
      const game = room.game, me = room.players.find((item) => item.id === getMyId());
      if (game.phase === "category-vote" && game.categoryVote) {
        const voted = game.categoryVote.votes[getMyId()];
        return `<div class="ghost-vote"><span>👻</span><div><b>捣蛋鬼领域投票</b><small>每3题决定一次下一题</small></div>${me.eliminated ? game.categoryVote.options.map((category) => `<button data-category-vote="${category}" class="${voted === category ? "selected" : ""}">${category}</button>`).join("") : '<em>等待捣蛋鬼投票…</em>'}</div>`;
      }
      if (!me.eliminated || game.status !== "playing") return "";
      return `<div class="ghost-tools"><span>👻 捣蛋鬼表情</span>${Object.entries(reactionIcons).map(([type, icon]) => `<button data-ghost-reaction="${type}">${icon}</button>`).join("")}</div>`;
    }

    function finishMarkup(room) {
      const game = room.game; if (game.status !== "finished") return "";
      const champion = room.players.find((item) => item.id === game.championId), mineChampion = game.championId === getMyId();
      return `<div class="quiz-final-overlay"><div class="quiz-crown">♛</div><small>THE LAST MIND STANDING</small><h2>${escapeHtml(champion?.name || "站神")}</h2><p>成为本场唯一的<strong>站神</strong></p><div class="quiz-final-ranking">${game.ranking.map((id, index) => { const item = room.players.find((entry) => entry.id === id); return `<div><b>${index + 1}</b><span>${escapeHtml(item.name)}</span><em>答对 ${item.correct} · ${item.score}分</em></div>`; }).join("")}</div><section class="challenge-board"><h3>赛后欢乐环节</h3>${room.players.filter((item) => item.id !== game.championId).map((item) => { const challenge = game.challenges[item.id]; if (challenge) return `<article class="challenge-ticket ${challenge.completed ? "done" : ""}"><header><b>${escapeHtml(item.name)}</b><span>${challengeNames[challenge.type]}</span></header><p>${escapeHtml(challenge.prompt)}</p>${item.id === getMyId() && !challenge.completed ? `<div>${game.challengeRerolls[item.id] ? "" : '<button id="rerollMyChallenge">换一题</button>'}<button id="completeMyChallenge">我完成了</button></div>` : challenge.completed ? "<em>✓ 已完成</em>" : ""}</article>`; return mineChampion ? `<article class="challenge-pick"><b>给 ${escapeHtml(item.name)} 选择</b><button data-challenge-target="${item.id}" data-challenge-type="truth">真心话</button><button data-challenge-target="${item.id}" data-challenge-type="dare">大冒险</button><button data-challenge-target="${item.id}" data-challenge-type="fun">欢乐挑战</button></article>` : `<article class="challenge-pick waiting">等待站神为 ${escapeHtml(item.name)} 选择挑战…</article>`; }).join("")}</section>${room.hostId === getMyId() ? '<button id="restartQuiz" class="restart-quiz">再来一局</button>' : ""}</div>`;
    }

    function paintReactions(room) {
      const fresh = room.game.reactions.filter((entry) => !seenReactionIds.has(entry.id));
      fresh.forEach((entry, index) => {
        seenReactionIds.add(entry.id);
        const el = document.createElement("div"); el.className = "quiz-reaction-pop"; el.style.setProperty("--x", `${15 + Math.random() * 70}%`); el.style.setProperty("--delay", `${index * .08}s`); el.innerHTML = `<b>${reactionIcons[entry.type]}</b><small>${escapeHtml(entry.playerName)}</small>`;
        $("quizReactions").appendChild(el); setTimeout(() => el.remove(), 2600);
      });
      if (seenReactionIds.size > 200) seenReactionIds = new Set(room.game.reactions.map((entry) => entry.id));
    }

    function paintElimination(room, transition) {
      const eliminated = room.players.find((item) => transition.players?.[item.id] && !transition.players[item.id].eliminated && item.eliminated);
      if (!eliminated || !$("quizEliminationFx")) return;
      const el = document.createElement("div");
      el.className = "quiz-elimination-fx";
      el.innerHTML = `<div class="quiz-drop-rings"><i></i><i></i><i></i></div><div class="quiz-falling-player"><span>${escapeHtml((eliminated.name || "?").slice(0, 1))}</span><b>${escapeHtml(eliminated.name)}</b></div><strong>生命核心耗尽</strong><small>坠入捣蛋鬼频道</small>`;
      $("quizEliminationFx").appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }

    function prepare(previous) { return { phase: previous?.game?.phase, resultAt: previous?.game?.result?.at, answererId: previous?.game?.answererId, championId: previous?.game?.championId, players: Object.fromEntries((previous?.players || []).map((item) => [item.id, { lives: item.lives, eliminated: item.eliminated }])) }; }
    function render(room, transition = {}) {
      latestRoom = room; show("game"); mount(); const game = room.game, myId = getMyId(), me = room.players.find((item) => item.id === myId);
      $("quizCode").textContent = room.code; $("quizModeBadge").textContent = game.mode === "buzzer" ? "⚡ 抢答模式" : "♛ 站神模式"; $("quizRound").textContent = `第 ${game.questionNumber} 题`;
      $("quizPlayers").className = `quiz-player-ring player-count-${room.players.length}`;
      $("quizPlayers").innerHTML = room.players.map((item) => playerMarkup(room, item, transition)).join("");
      $("quizGoal").textContent = game.mode === "buzzer" ? "率先答对7题" : "坚持到最后";
      $("quizStatus").textContent = game.phase === "buzz-answer" ? `${room.players.find((item) => item.id === game.answererId)?.name || "玩家"}拥有答题权` : game.phase === "category-vote" ? "捣蛋鬼领域投票" : game.phase === "result" ? "答案与知识解析" : game.mode === "buzzer" ? "题干逐字揭示中" : `${room.players.find((item) => item.id === game.activePlayerId)?.name || "玩家"}的回合`;
      $("quizCategory").innerHTML = `<span>${escapeHtml(game.question?.category || "知识竞技")}</span>${game.mode === "buzzer" && game.phase !== "result" ? `<b>答案 ${game.question?.answerLength || "?"} 个字</b>` : ""}`;
      const characterImage = game.question?.imageUrl ? `<figure class="quiz-character-visual"><img id="quizCharacterImage" src="${escapeHtml(game.question.imageUrl)}" alt="待识别的动漫角色" referrerpolicy="no-referrer"><figcaption><i></i> 人物影像档案</figcaption></figure>` : "";
      $("quizQuestion").innerHTML = game.question ? `${characterImage}<h1>${escapeHtml(game.question.prompt)}${game.mode === "buzzer" && !game.question.fullyRevealed && game.phase === "buzz-open" ? '<i class="typing-cursor"></i>' : ""}</h1>` : "";
      $("quizAnswerLength").textContent = game.mode === "buzzer" && ["buzz-open", "buzz-answer"].includes(game.phase) ? `本题答案：${game.question.answerLength}个字` : "";
      $("quizControls").innerHTML = game.status === "playing" ? renderControls(room) : "";
      $("quizResult").innerHTML = resultMarkup(room);
      $("quizGhostPanel").innerHTML = ghostMarkup(room);
      $("quizFinish").innerHTML = finishMarkup(room);
      $("quizAttempts").innerHTML = game.attempts?.length ? `<header>本题抢答记录</header>${game.attempts.map((attempt, index) => `<div class="${attempt.correct ? "right" : "wrong"}"><b>${index + 1}</b><span>${escapeHtml(room.players.find((item) => item.id === attempt.playerId)?.name || "玩家")}<small>${escapeHtml(attempt.value || "未作答")}</small></span><em>${attempt.correct ? "正确" : "失误"}</em></div>`).join("")}` : "";
      const total = game.phase === "buzz-answer" || game.phase === "question" ? 20 : game.phase === "category-vote" ? 12 : game.phase === "result" ? 6 : 30;
      if (game.deadline) clock(game.deadline, total); else { clearInterval(clockTimer); $("quizTimer").querySelector("strong").textContent = "--"; }
      $("quizTimer").classList.toggle("paused", game.phase === "buzz-answer");
      $("quizQuestionCard").className = `quiz-question-card phase-${game.phase} ${game.question?.imageUrl ? "has-character-image" : ""}`;
      const characterImg = $("quizCharacterImage"); if (characterImg) characterImg.onerror = () => characterImg.closest(".quiz-character-visual")?.classList.add("image-error");
      bindControls(room); paintReactions(room); paintElimination(room, transition);
      if (transition.resultAt !== game.result?.at && game.result) tone(game.result.correct ? "correct" : "wrong");
      if (!transition.championId && game.championId) tone("correct");
      if (me?.eliminated) $("quizArena").classList.add("ghost-view"); else $("quizArena").classList.remove("ghost-view");
    }

    return { renderLobby, render, prepare };
  };
})();
