// 图片题只使用 Wikidata 唯一实体编号，不再根据人名或作品名模糊搜图。
const PORTRAIT_ROWS = [
  ["jackie-chan", "成龙", ["陈港生"], "Q36970", "china", "Jackie Chan - 2025 Locarno Film Festival.jpg"],
  ["andy-lau", "刘德华", [], "Q16766", "china", "Andy Lau 刘德华, Beijing International Film Festival 北京电影节, 2013 (cropped).jpg"],
  ["jay-chou", "周杰伦", [], "Q238819", "china", "咪咕音乐盛典 (25).jpg"],
  ["michelle-yeoh", "杨紫琼", [], "Q214289", "china", "Michelle Yeoh-2268.jpg"],
  ["zhang-ziyi", "章子怡", [], "Q180852", "china", "Zhang Ziyi the Jury President at Opening Ceremony of the Tokyo International Film Festival 2019 (49013444988) (cropped).jpg"],
  ["gong-li", "巩俐", [], "Q150903", "china", "Gong Li Cannes 2016.jpg"],
  ["wu-jing", "吴京", [], "Q710715", "china", "Wu Jing (Wolf Warrior 2).jpg"],
  ["stephen-chow", "周星驰", ["星爷"], "Q311179", "china", "Stephen Chow, 2008 (cropped).JPG"],
  ["leonardo-dicaprio", "莱昂纳多·迪卡普里奥", ["莱昂纳多迪卡普里奥"], "Q38111", "world", "Leonardo DiCaprio - BFI Southbank 3 (crop).jpg"],
  ["tom-cruise", "汤姆·克鲁斯", ["汤姆克鲁斯"], "Q37079", "world", "Tom Cruise at 53rd Saturn Awards 2026-01.jpg"],
  ["taylor-swift", "泰勒·斯威夫特", ["泰勒斯威夫特"], "Q26876", "world", "Taylor Swift at the 2023 MTV Video Music Awards (3).png"],
  ["adele", "阿黛尔", ["Adele"], "Q23215", "world", "Adele 2016.jpg"],
  ["michael-jackson", "迈克尔·杰克逊", ["迈克尔杰克逊"], "Q2831", "world", "Michael Jackson in 1988.jpg"],
  ["cristiano-ronaldo", "克里斯蒂亚诺·罗纳尔多", ["克里斯蒂亚诺罗纳尔多", "C罗"], "Q11571", "world", "Cristiano Ronaldo Croatia v Portugal 2 July 2026-075 (cropped).jpg"],
  ["lionel-messi", "利昂内尔·梅西", ["利昂内尔梅西", "梅西"], "Q615", "world", "Leo Messi Argentina v Egypt 7 July 2026-1.jpg"],
  ["david-beckham", "大卫·贝克汉姆", ["大卫贝克汉姆", "贝克汉姆"], "Q10520", "world", "David Beckham 2009.jpg"],
  ["beyonce", "碧昂丝", ["Beyoncé"], "Q36153", "world", "Beyoncé - Tottenham Hotspur Stadium - 1st June 2023 (10 of 118) (52946364598) (best crop).jpg"],
  ["lady-gaga", "Lady Gaga", ["嘶嘶小姐"], "Q19848", "world", "Lady Gaga at Oscars 2016.jpg"],
  ["emma-watson", "艾玛·沃森", ["艾玛沃森"], "Q39476", "world", "Emma Watson 2013.jpg"]
];

const CHARACTER_IMAGE_QUERIES = Object.fromEntries(PORTRAIT_ROWS.map(([key, answer]) => [key, answer]));
const CHARACTER_IMAGE_TERMS = Object.fromEntries(PORTRAIT_ROWS.map(([key, answer, _aliases, wikidataId, region, filename]) => [key, {
  label: answer, wikidataId, region, filename
}]));
const CHARACTER_QUESTIONS = PORTRAIT_ROWS.map(([key, answer, aliases, _wikidataId, region], index) => ({
  id: `portrait-v1-${key}`, knowledgeKey: `portrait-v1-${key}`, category: "人物识图", pack: "party", kind: "image-fill",
  prompt: "请填写图中人物的姓名", answer, aliases: [answer, ...aliases],
  answerLength: [...answer].filter((character) => !/[\s·.]/.test(character)).length,
  options: [], optionType: "portrait-name", difficulty: "easy",
  imageUrl: `/api/games/quiz-arena/character-image/${key}?v=portrait-20260816`, explanation: `图中人物是${answer}。`,
  source: "Wikidata唯一实体人像题包", updatedAt: "2026-08-16", order: index,
  chinaFeatured: region === "china", worldFamous: region === "world"
}));

module.exports = { CHARACTER_IMAGE_QUERIES, CHARACTER_IMAGE_TERMS, CHARACTER_QUESTIONS };
