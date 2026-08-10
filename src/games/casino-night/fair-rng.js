const crypto = require("node:crypto");

function commitment(seed, roundId) {
  return crypto.createHash("sha256").update(`${roundId}:${seed}`).digest("hex");
}

function makeSeed() {
  return crypto.randomBytes(32).toString("hex");
}

function seededRandom(seed, roundId) {
  let counter = 0;
  let pool = Buffer.alloc(0);
  function refill() {
    const block = crypto.createHmac("sha256", seed).update(`${roundId}:${counter++}`).digest();
    pool = Buffer.concat([pool, block]);
  }
  return function randomInt(max) {
    if (!Number.isSafeInteger(max) || max <= 0) throw new Error("随机范围无效");
    const limit = Math.floor(0x100000000 / max) * max;
    while (true) {
      while (pool.length < 4) refill();
      const value = pool.readUInt32BE(0);
      pool = pool.subarray(4);
      if (value < limit) return value % max;
    }
  };
}

function shuffle(items, randomInt) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const picked = randomInt(index + 1);
    [result[index], result[picked]] = [result[picked], result[index]];
  }
  return result;
}

function createFairRound(roundId) {
  const seed = makeSeed();
  return { seed, commit: commitment(seed, roundId), randomInt: seededRandom(seed, roundId) };
}

module.exports = { commitment, seededRandom, shuffle, createFairRound };
