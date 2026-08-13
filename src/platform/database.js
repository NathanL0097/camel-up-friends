const { Pool } = require("pg");

function createDatabase({ url = process.env.DATABASE_URL } = {}) {
  if (!url) return { enabled: false, ready: async () => {}, query: async () => ({ rows: [] }), close: async () => {} };
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 4, idleTimeoutMillis: 30_000 });
  const readyPromise = pool.query(`
    CREATE TABLE IF NOT EXISTS activation_codes (
      code_hash TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('tester', 'admin')),
      duration_hours INTEGER NOT NULL DEFAULT 30,
      redeemed_at TIMESTAMPTZ,
      redeemed_token_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS access_grants (
      token_hash TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('tester', 'admin')),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      action TEXT NOT NULL,
      room_code TEXT,
      ip_address TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS audit_logs_occurred_idx ON audit_logs (occurred_at DESC);
    CREATE TABLE IF NOT EXISTS quiz_question_history (
      owner_hash TEXT NOT NULL,
      knowledge_key TEXT NOT NULL,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      seen_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (owner_hash, knowledge_key)
    );
    CREATE INDEX IF NOT EXISTS quiz_question_history_owner_idx ON quiz_question_history (owner_hash, last_seen_at DESC);
    CREATE TABLE IF NOT EXISTS quiz_retired_questions (
      knowledge_key TEXT PRIMARY KEY,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      room_code TEXT
    );
    CREATE INDEX IF NOT EXISTS quiz_retired_questions_seen_idx ON quiz_retired_questions (first_seen_at ASC);
    INSERT INTO quiz_retired_questions (knowledge_key, first_seen_at)
    SELECT knowledge_key, MIN(first_seen_at) FROM quiz_question_history GROUP BY knowledge_key
    ON CONFLICT (knowledge_key) DO NOTHING;
    ALTER TABLE activation_codes ADD COLUMN IF NOT EXISTS duration_hours INTEGER NOT NULL DEFAULT 30;
    CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'audit logs are append-only'; END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS audit_logs_no_mutation ON audit_logs;
    CREATE TRIGGER audit_logs_no_mutation BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
  `);
  return {
    enabled: true,
    ready: () => readyPromise,
    query: (text, values) => pool.query(text, values),
    close: () => pool.end()
  };
}

module.exports = { createDatabase };
