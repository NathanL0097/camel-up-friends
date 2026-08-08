import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ENDPOINT = "https://query.wikidata.org/sparql";
const SPECS = [
  ["geo-capital", "地理", "city", "wdt:P31 wd:Q3624078", "wdt:P36", 20, 260, (s) => `${s}的首都是哪座城市？`],
  ["geo-city-country", "地理", "country", "wdt:P31 wd:Q515", "wdt:P17", 80, 320, (s) => `${s}位于哪个国家？`],
  ["geo-mountain-country", "地理", "country", "wdt:P31 wd:Q8502", "wdt:P17", 35, 240, (s) => `${s}位于哪个国家？`],
  ["film-director", "影视", "person", "wdt:P31 wd:Q11424", "wdt:P57", 35, 420, (s) => `电影《${s}》的导演是谁？`],
  ["film-country", "影视", "country", "wdt:P31 wd:Q11424", "wdt:P495", 35, 360, (s) => `电影《${s}》主要出品自哪个国家？`],
  ["song-performer", "音乐", "person", "wdt:P31 wd:Q7366", "wdt:P175", 25, 420, (s) => `歌曲《${s}》的原唱或主要表演者是谁？`],
  ["album-performer", "音乐", "person", "wdt:P31 wd:Q482994", "wdt:P175", 25, 320, (s) => `音乐专辑《${s}》由谁演唱或发行？`],
  ["game-developer", "游戏与网络文化", "studio", "wdt:P31 wd:Q7889", "wdt:P178", 25, 420, (s) => `游戏《${s}》由哪家公司或工作室开发？`],
  ["painting-creator", "文学艺术", "person", "wdt:P31 wd:Q3305213", "wdt:P170", 25, 320, (s) => `绘画作品《${s}》的创作者是谁？`],
  ["company-founder", "科学与科技", "person", "wdt:P31/wdt:P279* wd:Q783794", "wdt:P112", 55, 320, (s) => `${s}的创办者是谁？`],
  ["athlete-sport", "体育", "sport", "wdt:P31 wd:Q5", "wdt:P641", 100, 360, (s) => `运动员${s}主要从事哪项运动？`],
  ["invention-inventor", "科学与科技", "person", "wdt:P31/wdt:P279* wd:Q121182", "wdt:P61", 25, 280, (s) => `${s}通常与哪位发明者联系最紧密？`]
];

function labelOkay(value) { return value && !/^Q\d+$/.test(value) && value.length <= 42 && !/[\r\n{}<>]/.test(value); }
async function querySpec(spec) {
  const [key, category, optionType, subjectPattern, relation, minimumSitelinks, limit, prompt] = spec;
  const query = `SELECT ?subject ?subjectLabel ?answer ?answerLabel ?sitelinks WHERE {
    ?subject ${subjectPattern}; ${relation} ?answer; wikibase:sitelinks ?sitelinks.
    FILTER(?sitelinks >= ${minimumSitelinks})
    FILTER NOT EXISTS { ?subject ${relation} ?other. FILTER(?other != ?answer) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-cn,zh,en". }
  } ORDER BY DESC(?sitelinks) LIMIT ${limit}`;
  const url = new URL(ENDPOINT); url.searchParams.set("query", query);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "application/sparql-results+json", "user-agent": "FriendsBoardGameQuiz/3.0" }, signal: AbortSignal.timeout(55_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const rows = payload.results.bindings.map((entry) => ({
        key,
        category,
        optionType,
        subjectId: entry.subject.value.split("/").at(-1),
        answerId: entry.answer.value.split("/").at(-1),
        subject: entry.subjectLabel.value,
        answer: entry.answerLabel.value,
        sitelinks: Number(entry.sitelinks.value),
        prompt
      })).filter((row) => labelOkay(row.subject) && labelOkay(row.answer) && row.subject !== row.answer);
      console.log(`${key}: ${rows.length}`);
      return rows;
    } catch (error) {
      if (attempt === 4) { console.warn(`${key}: skipped (${error.message})`); return []; }
      await new Promise((resolve) => setTimeout(resolve, 1800 * (attempt + 1)));
    }
  }
  return [];
}

let cursor = 0;
const results = [];
async function worker() {
  while (cursor < SPECS.length) {
    const spec = SPECS[cursor++];
    results.push(...await querySpec(spec));
  }
}
await Promise.all([worker(), worker()]);

const bySpec = new Map();
for (const row of results) {
  if (!bySpec.has(row.key)) bySpec.set(row.key, []);
  bySpec.get(row.key).push(row);
}
const questions = [];
for (const [key, rows] of bySpec) {
  const answerRows = [...new Map(rows.map((row) => [row.answer, row])).values()];
  if (answerRows.length < 4) continue;
  rows.forEach((row, index) => {
    const distractors = [];
    for (let offset = 7; distractors.length < 3 && offset < answerRows.length + 40; offset += 11) {
      const candidate = answerRows[(index + offset) % answerRows.length]?.answer;
      if (candidate && candidate !== row.answer && !distractors.includes(candidate)) distractors.push(candidate);
    }
    if (distractors.length !== 3) return;
    const id = `wikidata-${key}-${row.subjectId}-${row.answerId}`;
    questions.push({
      id,
      knowledgeKey: id,
      category: row.category,
      pack: ["影视", "音乐", "游戏与网络文化"].includes(row.category) ? "party" : "classic",
      kind: "choice",
      prompt: row.prompt(row.subject),
      answer: row.answer,
      aliases: [row.answer],
      answerLength: [...row.answer].length,
      options: [row.answer, ...distractors],
      optionType: row.optionType,
      difficulty: row.sitelinks >= 100 ? "easy" : row.sitelinks >= 50 ? "medium" : "hard",
      explanation: `正确答案是“${row.answer}”。`,
      source: "Wikidata 结构化大众知识（CC0）",
      updatedAt: "2026-08-08",
      popularity: row.sitelinks
    });
  });
}
questions.sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id));
writeFileSync(`${ROOT}src/games/quiz-arena/structured-questions.json`, JSON.stringify(questions));
console.log(`written: ${questions.length}`);
