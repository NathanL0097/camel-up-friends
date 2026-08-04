const crypto = require("node:crypto");

const DEFAULT_CODE_HASHES = [
  "fe1e055c69694b549863eb5a1da634552427808565cead64cd4ffedd45352b2b",
  "0a093c1cb52104852951907b9b3cc27c87281609e4c9fe342b05d08809028cbf",
  "7f243a6deefbe344de475ece5efa2f8591cb74a312747c00104143a86d1c0923",
  "63ccabc42243be751e705bcda0c7d5fa04e1272bfc19e0a32342fc0509ad2461",
  "77d2fb86661d7ea6ca410253a9b3d1b293d31b12b7a619b521feb236a9eb441f",
  "4e40af3fd4838cbcbe48a5c37d5249f24ec8a58e2aa8d940cc641b9f2745762b",
  "472e7a827f61cbb1dc3d45676d9ea557f97dbe5862f56ac6e20bede1b1660ac8",
  "d71909bc4acb4a84ff34799d23bc1c92c43befc8823e8722ea45f026bca80dd6",
  "ec06857f39546e72e8643efae99a11964733e69cf807792f96897dd4c407881a",
  "76fb85d31a1dd92f520264f573e07150c324c6c46041554842420da768381440"
];

function digest(value) {
  return crypto.createHash("sha256").update(String(value).trim().toUpperCase()).digest("hex");
}

function createAccessService({ durationMs = 30 * 60 * 60_000 } = {}) {
  const configured = process.env.ACTIVATION_CODE_HASHES?.split(",").map((value) => value.trim()).filter(Boolean);
  const allowed = new Set(configured?.length ? configured : DEFAULT_CODE_HASHES);
  const redeemed = new Set();
  const grants = new Map();

  function issue(code) {
    const hash = digest(code);
    if (!allowed.has(hash) || redeemed.has(hash)) throw new Error("激活码无效或已经使用");
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + durationMs;
    redeemed.add(hash);
    grants.set(token, expiresAt);
    return { token, expiresAt };
  }

  function valid(token) {
    if (!token || !grants.has(token)) return false;
    const expiresAt = grants.get(token);
    if (expiresAt <= Date.now()) {
      grants.delete(token);
      return false;
    }
    return true;
  }

  function status(token) {
    if (!valid(token)) return { active: false, expiresAt: null };
    return { active: true, expiresAt: grants.get(token) };
  }

  return { issue, valid, status, durationMs };
}

module.exports = { createAccessService };
