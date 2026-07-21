const RANKS = "23456789TJQKA";
const SUITS = "cdhs";

function deck() { return [...SUITS].flatMap((suit) => [...RANKS].map((rank) => `${rank}${suit}`)); }
function combinations(items, size) {
  const out = [];
  function walk(start, picked) {
    if (picked.length === size) { out.push(picked); return; }
    for (let i = start; i <= items.length - (size - picked.length); i += 1) walk(i + 1, [...picked, items[i]]);
  }
  walk(0, []); return out;
}
function evaluateFive(cards) {
  const values = cards.map((card) => RANKS.indexOf(card[0]) + 2).sort((a, b) => b - a);
  const counts = new Map(); values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card[1] === cards[0][1]);
  const unique = [...new Set(values)];
  if (unique[0] === 14) unique.push(1);
  let straight = 0;
  for (let i = 0; i <= unique.length - 5; i += 1) if (unique[i] - unique[i + 4] === 4) { straight = unique[i]; break; }
  let score; let name;
  if (flush && straight) { score = [8, straight]; name = straight === 14 ? "皇家同花顺" : "同花顺"; }
  else if (groups[0][1] === 4) { score = [7, groups[0][0], groups[1][0]]; name = "四条"; }
  else if (groups[0][1] === 3 && groups[1]?.[1] === 2) { score = [6, groups[0][0], groups[1][0]]; name = "葫芦"; }
  else if (flush) { score = [5, ...values]; name = "同花"; }
  else if (straight) { score = [4, straight]; name = "顺子"; }
  else if (groups[0][1] === 3) { score = [3, groups[0][0], ...groups.slice(1).map((x) => x[0]).sort((a, b) => b - a)]; name = "三条"; }
  else if (groups[0][1] === 2 && groups[1]?.[1] === 2) { const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a); score = [2, ...pairs, groups.find((x) => x[1] === 1)[0]]; name = "两对"; }
  else if (groups[0][1] === 2) { score = [1, groups[0][0], ...groups.slice(1).map((x) => x[0]).sort((a, b) => b - a)]; name = "一对"; }
  else { score = [0, ...values]; name = "高牌"; }
  return { score, name, cards };
}
function compare(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i += 1) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0); return 0; }
function bestHoldem(hole, board) { return combinations([...hole, ...board], 5).map(evaluateFive).sort((a, b) => compare(b.score, a.score))[0]; }
function bestOmaha(hole, board) {
  return combinations(hole, 2).flatMap((h) => combinations(board, 3).map((b) => evaluateFive([...h, ...b]))).sort((a, b) => compare(b.score, a.score))[0];
}
module.exports = { RANKS, SUITS, deck, combinations, evaluateFive, compare, bestHoldem, bestOmaha };
