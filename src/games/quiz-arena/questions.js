const { CHARACTER_IMAGE_QUERIES, CHARACTER_IMAGE_TERMS, CHARACTER_QUESTIONS } = require("./characters-v3");
const { MANUAL_QUESTIONS } = require("./manual-facts-v3");
const { CHINA_FEATURED_QUESTIONS } = require("./china-featured");
const { CHINA_EXPANSION_QUESTIONS } = require("./china-expansion-v6");
const { CLASSIC_TV_QUESTIONS } = require("./classic-tv-questions");
const { NATURE_QUESTIONS } = require("./nature-questions");
const { chinaFirstQuestion } = require("./china-policy");
const { auditQuestionBank, validateQuestion } = require("./question-quality");

const CATEGORIES = ["生活常识", "历史", "地理", "科学与科技", "体育", "影视", "音乐", "游戏与网络文化", "美食", "文学艺术", "自然动物", "趣味冷知识", "人物识图"];
const PARTY_CATEGORIES = new Set(["影视", "音乐", "游戏与网络文化", "美食", "人物识图"]);
const FOOD_WORDS = /食物|食品|烹饪|菜肴|饮料|水果|蔬菜|咖啡|茶|面包|蛋糕|巧克力|奶酪|鸡尾酒|葡萄酒|啤酒|餐厅|厨房|调味|甜点/;
const NETWORK_WORDS = /互联网|网络用语|社交媒体|视频网站|直播|表情包|网红|短视频|播客|YouTube|TikTok|Twitter|微博|微信|哔哩哔哩/iu;
// 这些问法往往依赖剧集细节、过期赛事数据或死记冷僻数字，不适合朋友聚会。
// 年代、人物与作品常识仍保留在人工核验题和结构化题中。
const COLD_DETAIL = /(第\s*\d+|第几|章节|本章|倒数第|哪一集|第几集|哪一季|赛季|哪一年|什么时候|何时|有多少|多少个|多少只|第一个|第二个|第三个|谁是.*第|何时去世|什么时候去世|出生于哪个国家|票房|奥斯卡.*提名|艾美奖|格莱美奖|排行榜第|广告中|书中|小说中|最后一幕|哪两名.*成员|哪支球队|哪位球员|哪位演员|饰演|扮演|情节|剧情|结局|杀了多少|专辑.*第|歌曲.*发行|电影.*出品|电影.*拍摄|赛季|冠军|比赛|得分|本垒打|联盟|球队|教练|运动员人数|摩托车|魔法部|格兰芬多|霍格沃茨|根据《战争机器》)/i;
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

const manualQuestions = MANUAL_QUESTIONS.filter(allowedQuestionContent);
// OpenTrivia 旧题源经过大量样本审核后确认存在机器翻译、错类选项和冷门外国娱乐污染，
// 因此整个题源停用，不再为了凑数量从中挑题。
// 结构化 Wikidata 批量题虽然事实可追溯，但“首都/国家反问”、“公司创始人”、
// “游戏开发商”都是同一模板批量换名词，不符合玩家要求的语义独立性，因此也停止投放。
const combinedQuestions = [...manualQuestions, ...CHINA_FEATURED_QUESTIONS, ...CHINA_EXPANSION_QUESTIONS, ...CLASSIC_TV_QUESTIONS, ...NATURE_QUESTIONS, ...CHARACTER_QUESTIONS].filter(allowedQuestionContent);
function playabilityScore(question) {
  if (question.chinaFeatured) return 150;
  if (question.source?.startsWith("公开")) return 140;
  if (question.source === "Wikidata唯一实体人像题包") return 145;
  if (question.source?.startsWith("Wikidata")) return 20 + Math.min(100, Number(question.popularity || 0) / 2);
  return 30 + sourceFunScore(question);
}
combinedQuestions.sort((a, b) => {
  return playabilityScore(b) - playabilityScore(a) || Number(b.popularity || 0) - Number(a.popularity || 0) || a.id.localeCompare(b.id);
});
function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

