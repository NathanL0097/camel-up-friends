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
  "76fb85d31a1dd92f520264f573e07150c324c6c46041554842420da768381440",
  "20a579b0da7ba6bc8d4841210fbbb2dc1a3bf08b74b924207b8a94727f573624"
];
const ADMIN_CODE_HASHES = new Set([
  "e4a3d83d6d5b9f0eca380b80310800b6f117d0f58663e9b68ae624838ca9e152",
  "49295cc2300f42fc0ef97dcb68f156245368f5dcba07edbea6dba65b3544c86b"
]);
const LONG_CODE_HASHES = new Set([
  "ec5f9d1b928c130b6e5b42608f6c60c2ec2db109e0dcf986c68e00a77b38c90f",
  "72ee3e7e84ee8cfce5fac4361615fb3ba504d224bf6c804eb49e0dba28a356e0",
  "602d1ecd538bc78f4a43257a9246d7e4623328c243056f38375871688f263176",
  "c25f9f91f8d4fae1ec6985968deab3c127db5756b1e95485cfe6f2781ddf82d3",
  "ac6da8fc6c91365c4303259bb3c61f31ec263216cbdf6a1cd906d743e43de6fd",
  "681e85e858b619b9327e7a7f15b281dc0a737c7202421f6c2bb070693d17f231",
  "156b89f23298fe35dd99b0e9e6ebb51690ca74bb9f68401a06398098a47e10d4",
  "e7adbc8c473536314aa4f987e2e88b69f174b5ed42eb5aa32d19a5bdd3198304",
  "513760a37491627e3bd8b60cd8cb4addbb6df7b14539a52f36cd082ab99c6447",
  "31c93f03f7e5af5d013b306224aa5bdf6efeb40253d8854971d98a605ac4252a"
]);

function digest(value) {
  return crypto.createHash("sha256").update(String(value).trim().toUpperCase()).digest("hex");
}

function createAccessService({ durationMs = 30 * 60 * 60_000 } = {}) {
  const configured = process.env.ACTIVATION_CODE_HASHES?.split(",").map((value) => value.trim()).filter(Boolean);
  const allowed = new Set(configured?.length ? configured : [...DEFAULT_CODE_HASHES, ...LONG_CODE_HASHES]);
  const redeemed = new Set();
  const grants = new Map();

  function issue(code) {
    const hash = digest(code);
    const role = ADMIN_CODE_HASHES.has(hash) ? "admin" : "tester";
    if ((!allowed.has(hash) && role !== "admin") || redeemed.has(hash)) throw new Error("激活码无效或已经使用");
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = role === "admin" ? null : Date.now() + (LONG_CODE_HASHES.has(hash) ? 1000 * 60 * 60_000 : durationMs);
    redeemed.add(hash);
    grants.set(token, { expiresAt, role });
    return { token, expiresAt, role };
  }

  function valid(token, requiredRole = null) {
    if (!token || !grants.has(token)) return false;
    const grant = grants.get(token);
    if (grant.expiresAt && grant.expiresAt <= Date.now()) {
      grants.delete(token);
      return false;
    }
    return !requiredRole || grant.role === requiredRole;
  }

  function status(token) {
    if (!valid(token)) return { active: false, expiresAt: null, role: null };
    const grant = grants.get(token);
    return { active: true, expiresAt: grant.expiresAt, role: grant.role };
  }

  function adminValid(token) { return valid(token, "admin"); }

  return { issue, valid, adminValid, status, durationMs };
}

module.exports = { createAccessService };
module.exports.CODE_HASHES = DEFAULT_CODE_HASHES;
module.exports.ADMIN_CODE_HASHES = [...ADMIN_CODE_HASHES];
module.exports.LONG_CODE_HASHES = [...LONG_CODE_HASHES];
