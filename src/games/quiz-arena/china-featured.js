const SONGS = [
  ["周杰伦", ["青花瓷", "晴天", "稻香", "七里香", "夜曲"]],
  ["邓丽君", ["月亮代表我的心", "甜蜜蜜", "我只在乎你", "小城故事", "但愿人长久"]],
  ["张学友", ["吻别", "一路上有你", "她来听我的演唱会", "如果这都不算爱", "心如刀割"]],
  ["王菲", ["红豆", "传奇", "容易受伤的女人", "匆匆那年", "执迷不悔"]],
  ["陈奕迅", ["十年", "浮夸", "孤勇者", "好久不见", "爱情转移"]],
  ["五月天", ["倔强", "温柔", "突然好想你", "知足", "恋爱ING"]],
  ["林俊杰", ["江南", "曹操", "修炼爱情", "可惜没如果", "她说"]],
  ["孙燕姿", ["遇见", "天黑黑", "开始懂了", "我怀念的", "绿光"]],
  ["Beyond", ["海阔天空", "光辉岁月", "真的爱你", "不再犹豫", "喜欢你"]],
  ["蔡依林", ["日不落", "倒带", "舞娘", "说爱你", "大艺术家"]]
];

const ARTISTS = SONGS.map(([artist]) => artist);
const CHINA_FEATURED_QUESTIONS = SONGS.flatMap(([artist, songs], artistIndex) => songs.map((song, songIndex) => {
  const distractors = [1, 3, 6].map((offset) => ARTISTS[(artistIndex + offset) % ARTISTS.length]);
  const options = [artist, ...distractors].slice(0, 4);
  return {
    id: `china-music-${String(artistIndex * 5 + songIndex + 1).padStart(3, "0")}`,
    knowledgeKey: `china-music-song-${artist}-${song}`,
    category: "音乐",
    pack: "party",
    kind: "choice",
    prompt: `歌曲《${song}》的代表性演唱者是谁？`,
    answer: artist,
    aliases: [artist],
    answerLength: [...artist].length,
    options,
    optionType: "person",
    difficulty: "easy",
    explanation: `《${song}》的代表性演唱者是${artist}。`,
    source: "中国大众音乐精选题",
    updatedAt: "2026-08-10",
    chinaFeatured: true
  };
}));

const FOOD_ROWS = [
  ["北京烤鸭", "北京"], ["驴打滚", "北京"], ["豌豆黄", "北京"], ["狗不理包子", "天津"], ["煎饼果子", "天津"],
  ["麻婆豆腐", "四川"], ["夫妻肺片", "四川"], ["回锅肉", "四川"], ["担担面", "四川"], ["毛血旺", "重庆"],
  ["重庆小面", "重庆"], ["西湖醋鱼", "浙江"], ["东坡肉", "浙江"], ["龙井虾仁", "浙江"], ["叫花鸡", "江苏"],
  ["盐水鸭", "江苏"], ["松鼠桂鱼", "江苏"], ["佛跳墙", "福建"], ["沙县小吃", "福建"], ["白切鸡", "广东"],
  ["广式肠粉", "广东"], ["叉烧", "广东"], ["螺蛳粉", "广西"], ["桂林米粉", "广西"], ["过桥米线", "云南"],
  ["汽锅鸡", "云南"], ["羊肉泡馍", "陕西"], ["肉夹馍", "陕西"], ["臊子面", "陕西"], ["刀削面", "山西"],
  ["山西老陈醋", "山西"], ["热干面", "湖北"], ["三鲜豆皮", "湖北"], ["剁椒鱼头", "湖南"], ["长沙臭豆腐", "湖南"],
  ["兰州牛肉面", "甘肃"], ["锅包肉", "黑龙江"], ["小鸡炖蘑菇", "东北地区"], ["德州扒鸡", "山东"], ["九转大肠", "山东"],
  ["胡辣汤", "河南"], ["河南烩面", "河南"], ["徽州臭鳜鱼", "安徽"], ["南昌拌粉", "江西"], ["海南鸡饭", "海南"],
  ["粽子", "端午节"], ["月饼", "中秋节"], ["汤圆", "元宵节"], ["腊八粥", "腊八节"], ["青团", "清明节"]
];
const FOOD_AREAS = [...new Set(FOOD_ROWS.map(([, area]) => area))];
FOOD_ROWS.forEach(([dish, area], index) => {
  const options = [area];
  for (let offset = 3; options.length < 4; offset += 5) {
    const candidate = FOOD_AREAS[(index + offset) % FOOD_AREAS.length];
    if (!options.includes(candidate)) options.push(candidate);
  }
  CHINA_FEATURED_QUESTIONS.push({
    id: `china-food-${String(index + 1).padStart(3, "0")}`,
    knowledgeKey: `china-food-${dish}-${area}`,
    category: "美食", pack: "party", kind: "choice",
    prompt: index < 45 ? `${dish}最具代表性的地域标签是哪里？` : `${dish}是中国哪个传统节日的代表食物？`,
    answer: area, aliases: [area], answerLength: [...area].length, options, optionType: index < 45 ? "province" : "festival",
    difficulty: "easy", explanation: index < 45 ? `${dish}是${area}具有代表性的美食。` : `${dish}是${area}的代表性节日食物。`,
    source: "中国大众美食精选题", updatedAt: "2026-08-10", chinaFeatured: true
  });
});

module.exports = { CHINA_FEATURED_QUESTIONS };
