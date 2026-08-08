import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const { validateQuestion } = require("../src/games/quiz-arena/question-quality");
const TARGET_TEXT_COUNT = 4940;
const SOURCE_CATEGORIES = {
  general: ["生活常识", 760], "for-kids": ["趣味冷知识", 420], geography: ["地理", 390], history: ["历史", 390],
  "science-technology": ["科学", 600], animals: ["自然动物", 330], literature: ["文学艺术", 280], humanities: ["文学艺术", 220],
  hobbies: ["生活常识", 270], music: ["音乐", 330], "video-games": ["游戏", 390], sports: ["体育", 390], movies: ["影视", 280],
  television: ["影视", 170], world: ["地理", 380], people: ["趣味冷知识", 270], "brain-teasers": ["趣味冷知识", 120]
};

function decodeHtml(value) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return String(value || "").replace(/&(#x?[0-9a-f]+|\w+);/gi, (_all, key) => {
    if (key[0] === "#") return String.fromCodePoint(parseInt(key.slice(key[1]?.toLowerCase() === "x" ? 2 : 1), key[1]?.toLowerCase() === "x" ? 16 : 10));
    return named[key.toLowerCase()] || "";
  }).replace(/\s+/g, " ").trim();
}

function parseCategory(text, sourceCategory) {
  const lines = text.replace(/\r/g, "").split("\n");
  const rows = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#Q ")) {
      if (current) rows.push(current);
      current = { sourceCategory, prompt: line.slice(3).trim(), answer: "", options: [] };
    } else if (current && line.startsWith("^ ")) current.answer = line.slice(2).trim();
    else if (current && /^[A-Z] /.test(line)) current.options.push(line.slice(2).trim());
    else if (current && line && !current.answer) current.prompt += ` ${line}`;
  }
  if (current) rows.push(current);
  return rows;
}

function answerType(prompt) {
  const q = prompt.toLowerCase();
  if (/\b(what|which) year\b|\bwhen (was|did|were)\b/.test(q)) return "year";
  if (/\b(which|what) country\b|\bcountry (is|was|does)\b/.test(q)) return "country";
  if (/\b(capital of|which city|what city|city is)\b/.test(q)) return "city";
  if (/\b(who|whose|which (actor|actress|author|artist|composer|director|inventor|person|player|president|scientist|writer))\b|\bthis (man|woman|writer|actor|actress|scientist)\b/.test(q)) return "person";
  if (/\bhow many\b|\bwhat (number|percentage|distance|length|amount)\b/.test(q)) return "number";
  if (/\b(which|what) (animal|bird|fish|mammal|species)\b/.test(q)) return "animal";
  if (/\b(which|what) (book|novel|film|movie|song|album|game|language|planet|sport|colour|color)\b/.test(q)) return q.match(/\b(book|novel|film|movie|song|album|game|language|planet|sport|colour|color)\b/)?.[1] || "source-set";
  return "source-set";
}

const REJECT = /\b(episode|season finale|emmy award|academy award|billboard chart|box office gross|serial number|postal code|area code|playboy|porn|adult film|suicide|murder victim)\b/i;
function sourceQuality(row) {
  const prompt = decodeHtml(row.prompt);
  const answer = decodeHtml(row.answer);
  const options = [answer, ...row.options.map(decodeHtml).filter((item) => item && item !== answer)].slice(0, 4);
  if (prompt.length < 12 || prompt.length > 180 || answer.length < 1 || answer.length > 55 || options.length !== 4 || new Set(options.map((x) => x.toLowerCase())).size !== 4) return null;
  if (REJECT.test(prompt) || /_{3,}|\?{3,}|\b(all|none) of the above\b/i.test(options.join(" "))) return null;
  const type = answerType(prompt);
  if (type === "year" && !options.every((item) => /\d{3,4}/.test(item))) return null;
  if (type === "number" && !options.every((item) => /\d/.test(item))) return null;
  if (["person", "country", "city", "animal"].includes(type) && options.some((item) => /\d{3,}/.test(item))) return null;
  return { prompt, answer, options, answerType: type };
}

function score(row) {
  let value = 0;
  if (/capital|largest|smallest|author|invent|planet|ocean|continent|element|human body|animal|language|country/i.test(row.prompt)) value += 5;
  if (row.prompt.length <= 95) value += 3;
  if (row.answerType !== "source-set") value += 3;
  if (/\b(19\d\d|20\d\d)\b/.test(row.prompt)) value -= 1;
  return value;
}

