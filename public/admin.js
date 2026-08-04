(() => {
  const token = localStorage.getItem("tabletopAccessToken") || "";
  const error = document.getElementById("adminError");
  const content = document.getElementById("adminContent");
  const rows = document.getElementById("roomRows");
  const empty = document.getElementById("emptyRooms");
  const esc = (value) => { const div = document.createElement("div"); div.textContent = value ?? ""; return div.innerHTML; };
  async function load() {
    error.hidden = true;
    try {
      const response = await fetch("/api/admin/overview", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "管理员授权已失效");
      content.hidden = false;
      const rooms = data.rooms || [];
      document.getElementById("roomCount").textContent = rooms.length;
      document.getElementById("activeCount").textContent = rooms.filter((room) => room.started).length;
      document.getElementById("playerCount").textContent = rooms.reduce((sum, room) => sum + room.players.length, 0);
      empty.hidden = rooms.length > 0;
      rows.innerHTML = rooms.map((room) => `<tr><td><strong>${esc(room.code)}</strong></td><td>${esc(room.title)}</td><td>${esc(room.host)}</td><td>${room.players.map((player) => `${esc(player.name)}${player.connected ? "" : "（离线）"}`).join("、") || "—"}</td><td class="admin-status ${room.started ? "" : "offline"}">${room.started ? "进行中" : "等待中"}</td><td><button class="admin-close" type="button" data-close-room="${esc(room.code)}">关闭房间</button></td></tr>`).join("");
      rows.querySelectorAll("[data-close-room]").forEach((button) => button.onclick = async () => {
        if (!confirm(`确定关闭房间 ${button.dataset.closeRoom} 吗？`)) return;
        await fetch(`/api/admin/rooms/${button.dataset.closeRoom}/close`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        load();
      });
    } catch (loadError) {
      content.hidden = true;
      error.textContent = `${loadError.message}。请回到大厅重新使用管理员激活码。`;
      error.hidden = false;
    }
  }
  document.getElementById("refreshButton").onclick = load;
  load();
})();
