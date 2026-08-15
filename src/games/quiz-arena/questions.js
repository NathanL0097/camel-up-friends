const CURATED_SOURCE = require("./curated-questions.json");
const STRUCTURED_SOURCE = require("./structured-questions.json");
const { CHARACTER_IMAGE_QUERIES, CHARACTER_IMAGE_TERMS, CHARACTER_QUESTIONS } = require("./characters-v3");
const { MANUAL_QUESTIONS } = require("./manual-facts-v3");
const { CHINA_FEATURED_QUESTIONS } = require("./china-featured");
const { CHINA_EXPANSION_QUESTIONS } = require("./china-expansion-v6");
const { chinaFirstQuestion } = require("./china-policy");
const { preserveOfficialProperNouns } = require("./foreign-proper-nouns");
const { auditQuestionBank, validateQuestion } = require("./question-quality");

const CATEGORIES = ["生活常识", "历史", "地理", "科学与科技", "体育", "影视", "音乐", "游戏与网络文化", "美食", "文学艺术", "自然动物", "趣味冷知识", "动漫角色"];
const PARTY_CATEGORIES = new Set(["影视", "音乐", "游戏与网络文化", "美食", "动漫角色"]);
const FOOD_WORDS = /食物|食品|烹饪|菜肴|饮料|水果|蔬菜|咖啡|茶|面包|蛋糕|巧克力|奶酪|鸡尾酒|葡萄酒|啤酒|餐厅|厨房|调味|甜点/;
const NETWORK_WORDS = /互联网|网络用语|社交媒体|视频网站|直播|表情包|网红|短视频|播客|YouTube|TikTok|Twitter|微博|微信|哔哩哔哩/iu;
// 这些问法往往依赖剧集细节、过期赛事数据或死记冷僻数字，不适合朋友聚会。
// 年代、人物与作品常识仍保留在人工核验题和结构化题中。
const COLD_DETAIL = /(第\s*\d+|第几|章节|本章|倒数第|哪一集|第几集|哪一季|赛季|哪一年|什么时候|何时|有多少|多少个|多少只|第一个|第二个|第三个|谁是.*第|何时去世|什么时候去世|出生于哪个国家|票房|奥斯卡.*提名|艾美奖|格莱美奖|排行榜第|广告中|书中|小说中|最后一幕|哪两名.*成员|哪支球队|哪位球员|哪位演员|饰演|扮演|情节|剧情|结局|杀了多少|专辑.*第|歌曲.*发行|电影.*出品|电影.*拍摄|赛季|冠军|比赛|得分|本垒打|联盟|球队|教练|运动员人数|摩托车|魔法部|格兰芬多|霍格沃茨|根据《战争机器》)/i;
const META_OPTIONS = /(这些答案|以上都|都不是|两者|所有这些|这些都|以上皆是|以上都不是)/;
const VAGUE_OPENING = /^(这个|这些|这种|这位|这项|以下哪项陈述)/;
const CHILDREN_FAIRY = /童话|安徒生|格林|白雪公主|灰姑娘|小红帽|睡美人|匹诺曹|豌豆公主|拇指姑娘|长发公主|彼得潘|爱丽丝|小王子|儿童文学/;
const FOREIGN_FILM = /泰坦尼克号|盗梦空间|侏罗纪公园|阿甘正传|指环王|千与千寻|这个杀手不太冷|楚门的世界|寄生虫|教父/;
const BAD_TRANSLATION = /确切文本未知|文本未知|答案未知|无法确定原文|麻将[^？]*(?:乒乓球|松狮犬|金刚)|在\s*\d+\s*张麻将|七个主要国家流域|哪个国家仅次于长江的第二大河流|这个国家\/地区|命名(?:这|一|该)|说出说：/;
const ENTERTAINMENT_IN_TRIVIA = /《|》|电视节目|电视剧|连续剧|动画|电影|影集|剧集|演员|角色|情节|剧情|小说|读物|书中|故事中|哪一集|哪一季|哈利|罗恩|赫敏|霍格沃茨|格里芬多|星球大战|漫威|DC|迪士尼|尼克儿童|卡通频道|柳林风声|神奇宠物|银椅|Webkinz/iu;
const REJECTED_QUESTION_KEYS = new Set(["quiz-v3-00142"]);

function allowedQuestionContent(question) {
  if (REJECTED_QUESTION_KEYS.has(question.knowledgeKey)) return false;
  const text = `${question.prompt || ""} ${question.answer || ""} ${question.explanation || ""}`;
  const allText = `${text} ${(question.options || []).join(" ")}`;
  if (BAD_TRANSLATION.test(allText)) return false;
  if (CHILDREN_FAIRY.test(text)) return false;
  if (FOREIGN_FILM.test(text)) return false;
  if (question.category === "趣味冷知识" && ENTERTAINMENT_IN_TRIVIA.test(allText)) return false;
  if (question.category === "影视") return Boolean(question.chinaFeatured) || (question.source === "公开电影常识核验题" && !FOREIGN_FILM.test(text));
  if (question.category === "音乐") return Boolean(question.chinaFeatured);
  return true;
}

