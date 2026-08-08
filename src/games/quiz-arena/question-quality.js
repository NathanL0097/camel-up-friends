const ALLOWED_KINDS = new Set(["choice", "judge", "fill", "image-fill"]);
const STRONG_TYPES = new Set(["year", "number", "person", "country", "city", "animal", "character-name"]);
const GARBAGE = /�|__[QO]\d|\b(undefined|null|nan|xewartqwe|jeice)\b/i;

function clean(value) { return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim(); }
function optionShape(value) {
  const text = clean(value);
  if (/^(?:公元前?\s*)?\d{3,4}(?:\s*年)?(?:\s*[-–至]\s*\d{2,4}(?:\s*年)?)?$/.test(text)) return "year";
  if (/^[\d.,/%+\-–至~～\s年月日公里千米米厘米毫米英里英尺千克公斤克吨秒分钟小时天周岁元美元英镑欧元]+$/.test(text) && /\d/.test(text)) return "number";
  if (/^[A-Za-z][A-Za-z .'-]{0,30}$/.test(text)) return "latin-name";
  if (/^[\p{Script=Han}·•・\sA-Za-z.'-]+$/u.test(text)) return "text-name";
  return "mixed";
}

function validateQuestion(question) {
  const errors = [];
  if (!question || !clean(question.id) || !clean(question.knowledgeKey)) errors.push("missing-id");
  if (!clean(question.prompt) || !clean(question.answer)) errors.push("missing-text");
  if (!ALLOWED_KINDS.has(question.kind)) errors.push("invalid-kind");
  if (!clean(question.optionType)) errors.push("missing-option-type");
  if (GARBAGE.test([question.prompt, question.answer, ...(question.options || [])].join(" "))) errors.push("garbage-text");
  if (question.kind === "choice") {
    const options = Array.isArray(question.options) ? question.options.map(clean) : [];
    if (options.length !== 4) errors.push("choice-count");
    if (new Set(options.map((item) => item.toLowerCase())).size !== 4) errors.push("duplicate-choice");
    if (!options.includes(clean(question.answer))) errors.push("answer-not-in-options");
    const shapes = options.map(optionShape);
    if (question.optionType === "year" && shapes.some((shape) => shape !== "year")) errors.push("year-type-mismatch");
    if (question.optionType === "number" && shapes.some((shape) => !["number", "year"].includes(shape))) errors.push("number-type-mismatch");
    if (["person", "country", "city", "animal"].includes(question.optionType) && options.some((item) => /\d{3,}/.test(item))) errors.push("named-type-has-number");
    if (["person", "country", "city", "animal"].includes(question.optionType) && options.some((item) => /^(出生|死亡|未知|没有|全部|以上|以下|无)$/i.test(item))) errors.push("named-type-has-placeholder");
    const numericFlags = options.map((item) => /^[-+]?\d|\d[%年月日公里千米米厘米毫米英里英尺千克公斤克吨秒分钟小时天周岁元美元英镑欧元]/.test(item));
    if (numericFlags.some(Boolean) && !numericFlags.every(Boolean)) errors.push("mixed-number-and-text");
    const singleLatinFlags = options.map((item) => /^[A-Za-z]$/.test(item));
    if (singleLatinFlags.some(Boolean) && !singleLatinFlags.every(Boolean)) errors.push("mixed-single-letter");
    const lengths = options.map((item) => [...item].length).filter(Boolean);
    if (Math.max(...lengths) > Math.max(18, Math.min(...lengths) * 5)) errors.push("choice-length-outlier");
  }
  if (question.kind === "image-fill" && (!question.imageUrl || (question.options || []).length)) errors.push("invalid-image-question");
  return { valid: errors.length === 0, errors };
}

function auditQuestionBank(questions, { expectedCount } = {}) {
  const failures = [];
  const ids = new Set();
  const keys = new Set();
  for (const question of questions) {
    const result = validateQuestion(question);
    if (!result.valid) failures.push({ id: question?.id, errors: result.errors });
    if (ids.has(question.id)) failures.push({ id: question.id, errors: ["duplicate-id"] });
    if (keys.has(question.knowledgeKey)) failures.push({ id: question.id, errors: ["duplicate-knowledge-key"] });
    ids.add(question.id); keys.add(question.knowledgeKey);
  }
  if (expectedCount && questions.length !== expectedCount) failures.push({ id: "bank", errors: [`expected-${expectedCount}-got-${questions.length}`] });
  return { valid: failures.length === 0, failures, count: questions.length, strongTypedCount: questions.filter((item) => STRONG_TYPES.has(item.optionType)).length };
}

module.exports = { auditQuestionBank, optionShape, validateQuestion };