const THEME_CAPS = [[/拿破仑/i, 2], [/奥运|奥林匹克/i, 3], [/马里奥|马力欧|mario/i, 2], [/哈利·波特|哈利波特/i, 2]];
const themeCounts = new Map();
const promptKeys = new Set();
const knowledgeKeys = new Set();
const answerCounts = new Map();
const independentQuestions = combinedQuestions.filter((question) => {
  const promptKey = normalizeText(question.kind === "image-fill" ? `${question.prompt}${question.answer}` : question.prompt);
  if (!promptKey || promptKeys.has(promptKey) || knowledgeKeys.has(question.knowledgeKey)) return false;
  const text = `${question.prompt} ${question.answer} ${question.explanation || ""}`;
  for (const [pattern, cap] of THEME_CAPS) {
    if (!pattern.test(text)) continue;
    const key = String(pattern);
    if ((themeCounts.get(key) || 0) >= cap) return false;
    themeCounts.set(key, (themeCounts.get(key) || 0) + 1);
  }
  // 同一领域反复围绕同一答案出题会造成“换个问法当新题”。
  // 判断题和用户指定的经典电视专题例外，其余每个答案在单一领域最多4道。
  const answerKey = `${question.category}:${normalizeText(question.answer)}`;
  const capAnswer = question.kind !== "judge" && question.source !== "中国经典电视剧人工核验题";
  if (capAnswer && (answerCounts.get(answerKey) || 0) >= 4) return false;
  promptKeys.add(promptKey);
  knowledgeKeys.add(question.knowledgeKey);
  if (capAnswer) answerCounts.set(answerKey, (answerCounts.get(answerKey) || 0) + 1);
  return true;
});

const QUESTION_RESERVE = independentQuestions.filter(chinaFirstQuestion).map((question) => ({
  ...question,
  category: refineCategory(question),
  pack: PARTY_CATEGORIES.has(refineCategory(question)) ? "party" : "classic",
  difficulty: ["easy", "medium", "hard"].includes(question.difficulty) ? question.difficulty : "medium",
  aliases: [...new Set(question.aliases || [question.answer])],
  options: [...(question.options || [])]
}));

const LOCAL_QUESTIONS = [...QUESTION_RESERVE];
function activeLocalQuestions(retiredKeys = []) {
  const retired = retiredKeys instanceof Set ? retiredKeys : new Set(retiredKeys || []);
  return QUESTION_RESERVE.filter((question) => !retired.has(question.knowledgeKey));
}

const localAudit = auditQuestionBank(LOCAL_QUESTIONS, { expectedCount: LOCAL_QUESTIONS.length });
if (!localAudit.valid) throw new Error(`站神题库质量审计失败：${JSON.stringify(localAudit.failures.slice(0, 8))}`);

let remoteQuestions = [];
function validateRemoteQuestion(question, index) {
  // 在线题包只作为未来人工补题通道。没有明确审核标记的批量抓取、翻译或模型生成内容
  // 不允许进入正式题库，避免服务器定时刷新后重新混入已经清理掉的坏题。
  if (!question?.humanReviewed || typeof question.prompt !== "string" || typeof question.answer !== "string" || !CATEGORIES.includes(question.category)) return null;
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
  return validateQuestion(candidate).valid && allowedQuestionContent(candidate) && chinaFirstQuestion(candidate) ? candidate : null;
}

function installRemoteQuestions(items) {
  const localKeys = new Set(LOCAL_QUESTIONS.map((question) => question.knowledgeKey));
  const localPrompts = new Set(LOCAL_QUESTIONS.map((question) => normalizeText(question.prompt)));
  const seenKeys = new Set();
  const seenPrompts = new Set();
  remoteQuestions = (Array.isArray(items) ? items : []).map(validateRemoteQuestion).filter((question) => {
    if (!question) return false;
    const promptKey = normalizeText(question.prompt);
    if (localKeys.has(question.knowledgeKey) || localPrompts.has(promptKey) || seenKeys.has(question.knowledgeKey) || seenPrompts.has(promptKey)) return false;
    seenKeys.add(question.knowledgeKey);
    seenPrompts.add(promptKey);
    return true;
  }).slice(0, 20_000);
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
    version: "2026.08.17-human-reviewed-independent-v12",
    categories: CATEGORIES,
    independentCount: new Set(LOCAL_QUESTIONS.map((question) => question.knowledgeKey)).size,
    audited: true,
    localePolicy: "china-first",
    properNounPolicy: "china-film-music-only-no-fairy-tales",
    difficulty
  };
}

module.exports = { CATEGORIES, CHARACTER_IMAGE_QUERIES, CHARACTER_IMAGE_TERMS, CHILD_CHARACTER_IMAGE_URLS: {}, LOCAL_QUESTIONS, QUESTION_RESERVE, activeLocalQuestions, getQuestionBank, installRemoteQuestions, questionPackInfo, chinaFirstQuestion };