function refineCategory(question) {
  const text = `${question.prompt} ${question.answer}`;
  if (["科学", "科技"].includes(question.category)) return "科学与科技";
  if (["游戏", "网络文化"].includes(question.category)) return "游戏与网络文化";
  if (["生活常识", "趣味冷知识"].includes(question.category) && FOOD_WORDS.test(text)) return "美食";
  if (["生活常识", "趣味冷知识", "影视", "音乐"].includes(question.category) && NETWORK_WORDS.test(text)) return "游戏与网络文化";
  return question.category;
}

function sourceFunScore(question) {
  let score = question.difficulty === "easy" ? 8 : question.difficulty === "medium" ? 4 : 0;
  if (question.optionType !== "source-set") score += 3;
  if ([...question.prompt].length <= 42) score += 3;
  if (/首都|最大|最小|作者|发明|发现|行星|海洋|大洲|人体|动物|语言|国家|成语|诗人|朝代|元素|器官|货币|颜色/.test(question.prompt)) score += 4;
  score -= (question.prompt.match(/[A-Za-z]+/g) || []).length * 2;
  if (/宇宙中|系列中|主人公|校长|队长|大副|魔法|精灵|角色|哪一部.*作品/.test(question.prompt)) score -= 8;
  if (/哪种颜色|哪个国家|哪座城市|哪位作家|哪位科学家|哪种动物|哪种语言|哪项运动/.test(question.prompt)) score += 2;
  return score;
}

const structuredQuestions = [...new Map(STRUCTURED_SOURCE.map((question) => [question.id, question])).values()]
  .filter((question) => validateQuestion(question).valid)
  .map((question) => preserveOfficialProperNouns({ ...question, category: refineCategory(question) }))
  .filter(allowedQuestionContent);
const curatedCandidates = CURATED_SOURCE.filter((question) => {
  if (!validateQuestion(question).valid || !allowedQuestionContent(question) || VAGUE_OPENING.test(question.prompt)) return false;
  if (question.options.some((option) => META_OPTIONS.test(option))) return false;
  return (question.prompt.match(/[A-Za-z]+/g) || []).length <= 5;
}).map((question) => ({ ...question, category: refineCategory(question) }));
const manualQuestions = MANUAL_QUESTIONS.filter(allowedQuestionContent);
const ACTIVE_COUNT = 5000;
const RESERVE_COUNT = 5250;
const neededCurated = RESERVE_COUNT - structuredQuestions.length - manualQuestions.length - CHARACTER_QUESTIONS.length - CHINA_FEATURED_QUESTIONS.length - CHINA_EXPANSION_QUESTIONS.length;
const curatedQuotas = new Map([
  ["生活常识", 560], ["美食", 0], ["趣味冷知识", 100], ["地理", 300], ["历史", 260],
  ["科学与科技", 400], ["自然动物", 200], ["文学艺术", 350], ["体育", 100],
  ["音乐", 0], ["游戏与网络文化", 60], ["影视", 0]
]);
const selectedCurated = [];
for (const [category, quota] of curatedQuotas) {
  const pool = curatedCandidates.filter((question) => question.category === category)
    .sort((a, b) => sourceFunScore(b) - sourceFunScore(a) || a.prompt.length - b.prompt.length || a.id.localeCompare(b.id));
  if (pool.length < quota) throw new Error(`精品题源不足：${category} 需要 ${quota} 道，现有 ${pool.length} 道`);
  selectedCurated.push(...pool.slice(0, quota));
}
if (selectedCurated.length < neededCurated) {
  const selectedIds = new Set(selectedCurated.map((question) => question.id));
  selectedCurated.push(...curatedCandidates.filter((question) => !selectedIds.has(question.id))
    .sort((a, b) => sourceFunScore(b) - sourceFunScore(a) || a.id.localeCompare(b.id))
    .slice(0, neededCurated - selectedCurated.length));
}
if (neededCurated < 0 || selectedCurated.length !== neededCurated) throw new Error(`精品题源配额错误：需要 ${neededCurated} 道，实际 ${selectedCurated.length} 道`);

