const CHARACTER_ROWS = [
  ["sunwukong", "孙悟空", ["齐天大圣"], "孙悟空 西游记 动画 角色", "china"],
  ["nezha", "哪吒", [], "哪吒 国产动画 角色", "china"], ["aobing", "敖丙", [], "敖丙 哪吒之魔童降世", "china"],
  ["heimao", "黑猫警长", [], "黑猫警长 动画", "china"], ["yizhier", "一只耳", [], "一只耳 黑猫警长", "china"],
  ["shuke", "舒克", [], "舒克贝塔 舒克", "china"], ["beita", "贝塔", [], "舒克贝塔 贝塔", "china"],
  ["lanmao", "蓝猫", [], "蓝猫淘气三千问 蓝猫", "china"], ["taoqi", "淘气", [], "蓝猫淘气三千问 淘气", "china"],
  ["hongmao", "虹猫", [], "虹猫蓝兔七侠传 虹猫", "china"], ["lantu", "蓝兔", [], "虹猫蓝兔七侠传 蓝兔", "china"],
  ["xiyangyang", "喜羊羊", [], "喜羊羊与灰太狼 喜羊羊", "china"], ["huitailang", "灰太狼", [], "喜羊羊与灰太狼 灰太狼", "china"],
  ["meiyangyang", "美羊羊", [], "喜羊羊与灰太狼 美羊羊", "china"], ["lanyangyang", "懒羊羊", [], "喜羊羊与灰太狼 懒羊羊", "china"],
  ["xiaohuihui", "小灰灰", [], "喜羊羊与灰太狼 小灰灰", "china"], ["xiongda", "熊大", [], "熊出没 熊大", "china"],
  ["xionger", "熊二", [], "熊出没 熊二", "china"], ["guangtouqiang", "光头强", [], "熊出没 光头强", "china"],
  ["datouerzi", "大头儿子", ["头太元"], "大头儿子和小头爸爸 大头儿子", "china"],
  ["xiaotoubaba", "小头爸爸", [], "大头儿子和小头爸爸 小头爸爸", "china"], ["weiqunmama", "围裙妈妈", [], "大头儿子和小头爸爸 围裙妈妈", "china"],
  ["hututu", "胡图图", ["图图"], "大耳朵图图 胡图图", "china"], ["niuyeye", "牛爷爷", [], "大耳朵图图 牛爷爷", "china"],
  ["zhuzhuxia", "猪猪侠", [], "猪猪侠 动画", "china"], ["feifei", "菲菲", [], "猪猪侠 菲菲", "china"],
  ["chaorenqiang", "超人强", [], "猪猪侠 超人强", "china"], ["chengliuxiang", "橙留香", [], "果宝特攻 橙留香", "china"],
  ["boluochuixue", "菠萝吹雪", [], "果宝特攻 菠萝吹雪", "china"], ["shangguanziyi", "上官子怡", [], "果宝特攻 上官子怡", "china"],
  ["luoluo", "洛洛", [], "武战道 洛洛 角色", "china"], ["jingjing", "晶晶", [], "武战道 晶晶 角色", "china"],
  ["afanti", "阿凡提", [], "阿凡提的故事 木偶动画", "china"], ["paopao", "泡泡", [], "小鲤鱼历险记 泡泡", "china"],
  ["luoxiaohei", "罗小黑", [], "罗小黑战记 罗小黑", "china"], ["wuxian", "无限", [], "罗小黑战记 无限", "china"],
  ["tushansusu", "涂山苏苏", [], "狐妖小红娘 涂山苏苏", "china"], ["baiyuekui", "白月魁", [], "灵笼 白月魁", "china"],
  ["fengbaobao", "冯宝宝", [], "一人之下 冯宝宝", "china"], ["zhangchulan", "张楚岚", [], "一人之下 张楚岚", "china"],
  ["doraemon", "哆啦A梦", ["机器猫"], "Doraemon character", "world"], ["nobita", "野比大雄", ["大雄"], "Nobita Doraemon", "world"],
  ["shinchan", "野原新之助", ["蜡笔小新", "小新"], "Shinnosuke Nohara", "world"], ["maruko", "樱桃子", ["樱桃小丸子", "小丸子"], "Chibi Maruko chan", "world"],
  ["pikachu", "皮卡丘", [], "Pikachu", "world"], ["conan", "江户川柯南", ["柯南"], "Conan Edogawa", "world"],
  ["luffy", "蒙奇·D·路飞", ["路飞", "蒙奇D路飞"], "Monkey D Luffy", "world"], ["naruto", "漩涡鸣人", ["鸣人"], "Naruto Uzumaki", "world"],
  ["mickey", "米老鼠", ["米奇"], "Mickey Mouse", "world"], ["donald", "唐老鸭", [], "Donald Duck", "world"],
  ["winnie", "小熊维尼", ["维尼"], "Winnie the Pooh", "world"], ["spongebob", "海绵宝宝", [], "SpongeBob SquarePants", "world"],
  ["patrick", "派大星", [], "Patrick Star", "world"], ["tom", "汤姆猫", ["汤姆"], "Tom and Jerry Tom", "world"],
  ["jerry", "杰瑞鼠", ["杰瑞"], "Tom and Jerry Jerry", "world"], ["mario", "马里奥", [], "Super Mario", "world"],
  ["hellokitty", "Hello Kitty", ["凯蒂猫"], "Hello Kitty", "world"], ["ultraman", "奥特曼", [], "Ultraman character", "world"],
  ["elsa", "艾莎", ["冰雪女王"], "Elsa Frozen", "world"], ["minion", "小黄人", [], "Minions character", "world"]
];

