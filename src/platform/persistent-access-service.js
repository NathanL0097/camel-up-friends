const crypto = require("node:crypto");
const { CODE_HASHES, ADMIN_CODE_HASHES, LONG_CODE_HASHES } = require("./access-service");

function hash(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }

function createPersistentAccessService({ database, fallback, durationMs = 30 * 60 * 60_000 } = {}) {
  const codes = new Map([
    ...CODE_HASHES.map((value) => [value, { role: "tester", durationHours: 30 }]),
    ...LONG_CODE_HASHES.map((value) => [value, { role: "tester", durationHours: 1000 }]),
    ...ADMIN_CODE_HASHES.map((value) => [value, { role: "admin", durationHours: 0 }])
  ]);
  let initialized = false;
  async function ready() {
    if (initialized) return;
    await database.ready();
    if (database.enabled) {
      for (const [codeHash, details] of codes) await database.query("INSERT INTO activation_codes (code_hash, role, duration_hours) VALUES ($1, $2, $3) ON CONFLICT (code_hash) DO UPDATE SET role = EXCLUDED.role, duration_hours = EXCLUDED.duration_hours", [codeHash, details.role, details.durationHours]);
    }
    initialized = true;
  }
  async function issue(code) {
    await ready();
    if (!database.enabled) return fallback.issue(code);
    const codeHash = hash(String(code || "").trim().toUpperCase());
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hash(token);
    const details = codes.get(codeHash);
    if (!details) throw new Error("激活码无效或已经使用");
    const result = await database.query("UPDATE activation_codes SET redeemed_at = NOW(), redeemed_token_hash = $2 WHERE code_hash = $1 AND redeemed_at IS NULL RETURNING role, duration_hours", [codeHash, tokenHash]);
    if (!result.rows[0]) throw new Error("激活码无效或已经使用");
    const role = result.rows[0].role;
    const expiresAt = role === "admin" ? null : new Date(Date.now() + Number(result.rows[0].duration_hours || details.durationHours) * 60 * 60_000);
    await database.query("INSERT INTO access_grants (token_hash, role, expires_at, last_seen_at) VALUES ($1, $2, $3, NOW())", [tokenHash, role, expiresAt]);
    return { token, expiresAt: expiresAt?.getTime() || null, role, actorId: tokenHash.slice(0, 12) };
  }
  async function grant(token) {
    await ready();
    if (!database.enabled) return fallback.status(token);
    const result = await database.query("UPDATE access_grants SET last_seen_at = NOW() WHERE token_hash = $1 AND (expires_at IS NULL OR expires_at > NOW()) RETURNING token_hash, role, EXTRACT(EPOCH FROM expires_at) * 1000 AS expires_ms", [hash(token || "")]);
    if (!result.rows[0]) return { active: false, expiresAt: null, role: null };
    return { active: true, expiresAt: result.rows[0].expires_ms ? Number(result.rows[0].expires_ms) : null, role: result.rows[0].role, actorId: result.rows[0].token_hash.slice(0, 12) };
  }
  async function status(token) { return grant(token); }
  async function valid(token, requiredRole = null) { const result = await grant(token); return result.active && (!requiredRole || result.role === requiredRole); }
  async function adminValid(token) { return valid(token, "admin"); }
  async function audit(event) {
    await ready();
    if (!database.enabled) return;
    await database.query("INSERT INTO audit_logs (actor_type, actor_id, action, room_code, ip_address, metadata) VALUES ($1, $2, $3, $4, $5, $6)", [event.actorType || "system", event.actorId || null, event.action, event.roomCode || null, event.ip || null, event.metadata || {}]);
  }
  async function listAudit(limit = 200) {
    await ready();
    if (!database.enabled) return [];
    const result = await database.query("SELECT id, occurred_at, actor_type, actor_id, action, room_code, ip_address, metadata FROM audit_logs ORDER BY id DESC LIMIT $1", [Math.min(500, Math.max(1, Number(limit) || 200))]);
    return result.rows;
  }
  return { ready, issue, status, valid, adminValid, audit, listAudit, durationMs };
}

module.exports = { createPersistentAccessService };
