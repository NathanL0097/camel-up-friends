import { mkdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const SOURCE_URL = "https://raw.githubusercontent.com/apple/ml-mkqa/main/dataset/mkqa.jsonl.gz";
const OUT_FILE = new URL("../src/games/quiz-arena/mkqa-questions.json", import.meta.url);
const CATEGORIES = ["生活常识", "历史", "地理", "科学", "科技", "体育", "影视", "音乐", "游戏", "美食", "文学艺术", "自然动物", "趣味冷知识", "网络文化", "时事政治"];

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function categoryFor(question) {
  const text = question.toLowerCase();
  if (/(朝代|皇帝|国王|女王|将军|战争|革命|条约|历史|古代|王朝|大臣|首相|总统|年代|建于|谁建立|谁发明)/.test(text)) return "历史";
  if (/(作者|小说|诗|诗人|书|作品|画家|绘画|雕塑|文学|剧作家|艺术|博物馆)/.test(text)) return "文学艺术";
  if (/(国家|首都|城市|大陆|海洋|河流|山|岛|地图|位于|地理|面积|人口|哪个洲)/.test(text)) return "地理";
  if (/(动物|鸟|鱼|昆虫|植物|树|花|狗|猫|鲸|恐龙|自然|物种)/.test(text)) return "自然动物";
  if (/(科学|化学|物理|生物|元素|细胞|行星|宇宙|太阳|月球|温度|重力)/.test(text)) return "科学";
  if (/(电脑|计算机|互联网|网络|手机|软件|技术|发明|电池|卫星|人工智能)/.test(text)) return "科技";
  if (/(足球|篮球|网球|奥运|比赛|运动|冠军|球员|马拉松|棒球)/.test(text)) return "体育";
  if (/(电影|电视剧|演员|导演|动画|节目|电视|影院)/.test(text)) return "影视";
  if (/(音乐|歌曲|乐队|歌手|专辑|钢琴|吉他|演唱)/.test(text)) return "音乐";
  if (/(游戏|玩家|任天堂|主机|卡牌|桌游)/.test(text)) return "游戏";
  if (/(食物|食品|料理|餐厅|菜|咖啡|茶|酒|面包|蛋糕)/.test(text)) return "美食";
  if (/(政府|联合国|法律|议会|选举|政党|政治|政策|国际|总统|首相)/.test(text)) return "时事政治";
  if (/(网站|社交|视频|搜索|在线|推特|博客|媒体)/.test(text)) return "网络文化";
  if (/(生活|健康|学校|家庭|工作|钱|语言|节日|宗教)/.test(text)) return "生活常识";
  return "趣味冷知识";
}

const response = await fetch(SOURCE_URL, { headers: { "User-Agent": "FriendsTabletopQuiz/1.0 (open-data importer)" } });
if (!response.ok) throw new Error(`无法下载 MKQA：${response.status}`);
const raw = gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8");
const seen = new Set();
const rows = [];
for (const line of raw.split("\n")) {
  if (!line) continue;
  const item = JSON.parse(line);
  const prompt = clean(item.queries?.zh_cn);
  const answers = (item.answers?.zh_cn || []).map((answer) => clean(answer.text)).filter((answer) => answer && answer.length <= 48);
  const answer = answers[0];
  if (!prompt || prompt.length < 5 || prompt.length > 96 || !answer || seen.has(item.example_id)) continue;
  if (!["entity", "date", "number", "number_with_unit", "short_phrase"].includes(item.answers?.zh_cn?.[0]?.type)) continue;
  seen.add(item.example_id);
  rows.push({
    id: `mkqa-${item.example_id}`,
    knowledgeKey: `mkqa-${item.example_id}`,
    category: categoryFor(prompt),
    pack: "classic",
    kind: "choice",
    prompt: `${prompt.replace(/[。？?]+$/, "")}？`,
    answer,
    aliases: [...new Set(answers)].slice(0, 8),
    answerLength: [...answer].length,
    explanation: "本题答案来自 MKQA 多语言知识问答集的人工中文翻译与标注。",
    source: "MKQA（CC BY-SA 3.0）",
    updatedAt: "2026-08-08"
  });
}
const answerPools = new Map();
for (const row of rows) (answerPools.get(row.category) || answerPools.set(row.category, []).get(row.category)).push(row.answer);
for (let index = 0; index < rows.length; index += 1) {
  const row = rows[index], pool = answerPools.get(row.category) || [];
  const options = [row.answer];
  for (let step = 1; options.length < 4 && step <= pool.length; step += 1) {
    const candidate = pool[(index * 37 + step * 193) % pool.length];
    if (candidate && !options.includes(candidate)) options.push(candidate);
  }
  row.options = options;
}
if (rows.length < 6_500) throw new Error(`过滤后题目不足：${rows.length}`);
await mkdir(new URL(".", OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(rows));
console.log(`已导入 ${rows.length} 条独立 MKQA 中文题目。`);