const CHARACTER_IMAGE_QUERIES = Object.fromEntries(CHARACTER_ROWS.map(([key, _answer, _aliases, query]) => [key, query]));
const WIKI_TITLE_OVERRIDES = {
  aobing: ["哪吒之魔童降世"], baiyuekui: ["灵笼"], beita: ["舒克和贝塔"], boluochuixue: ["果宝特攻"],
  chaorenqiang: ["猪猪侠"], chengliuxiang: ["果宝特攻"], datouerzi: ["大头儿子和小头爸爸"],
  feifei: ["飞天小女警"], fengbaobao: ["一人之下"], guangtouqiang: ["熊出没"], heimao: ["黑猫警长"],
  hongmao: ["虹猫蓝兔七侠传"], huitailang: ["喜羊羊与灰太狼"], hututu: ["大耳朵图图"],
  jingjing: ["大头儿子和小头爸爸"], lanmao: ["蓝猫淘气三千问"], lantu: ["虹猫蓝兔七侠传"],
  lanyangyang: ["喜羊羊与灰太狼"], luoluo: ["百变机兽之洛洛历险记"], luoxiaohei: ["罗小黑战记"],
  meiyangyang: ["喜羊羊与灰太狼"], nezha: ["哪吒之魔童降世"], niuyeye: ["大头儿子和小头爸爸"],
  paopao: ["飞天小女警"], shangguanziyi: ["神兵小将"], shuke: ["舒克和贝塔"], sunwukong: ["西游记"],
  taoqi: ["飞天小女警"], tushansusu: ["狐妖小红娘"], weiqunmama: ["大头儿子和小头爸爸"],
  wuxian: ["罗小黑战记"], xiaohuihui: ["喜羊羊与灰太狼"], xiaotoubaba: ["大头儿子和小头爸爸"],
  xiongda: ["熊出没"], xionger: ["熊出没"], xiyangyang: ["喜羊羊与灰太狼"],
  yizhier: ["大头儿子和小头爸爸"], zhangchulan: ["一人之下"], zhuzhuxia: ["猪猪侠"],
  minion: ["小小兵", "迷你兵团"], maruko: ["樱桃小丸子"], shinchan: ["蜡笔小新"],
  doraemon: ["哆啦A梦"], elsa: ["冰雪奇缘"], jerry: ["汤姆猫与杰利鼠"], mario: ["超级马力欧"],
  mickey: ["米奇老鼠"], nobita: ["哆啦A梦"], patrick: ["海绵宝宝"], spongebob: ["海绵宝宝"],
  tom: ["汤姆猫与杰利鼠"], ultraman: ["超人力霸王系列"]
};
// 只请求角色本名对应的百科页面。若精确页面没有图片，宁可显示备用图，
// 也不再拿宽泛搜索结果的第一张图片冒充角色。
const CHARACTER_IMAGE_TERMS = Object.fromEntries(CHARACTER_ROWS.map(([key, answer, _aliases, query, region]) => [key, {
  label: answer,
  wikiTitles: [answer, ...(WIKI_TITLE_OVERRIDES[key] || [])],
  anilistSearch: region === "world" ? query : null,
  region
}]));
const CHARACTER_QUESTIONS = CHARACTER_ROWS.map(([key, answer, aliases, _query, region], index) => ({
  id: `character-v3-${key}`, knowledgeKey: `character-v3-${key}`, category: "动漫角色", pack: "party", kind: "image-fill",
  prompt: "请填写图中角色的完整姓名", answer, aliases: [answer, ...aliases], answerLength: [...answer].filter((character) => !/[·.\s]/.test(character)).length,
  options: [], optionType: "character-name", difficulty: "easy", imageUrl: `/api/games/quiz-arena/character-image/${key}?v=verified-20260816`,
  explanation: `图中角色是${answer}。`, source: region === "china" ? "中国动画角色精选题包" : "全球知名动画角色题包",
  updatedAt: "2026-08-10", order: index, chinaFeatured: region === "china", worldFamous: region === "world"
}));

module.exports = { CHARACTER_IMAGE_QUERIES, CHARACTER_IMAGE_TERMS, CHARACTER_QUESTIONS };