const combinedQuestions = [...structuredQuestions, ...manualQuestions, ...selectedCurated, ...CHINA_FEATURED_QUESTIONS, ...CHINA_EXPANSION_QUESTIONS, ...CHARACTER_QUESTIONS].filter(allowedQuestionContent);
function playabilityScore(question) {
  if (question.source?.startsWith("公开")) return 140;
  if (question.source === "全新角色图鉴题包") return 90;
  if (question.source?.startsWith("Wikidata")) return 20 + Math.min(100, Number(question.popularity || 0) / 2);
  return 30 + sourceFunScore(question);
}
combinedQuestions.sort((a, b) => {
  return playabilityScore(b) - playabilityScore(a) || Number(b.popularity || 0) - Number(a.popularity || 0) || a.id.localeCompare(b.id);
});
const QUESTION_RESERVE = combinedQuestions.map((question, index) => ({
  ...question,
  category: refineCategory(question),
  pack: PARTY_CATEGORIES.has(refineCategory(question)) ? "party" : "classic",
  difficulty: index < 3000 ? "easy" : index < 4500 ? "medium" : "hard",
  aliases: [...new Set(question.aliases || [question.answer])],
  options: [...(question.options || [])]
}));

if (QUESTION_RESERVE.length !== RESERVE_COUNT) throw new Error(`站神候补题库数量错误：需要 ${RESERVE_COUNT} 道，实际 ${QUESTION_RESERVE.length} 道`);
const LOCAL_QUESTIONS = QUESTION_RESERVE.slice(0, ACTIVE_COUNT);
function activeLocalQuestions(retiredKeys = []) {
  const retired = retiredKeys instanceof Set ? retiredKeys : new Set(retiredKeys || []);
  return QUESTION_RESERVE.filter((question) => !retired.has(question.knowledgeKey)).slice(0, ACTIVE_COUNT);
}

const localAudit = auditQuestionBank(LOCAL_QUESTIONS, { expectedCount: ACTIVE_COUNT });
if (!localAudit.valid) throw new Error(`站神题库质量审计失败：${JSON.stringify(localAudit.failures.slice(0, 8))}`);

let remoteQuestions = [];
function validateRemoteQuestion(question, index) {
  if (!question || typeof question.prompt !== "string" || typeof question.answer !== "string" || !CATEGORIES.includes(question.category)) return null;
  const answer = question.answer.trim().slice(0, 80);
  const prompt = question.prompt.trim().slice(0, 240);
  const options = Array.isArray(question.options) ? question.options.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 4) : [];
  const candidate = {
    id: `remote-${String(question.id || index).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || index}`,
    knowledgeKey: `remote-${String(question.knowledgeKey || question.id || index).slice(0, 80)}`,
    category: question.category,
    pack: PARTY_CATEGORIES.has(question.category) ? "party" : "classic",
    kind: ["choice", "judge", "fill"].includes(question.kind) ? question.kind : "choice",
    prompt,
    answer,
    aliases: [...new Set([answer, ...(Array.isArray(question.aliases) ? question.aliases.map(String) : [])])].slice(0, 8),
    answerLength: Math.max(1, Math.min(40, Number(question.answerLength) || [...answer].length)),
    options: options.includes(answer) ? options : [answer, ...options].slice(0, 4),
    optionType: String(question.optionType || "source-set").slice(0, 40),
    difficulty: ["easy", "medium", "hard"].includes(question.difficulty) ? question.difficulty : "medium",
    explanation: String(question.explanation || `正确答案是“${answer}”。`).slice(0, 300),
    source: String(question.source || "在线题包").slice(0, 80),
    updatedAt: String(question.updatedAt || new Date().toISOString().slice(0, 10)).slice(0, 10)
  };
  return validateQuestion(candidate).valid ? candidate : null;
}

function installRemoteQuestions(items) {
  remoteQuestions = Array.isArray(items) ? items.map(validateRemoteQuestion).filter(Boolean).slice(0, 20_000) : [];
  return remoteQuestions.length;
}

function getQuestionBank(retiredKeys = []) { return [...remoteQuestions, ...activeLocalQuestions(retiredKeys)]; }
function questionPackInfo() {
  const difficulty = Object.fromEntries(["easy", "medium", "hard"].map((level) => [level, LOCAL_QUESTIONS.filter((item) => item.difficulty === level).length]));
  return {
    localCount: LOCAL_QUESTIONS.length,
    remoteCount: remoteQuestions.length,
    total: LOCAL_QUESTIONS.length + remoteQuestions.length,
    reserveCount: QUESTION_RESERVE.length,
    version: "2026.08.16-cn-audited-refill-v9",
    categories: CATEGORIES,
    independentCount: new Set(LOCAL_QUESTIONS.map((question) => question.knowledgeKey)).size,
    audited: true,
    localePolicy: "china-first",
    properNounPolicy: "china-film-music-only-no-fairy-tales",
    difficulty
  };
}

module.exports = { CATEGORIES, CHARACTER_IMAGE_QUERIES, CHARACTER_IMAGE_TERMS, CHILD_CHARACTER_IMAGE_URLS: {}, LOCAL_QUESTIONS, QUESTION_RESERVE, activeLocalQuestions, getQuestionBank, installRemoteQuestions, questionPackInfo, chinaFirstQuestion };