async function translateBlocks(rows) {
  const result = new Map();
  const blocks = rows.map((row, index) => ({
    index,
    text: [`__Q${index}__ ${row.prompt}`, ...row.options.map((option, optionIndex) => `__O${index}_${optionIndex}__ ${option}`)].join("\n")
  }));
  const batches = [];
  let batch = [];
  let length = 0;
  for (const block of blocks) {
    if (batch.length && length + block.text.length > 4300) { batches.push(batch); batch = []; length = 0; }
    batch.push(block); length += block.text.length + 1;
  }
  if (batch.length) batches.push(batch);

  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const batchIndex = cursor++;
      const current = batches[batchIndex];
      const body = new URLSearchParams({ q: current.map((item) => item.text).join("\n") });
      let translated = "";
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const response = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" }, body, signal: AbortSignal.timeout(20_000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          translated = payload[0].map((part) => part[0]).join("");
          break;
        } catch (error) {
          if (attempt === 3) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      const lines = translated.split("\n").map((line) => line.trim()).filter(Boolean);
      for (const line of lines) {
        let match = line.match(/^__Q(\d+)__\s*(.+)$/);
        if (match) { const entry = result.get(Number(match[1])) || { options: [] }; entry.prompt = match[2].trim(); result.set(Number(match[1]), entry); continue; }
        match = line.match(/^__O(\d+)_(\d+)__\s*(.+)$/);
        if (match) { const entry = result.get(Number(match[1])) || { options: [] }; entry.options[Number(match[2])] = match[3].trim(); result.set(Number(match[1]), entry); }
      }
      if ((batchIndex + 1) % 25 === 0) process.stdout.write(`translated ${batchIndex + 1}/${batches.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return rows.map((row, index) => ({ ...row, translation: result.get(index) }));
}

function translatedQuality(row) {
  const prompt = row.translation?.prompt?.replace(/\s+/g, " ").trim();
  const options = row.translation?.options?.map((item) => item?.replace(/\s+/g, " ").trim());
  if (!prompt || !options || options.length !== 4 || options.some((item) => !item)) return null;
  if (new Set(options.map((item) => item.normalize("NFKC").toLowerCase())).size !== 4) return null;
  if (/__[QO]\d|�|\bundefined\b|null/i.test([prompt, ...options].join(" "))) return null;
  if (row.answerType === "year" && !options.every((item) => /\d{3,4}/.test(item))) return null;
  if (row.answerType === "number" && !options.every((item) => /\d/.test(item))) return null;
  if (["person", "country", "city", "animal"].includes(row.answerType) && options.some((item) => /\d{3,}/.test(item))) return null;
  return { prompt, options };
}

const temp = mkdtempSync(join(tmpdir(), "quiz-bank-"));
const repo = join(temp, "OpenTriviaQA");
execFileSync("git", ["clone", "--depth", "1", "https://github.com/uberspot/OpenTriviaQA.git", repo], { stdio: "inherit" });
let selected = [];
for (const [sourceCategory, [category, quota]] of Object.entries(SOURCE_CATEGORIES)) {
  const text = readFileSync(join(repo, "categories", sourceCategory), "utf8");
  const valid = parseCategory(text, sourceCategory).map(sourceQuality).filter(Boolean).map((item) => ({ ...item, sourceCategory, category, qualityScore: score(item) }));
  valid.sort((a, b) => b.qualityScore - a.qualityScore || a.prompt.localeCompare(b.prompt));
  selected.push(...valid.slice(0, quota));
}
selected = [...new Map(selected.map((row) => [row.prompt.toLowerCase(), row])).values()];
if (selected.length < TARGET_TEXT_COUNT) throw new Error(`源题通过初审仅 ${selected.length} 道，不足 ${TARGET_TEXT_COUNT}`);

const translated = await translateBlocks(selected);
const finalRows = [];
for (const row of translated) {
  const clean = translatedQuality(row);
  if (!clean) continue;
  const correctIndex = row.options.indexOf(row.answer);
  const answer = clean.options[correctIndex];
  if (!answer) continue;
  const candidate = {
    id: `quiz-${String(finalRows.length + 1).padStart(5, "0")}`,
    knowledgeKey: `quiz-v3-${String(finalRows.length + 1).padStart(5, "0")}`,
    category: row.category,
    pack: ["影视", "音乐", "游戏", "网络文化"].includes(row.category) ? "party" : "classic",
    kind: "choice",
    prompt: clean.prompt,
    answer,
    aliases: [answer],
    answerLength: [...answer].length,
    options: clean.options,
    optionType: row.answerType,
    difficulty: row.qualityScore >= 7 ? "easy" : row.qualityScore >= 3 ? "medium" : "hard",
    explanation: `正确答案是“${answer}”。`,
    source: "OpenTriviaQA 精选题（CC BY-SA 4.0）",
    updatedAt: "2026-08-08"
  };
  if (!validateQuestion(candidate).valid) continue;
  finalRows.push(candidate);
  if (finalRows.length === TARGET_TEXT_COUNT) break;
}
if (finalRows.length !== TARGET_TEXT_COUNT) throw new Error(`翻译与终审后仅 ${finalRows.length} 道，不足 ${TARGET_TEXT_COUNT}`);
writeFileSync(join(ROOT, "src/games/quiz-arena/curated-questions.json"), JSON.stringify(finalRows));
console.log(JSON.stringify({ written: finalRows.length, categories: Object.fromEntries([...new Set(finalRows.map((q) => q.category))].map((category) => [category, finalRows.filter((q) => q.category === category).length])) }, null, 2));
