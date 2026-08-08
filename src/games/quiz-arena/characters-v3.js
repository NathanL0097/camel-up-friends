const CHARACTER_ROWS = [
  ["hinata", "日向雏田", ["雏田"], "Hinata Hyuuga"], ["itachi", "宇智波鼬", ["鼬"], "Itachi Uchiha"],
  ["gaara", "我爱罗", [], "Gaara"], ["jiraiya", "自来也", [], "Jiraiya"], ["tsunade", "纲手", [], "Tsunade"],
  ["orochimaru", "大蛇丸", [], "Orochimaru"], ["shikamaru", "奈良鹿丸", ["鹿丸"], "Shikamaru Nara"],
  ["neji", "日向宁次", ["宁次"], "Neji Hyuuga"], ["rocklee", "洛克·李", ["小李", "洛克李"], "Rock Lee"],
  ["minato", "波风水门", ["水门"], "Minato Namikaze"], ["nami", "娜美", [], "Nami"], ["sanji", "山治", [], "Sanji"],
  ["robin", "妮可·罗宾", ["罗宾", "妮可罗宾"], "Nico Robin"], ["franky", "弗兰奇", [], "Franky"], ["brook", "布鲁克", [], "Brook"],
  ["ace", "波特卡斯·D·艾斯", ["艾斯", "波特卡斯D艾斯"], "Portgas D. Ace"], ["sabo", "萨博", [], "Sabo"],
  ["shanks", "香克斯", ["红发香克斯"], "Shanks"], ["trafalgar", "特拉法尔加·罗", ["罗", "特拉法尔加罗"], "Trafalgar Law"],
  ["hancock", "波雅·汉库克", ["汉库克", "波雅汉库克"], "Boa Hancock"], ["inosuke", "嘴平伊之助", ["伊之助"], "Inosuke Hashibira"],
  ["giyu", "富冈义勇", ["义勇"], "Giyuu Tomioka"], ["shinobu", "蝴蝶忍", [], "Shinobu Kochou"],
  ["mitsuri", "甘露寺蜜璃", ["蜜璃"], "Mitsuri Kanroji"], ["muichiro", "时透无一郎", ["无一郎"], "Muichirou Tokitou"],
  ["tengen", "宇髓天元", ["天元"], "Tengen Uzui"], ["muzan", "鬼舞辻无惨", ["无惨"], "Muzan Kibutsuji"],
  ["kanao", "栗花落香奈乎", ["香奈乎"], "Kanao Tsuyuri"], ["genya", "不死川玄弥", ["玄弥"], "Genya Shinazugawa"],
  ["tamayo", "珠世", [], "Tamayo"], ["sukuna", "两面宿傩", ["宿傩"], "Ryomen Sukuna"], ["maki", "禅院真希", ["真希"], "Maki Zenin"],
  ["toge", "狗卷棘", ["棘"], "Toge Inumaki"], ["yuta", "乙骨忧太", ["忧太"], "Yuta Okkotsu"],
  ["nanami", "七海建人", ["七海"], "Kento Nanami"], ["geto", "夏油杰", ["夏油"], "Suguru Geto"],
  ["mahito", "真人", [], "Mahito"], ["toji", "伏黑甚尔", ["甚尔"], "Toji Fushiguro"], ["ran", "毛利兰", ["小兰"], "Ran Mouri"],
  ["kogoro", "毛利小五郎", ["小五郎"], "Kogorou Mouri"], ["haibara", "灰原哀", ["小哀"], "Ai Haibara"],
  ["heiji", "服部平次", ["平次"], "Heiji Hattori"], ["kaito", "黑羽快斗", ["怪盗基德", "基德"], "Kaito Kuroba"],
  ["akai", "赤井秀一", ["赤井"], "Shuichi Akai"], ["amuro", "安室透", ["降谷零"], "Tooru Amuro"],
  ["ash", "小智", ["萨智"], "Ash Ketchum"], ["misty", "小霞", [], "Misty Pokemon"], ["brock", "小刚", [], "Brock Pokemon"],
  ["meowth", "喵喵", [], "Meowth"], ["charizard", "喷火龙", [], "Charizard"], ["eevee", "伊布", [], "Eevee"],
  ["mercury", "水野亚美", ["水兵水星"], "Ami Mizuno"], ["mars", "火野丽", ["水兵火星"], "Rei Hino"],
  ["jupiter", "木野真琴", ["水兵木星"], "Makoto Kino"], ["venus", "爱野美奈子", ["水兵金星"], "Minako Aino"],
  ["tuxedo", "地场卫", ["夜礼服假面"], "Mamoru Chiba"], ["bulma", "布尔玛", [], "Bulma"], ["piccolo", "比克", ["短笛"], "Piccolo"],
  ["gohan", "孙悟饭", ["悟饭"], "Gohan Son"], ["frieza", "弗利萨", [], "Frieza"]
];

const CHARACTER_IMAGE_QUERIES = Object.fromEntries(CHARACTER_ROWS.map(([key, _answer, _aliases, query]) => [key, query]));
const CHARACTER_QUESTIONS = CHARACTER_ROWS.map(([key, answer, aliases], index) => ({
  id: `character-v3-${key}`,
  knowledgeKey: `character-v3-${key}`,
  category: "动漫角色",
  pack: "party",
  kind: "image-fill",
  prompt: "请填写图中角色的完整姓名",
  answer,
  aliases: [answer, ...aliases],
  answerLength: [...answer].filter((character) => !/[·.\s]/.test(character)).length,
  options: [],
  optionType: "character-name",
  difficulty: "easy",
  imageUrl: `/api/games/quiz-arena/character-image/${key}`,
  explanation: `图中角色是${answer}。`,
  source: "全新角色图鉴题包",
  updatedAt: "2026-08-08",
  order: index
}));

module.exports = { CHARACTER_IMAGE_QUERIES, CHARACTER_QUESTIONS };
