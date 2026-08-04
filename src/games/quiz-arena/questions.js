const CATEGORIES = ["生活常识", "历史", "地理", "科学", "科技", "体育", "影视", "音乐", "游戏", "美食", "文学艺术", "自然动物", "趣味冷知识", "网络文化", "时事政治", "动漫角色", "儿童动画角色"];

const CHARACTER_IMAGE_QUERIES = {
  naruto: "Naruto Uzumaki", sasuke: "Sasuke Uchiha", sakura: "Sakura Haruno", kakashi: "Kakashi Hatake",
  luffy: "Monkey D. Luffy", zoro: "Roronoa Zoro", goku: "Goku Son", vegeta: "Vegeta",
  usagi: "Usagi Tsukino", conan: "Conan Edogawa", tanjiro: "Tanjirou Kamado", nezuko: "Nezuko Kamado",
  zenitsu: "Zenitsu Agatsuma", rengoku: "Kyoujurou Rengoku", gojo: "Satoru Gojou", yuji: "Yuuji Itadori",
  megumi: "Megumi Fushiguro", nobara: "Nobara Kugisaki", anya: "Anya Forger", loid: "Loid Forger",
  yor: "Yor Forger", eren: "Eren Yeager", mikasa: "Mikasa Ackerman", levi: "Levi",
  light: "Light Yagami", lawliet: "L Lawliet", edward: "Edward Elric", alphonse: "Alphonse Elric",
  kagome: "Kagome Higurashi", kazuto: "Kazuto Kirigaya", asuna: "Asuna Yuuki", shigeo: "Shigeo Kageyama",
  reigen: "Arataka Reigen", violet: "Violet Evergarden", lelouch: "Lelouch Lamperouge", gintoki: "Gintoki Sakata",
  shinpachi: "Shinpachi Shimura", jotaro: "Joutarou Kuujou", giorno: "Giorno Giovanna", shinji: "Shinji Ikari",
  rei: "Rei Ayanami", asuka: "Asuka Langley Souryuu", ranma: "Ranma Saotome", akane: "Akane Tendo",
  ichigo: "Ichigo Kurosaki", rukia: "Rukia Kuchiki", yusuke: "Yuusuke Urameshi", killua: "Killua Zoldyck",
  pikachu: "Pikachu", doraemon: "Doraemon", totoro: "Totoro", chopper: "Tony Tony Chopper", happy: "Happy", korosensei: "Koro-sensei",
  takeshi: "Takeshi Gouda", suneo: "Suneo Honekawa", shizuka: "Shizuka Minamoto", momoko: "Momoko Sakura",
  kinomoto: "Sakura Kinomoto", shinnosuke: "Shinnosuke Nohara", nobita: "Nobita Nobi"
};

// 国产儿童动画暂无稳定的开放角色图鉴 API，因此只使用受控键名和已核对的正版剧集封面。
const CHILD_CHARACTER_IMAGE_URLS = {
  headson: "https://i0.hdslb.com/bfs/bangumi/image/62da3f13e9337b20e30322be27800625a9dfa5b8.jpg",
  tutu: "https://i0.hdslb.com/bfs/bangumi/image/a28c1aba5ea17b8fab4890e1b7a1af76f87872b7.png",
  jiangliuer: "https://i0.hdslb.com/bfs/bangumi/image/713ce95614318de20eda1e75eb72a3bba19c1628.png",
  guangtouqiang: "https://i0.hdslb.com/bfs/bangumi/image/fb6ca695ef8e93ea8cd8fde26ecddd2278cb1d8b.png",
  xiyangyang: "https://i0.hdslb.com/bfs/bangumi/image/4cd5d75b3ac57d30a114bbe21a9dacd4f7c2fa81.png",
  zhuzhuxia: "https://i0.hdslb.com/bfs/bangumi/image/e9fe816c56bf0a9368a8b457bbf6bfe402bc6f83.png",
  nezha: "https://i0.hdslb.com/bfs/bangumi/image/a9c49eeb3cbdb228c30b39881b54a3ce897c5a93.png",
  hongmao: "https://i0.hdslb.com/bfs/bangumi/image/9a1bbe59a5e0d9f43a2136af00632dec93e32258.jpg",
  wentian: "http://i0.hdslb.com/bfs/bangumi/image/8c2304bcb131ab9e330a777d69758f0405161b5f.png",
  kaixinchaoren: "http://i0.hdslb.com/bfs/bangumi/image/2d5e8d7a0ddbbc3f43ce791fc7ab2089884f0816.png",
  lucoguo: "https://i0.hdslb.com/bfs/bangumi/image/9a75a62616f37863b33a31d08e65e39144eda76c.png"
};

const CHARACTER_FACTS = [
  ["naruto", "漩涡鸣人", [], "《火影忍者》的主角，第七班成员。"],
  ["sasuke", "宇智波佐助", [], "《火影忍者》中宇智波一族的忍者。"],
  ["sakura", "春野樱", [], "《火影忍者》第七班成员，擅长医疗忍术。"],
  ["kakashi", "旗木卡卡西", [], "《火影忍者》第七班的指导上忍。"],
  ["luffy", "蒙奇·D·路飞", ["蒙奇D路飞"], "《海贼王》中草帽海贼团船长。"],
  ["zoro", "罗罗诺亚·索隆", ["罗罗诺亚索隆"], "《海贼王》中使用三刀流的剑士。"],
  ["goku", "孙悟空", [], "《龙珠》的主要角色，来自赛亚人一族。"],
  ["vegeta", "贝吉塔", [], "《龙珠》中的赛亚人王子。"],
  ["usagi", "月野兔", [], "《美少女战士》的主角。"],
  ["conan", "江户川柯南", [], "《名侦探柯南》中工藤新一缩小后的身份。"],
  ["tanjiro", "灶门炭治郎", [], "《鬼灭之刃》的主角。"],
  ["nezuko", "灶门祢豆子", ["灶门禰豆子"], "《鬼灭之刃》中炭治郎的妹妹。"],
  ["zenitsu", "我妻善逸", [], "《鬼灭之刃》中使用雷之呼吸的剑士。"],
  ["rengoku", "炼狱杏寿郎", [], "《鬼灭之刃》中的炎柱。"],
  ["gojo", "五条悟", [], "《咒术回战》中的特级咒术师。"],
  ["yuji", "虎杖悠仁", [], "《咒术回战》的主角。"],
  ["megumi", "伏黑惠", [], "《咒术回战》中使用十种影法术的咒术师。"],
  ["nobara", "钉崎野蔷薇", [], "《咒术回战》东京校一年级学生。"],
  ["anya", "阿尼亚·福杰", ["阿尼亚福杰"], "《间谍过家家》中拥有读心能力的女孩。"],
  ["loid", "洛伊德·福杰", ["洛伊德福杰"], "《间谍过家家》中代号黄昏的间谍。"],
  ["yor", "约尔·福杰", ["约尔福杰"], "《间谍过家家》中代号荆棘公主的杀手。"],
  ["eren", "艾伦·耶格尔", ["艾伦耶格尔"], "《进击的巨人》的主要角色。"],
  ["mikasa", "三笠·阿克曼", ["三笠阿克曼"], "《进击的巨人》中的调查兵团成员。"],
  ["levi", "利威尔·阿克曼", ["利威尔阿克曼"], "《进击的巨人》中的调查兵团兵长。"],
  ["light", "夜神月", [], "《死亡笔记》的主要角色。"],
  ["lawliet", "L·劳莱特", ["L劳莱特"], "《死亡笔记》中追查基拉的侦探。"],
  ["edward", "爱德华·艾尔利克", ["爱德华艾尔利克"], "《钢之炼金术师》中的钢之炼金术师。"],
  ["alphonse", "阿尔冯斯·艾尔利克", ["阿尔冯斯艾尔利克"], "《钢之炼金术师》中爱德华的弟弟。"],
  ["kagome", "日暮戈薇", [], "《犬夜叉》中穿越到战国时代的少女。"],
  ["kazuto", "桐谷和人", [], "《刀剑神域》中游戏名为桐人的主角。"],
  ["asuna", "结城明日奈", [], "《刀剑神域》中游戏名为亚丝娜的角色。"],
  ["shigeo", "影山茂夫", [], "《灵能百分百》中绰号龙套的超能力者。"],
  ["reigen", "灵幻新隆", [], "《灵能百分百》中自称灵能力者的咨询师。"],
  ["violet", "薇尔莉特·伊芙加登", ["薇尔莉特伊芙加登"], "《紫罗兰永恒花园》的主角。"],
  ["lelouch", "鲁路修·兰佩路基", ["鲁路修兰佩路基"], "《反叛的鲁路修》的主角。"],
  ["gintoki", "坂田银时", [], "《银魂》中万事屋的负责人。"],
  ["shinpachi", "志村新八", [], "《银魂》中万事屋成员。"],
  ["jotaro", "空条承太郎", [], "《JOJO的奇妙冒险》第三部主角。"],
  ["giorno", "乔鲁诺·乔巴拿", ["乔鲁诺乔巴拿"], "《JOJO的奇妙冒险》第五部主角。"],
  ["shinji", "碇真嗣", [], "《新世纪福音战士》的主角。"],
  ["rei", "绫波丽", [], "《新世纪福音战士》中零号机驾驶员。"],
  ["asuka", "惣流·明日香·兰格雷", ["惣流明日香兰格雷"], "《新世纪福音战士》中二号机驾驶员。"],
  ["ranma", "早乙女乱马", [], "《乱马1/2》的主角。"],
  ["akane", "天道茜", [], "《乱马1/2》的主要角色。"],
  ["ichigo", "黑崎一护", [], "《死神》的主角。"],
  ["rukia", "朽木露琪亚", [], "《死神》中来自尸魂界的死神。"],
  ["yusuke", "浦饭幽助", [], "《幽游白书》的主角。"],
  ["killua", "奇犽·揍敌客", ["奇犽揍敌客"], "《全职猎人》中出身杀手家族的猎人。"],
  ["pikachu", "皮卡丘", [], "《宝可梦》中广为人知的电属性宝可梦。"],
  ["doraemon", "哆啦A梦", ["多啦A梦"], "来自22世纪的猫型机器人。"],
  ["totoro", "龙猫", ["托托罗"], "《龙猫》中居住在森林里的神秘生物。"],
  ["chopper", "托尼托尼·乔巴", ["托尼托尼乔巴"], "《海贼王》中草帽海贼团的船医。"],
  ["happy", "哈比", [], "《妖精的尾巴》中会飞的蓝色艾克希特。"],
  ["korosensei", "杀老师", [], "《暗杀教室》中担任三年E班教师的神秘生物。"]
];

const CHILD_CHARACTER_FACTS = [
  ["headson", "头太元", [], "“大头儿子”在后期衍生真人作品中使用过的姓名；老版动画中通常只称“大头儿子”。", "国产儿童动画"],
  ["tutu", "胡图图", [], "《大耳朵图图》的主角，平时大家多称他“图图”。", "国产儿童动画"],
  ["jiangliuer", "江流儿", [], "《围棋少年》中富有围棋天赋的主人公。", "国产儿童动画"],
  ["guangtouqiang", "光头强", [], "《熊出没》中在森林里与熊大、熊二斗智斗勇的伐木队小老板。", "国产儿童动画"],
  ["xiyangyang", "喜羊羊", [], "《喜羊羊与灰太狼》中机智勇敢的小羊。", "国产儿童动画"],
  ["zhuzhuxia", "猪猪侠", [], "《猪猪侠》中喜欢吃棒棒糖、拥有超能力的主角。", "国产儿童动画"],
  ["nezha", "哪吒", [], "《哪吒传奇》中手持火尖枪、脚踩风火轮的小英雄。", "国产儿童动画"],
  ["hongmao", "虹猫", [], "《虹猫蓝兔七侠传》中的长虹剑传人。", "国产儿童动画"],
  ["wentian", "问天", [], "《神兵小将》中与天晶兽并肩作战的少年。", "国产儿童动画"],
  ["kaixinchaoren", "开心超人", [], "《开心宝贝》中活泼开朗的超人。", "国产儿童动画"],
  ["lucoguo", "陆小果", [], "《果宝特攻》中使用蜜桃神剑的果宝战士。", "国产儿童动画"],
  ["takeshi", "刚田武", [], "《哆啦A梦》中绰号“胖虎”的角色。", "童年经典动画"],
  ["suneo", "骨川小夫", [], "《哆啦A梦》中大家常称“小夫”的角色。", "童年经典动画"],
  ["shizuka", "源静香", ["源静子"], "《哆啦A梦》中大雄的好朋友，中文常称“静香”。", "童年经典动画"],
  ["momoko", "樱桃子", [], "《樱桃小丸子》主角“小丸子”的姓名。", "童年经典动画"],
  ["kinomoto", "木之本樱", [], "《魔卡少女樱》中收集库洛牌的主角。", "童年经典动画"],
  ["shinnosuke", "野原新之助", [], "《蜡笔小新》主角“小新”的完整姓名。", "童年经典动画"],
  ["nobita", "野比大雄", [], "《哆啦A梦》中大家常称“大雄”的角色。", "童年经典动画"]
];

// 每条知识事实会生成20种等价问法；比赛抽题时按knowledgeKey去重，
// 因此同一局不会用不同措辞重复考察同一个知识点。
const FACT_ROWS = {
  "生活常识": [
    "标准大气压下水的沸点约为多少摄氏度？|100|0~100|0,50,80|标准大气压下纯水约在100℃沸腾。",
    "中国大陆通用的火警电话号码是多少？|119|3|110,120,122|119用于报告火灾险情。",
    "成年人通常有多少颗恒牙（含智齿）？|32|2|20,24,28|成年人的完整恒牙列通常为32颗。",
    "一天共有多少分钟？|1440|4|720,1200,2400|24×60等于1440分钟。",
    "一千克等于多少克？|1000|4|100,500,10000|千克与克之间是1000倍关系。",
    "交通信号灯中通常表示可以通行的颜色是？|绿色|2|红色,黄色,紫色|绿色信号通常表示可以通行。",
    "人体正常体温通常约为多少摄氏度？|37|2|25,42,50|常见参考值约为37℃，个体与测量部位会有差异。",
    "身份证号码最后一位可能出现的英文字母是？|X|1|A,B,Z|校验码为10时用罗马数字X表示。",
    "冰箱冷藏室通常应比冷冻室温度更高还是更低？|更高|2|更低,完全相同,无法比较|冷藏室通常在0℃以上，冷冻室通常在零下。",
    "使用灭火器时通常应对准火焰的哪个部位？|根部|2|顶部,中部,任意位置|对准燃烧物根部喷射更能有效灭火。"
  ],
  "历史": [
    "秦始皇统一六国发生在哪一年？|公元前221年|7|公元前206年,公元前202年,公元前1046年|秦在公元前221年完成统一。",
    "中国古代四大发明中用于辨别方向的是？|指南针|3|造纸术,火药,印刷术|指南针利用磁性指示方向。",
    "郑和下西洋发生在哪个朝代？|明朝|2|唐朝,宋朝,清朝|郑和在明代七下西洋。",
    "《资治通鉴》的主持编纂者是谁？|司马光|3|司马迁,班固,欧阳修|北宋司马光主持编纂《资治通鉴》。",
    "工业革命最早大规模兴起于哪个国家？|英国|2|法国,德国,美国|18世纪工业革命首先在英国展开。",
    "古代丝绸之路传统上以哪座城市为东方起点？|长安|2|洛阳,开封,南京|传统叙述通常以汉唐长安为东方起点。",
    "唐太宗的姓名是？|李世民|3|李渊,李治,李隆基|李世民即唐太宗。",
    "文艺复兴最早兴起于今天的哪个国家？|意大利|3|西班牙,荷兰,瑞典|文艺复兴最早在意大利城邦兴起。",
    "中国历史上第一部纪传体通史是？|史记|2|汉书,资治通鉴,左传|司马迁的《史记》是第一部纪传体通史。",
    "古埃及文明主要发源于哪条河流域？|尼罗河|3|亚马孙河,恒河,多瑙河|尼罗河孕育了古埃及文明。"
  ],
  "地理": [
    "世界面积最大的国家是？|俄罗斯|3|加拿大,中国,美国|俄罗斯国土面积居世界第一。",
    "世界最高峰是？|珠穆朗玛峰|5|乔戈里峰,乞力马扎罗山,富士山|珠穆朗玛峰是海拔最高的山峰。",
    "澳大利亚的首都是？|堪培拉|3|悉尼,墨尔本,珀斯|澳大利亚首都是堪培拉。",
    "加拿大的首都是？|渥太华|3|多伦多,温哥华,蒙特利尔|加拿大首都是渥太华。",
    "被赤道穿过且面积最大的洲是？|亚洲|2|非洲,南美洲,大洋洲|亚洲面积最大，赤道穿过其东南部岛屿。",
    "日本最高的山是？|富士山|3|阿苏山,高尾山,立山|富士山是日本最高峰。",
    "泰晤士河流经哪座著名城市？|伦敦|2|巴黎,罗马,柏林|泰晤士河穿过伦敦。",
    "撒哈拉沙漠主要位于哪个大洲？|非洲|2|亚洲,南美洲,大洋洲|撒哈拉沙漠横跨北非。",
    "新西兰的首都是？|惠灵顿|3|奥克兰,基督城,汉密尔顿|新西兰首都是惠灵顿。",
    "世界上面积最大的海洋是？|太平洋|3|大西洋,印度洋,北冰洋|太平洋是世界最大海洋。"
  ],
  "科学": [
    "太阳系中距离太阳最近的行星是？|水星|2|金星,地球,火星|水星轨道最靠近太阳。",
    "植物光合作用主要吸收哪种气体？|二氧化碳|5|氧气,氮气,氢气|植物吸收二氧化碳并释放氧气。",
    "化学元素符号O代表什么元素？|氧|1|金,银,铁|O是氧元素的符号。",
    "声音不能在哪种环境中传播？|真空|2|空气,水,钢铁|声音传播需要介质。",
    "地球天然卫星的名称是？|月球|2|太阳,火星,金星|月球是地球唯一的天然卫星。",
    "人体内负责运输氧气的血细胞主要是？|红细胞|3|白细胞,血小板,神经细胞|红细胞中的血红蛋白运输氧气。",
    "物体由液态变为气态的过程称为？|汽化|2|凝固,液化,升华|液体变成气体称为汽化。",
    "DNA中文通常称为什么？|脱氧核糖核酸|6|核糖核酸,氨基酸,葡萄糖|DNA是脱氧核糖核酸。",
    "光在真空中的速度约为每秒多少千米？|30万千米|5|3万千米,3000千米,300万千米|光速约为每秒299792千米。",
    "元素周期表最轻的元素是？|氢|1|氦,锂,碳|氢的原子序数为1。"
  ],
  "科技": [
    "CPU中文通常称为？|中央处理器|5|图形处理器,随机存储器,固态硬盘|CPU是Central Processing Unit。",
    "网页地址开头的HTTPS比HTTP多出的S代表什么？|安全|2|搜索,速度,服务器|S表示Secure，即安全加密连接。",
    "二进制数10换算成十进制是多少？|2|1|1,3,10|二进制10等于十进制2。",
    "1字节通常等于多少比特？|8|1|4,10,16|一个字节通常由8个比特组成。",
    "GPS主要用于什么？|定位导航|4|文字处理,温度测量,图像压缩|GPS通过卫星信号提供定位与导航。",
    "常见二维码的英文缩写是？|QR|2|AI,VR,USB|QR来自Quick Response。",
    "用于描述显示器画面细节多少的常见指标是？|分辨率|3|音量,重量,电阻|分辨率表示图像包含的像素规模。",
    "计算机临时存放正在运行数据的硬件通常是？|内存|2|显示器,键盘,打印机|内存用于暂存程序运行所需数据。",
    "Wi-Fi主要用于哪类连接？|无线网络|4|机械传动,燃料输送,纸张打印|Wi-Fi是一类无线局域网技术。",
    "USB接口通常能传输数据和什么？|电力|2|汽油,蒸汽,天然气|USB可同时承担数据和供电。"
  ],
  "体育": [
    "标准足球比赛每队在场上通常有多少名球员？|11|2|5,6,9|足球每队通常11人上场。",
    "篮球比赛中的罚球命中通常得几分？|1|1|2,3,4|罚球命中计1分。",
    "夏季奥运会通常每隔几年举办一次？|4|1|2,3,5|夏季奥运会通常四年一届。",
    "网球比赛中零分通常用哪个英文词表示？|Love|4|Zero,Null,Blank|网球计分用Love表示零分。",
    "马拉松全程标准距离约为多少千米？|42.195千米|8|21.0975千米,40千米,50千米|马拉松标准距离为42.195千米。",
    "排球比赛每队同时在场上通常有几名球员？|6|1|5,7,11|室内排球每队通常6人在场。",
    "斯诺克中黑球通常价值多少分？|7|1|5,6,8|斯诺克黑球价值7分。",
    "羽毛球一局通常先到多少分且需领先两分？|21|2|11,15,25|现行常用规则一局21分。",
    "棒球比赛中击球员绕完所有垒得分称为什么？|本垒打|3|界外球,触杀,盗垒|本垒打通常使击球员完成绕垒得分。",
    "国际象棋中每方开局共有多少枚棋子？|16|2|8,12,20|每方开局有16枚棋子。"
  ],
  "影视": [
    "电影画面连续播放产生运动感主要利用了什么现象？|视觉暂留|4|声音反射,热胀冷缩,电磁感应|连续画面利用视觉暂留形成运动感。",
    "奥斯卡金像奖主要表彰哪个领域？|电影|2|建筑,医学,天文学|奥斯卡奖是重要电影奖项。",
    "电影开拍时场记板的主要用途之一是？|同步声画|4|测量温度,改变灯光,保存电力|场记板帮助后期同步画面与声音。",
    "电视剧按连续故事分集播出的基本单位称为？|集|1|幕,章,卷|电视剧通常按集播出。",
    "动画每秒播放的画面数量常用哪个缩写表示？|FPS|3|GPS,CPU,PDF|FPS表示每秒帧数。",
    "电影中负责统筹画面拍摄和镜头调度的核心创作者通常是？|导演|2|观众,售票员,字幕员|导演负责整体视听创作。",
    "无声电影时代以喜剧形象闻名的卓别林常戴什么帽子？|圆顶礼帽|4|安全帽,皇冠,棒球帽|圆顶礼帽是其经典银幕形象元素。",
    "纪录片通常以什么为主要创作基础？|真实素材|4|完全虚构,随机数字,纯音乐|纪录片主要基于现实人物与事件。",
    "影视后期中将不同镜头连接起来的工作称为？|剪辑|2|铸造,纺织,印刷|剪辑负责选择与组合镜头。",
    "字幕的主要作用是什么？|呈现对白信息|6|提高温度,调节音量,改变焦距|字幕用文字呈现对白及相关信息。"
  ],
  "音乐": [
    "钢琴标准键盘通常有多少个键？|88|2|66,76,96|现代标准钢琴通常有88键。",
    "交响乐团中通常负责统一指挥的是？|指挥|2|编剧,裁判,记者|指挥协调乐团速度与表现。",
    "五线谱共有几条线？|5|1|4,6,8|五线谱由五条平行线构成。",
    "小提琴通常有几根弦？|4|1|3,5,6|现代小提琴通常有四根弦。",
    "贝多芬主要以哪个领域的成就闻名？|音乐|2|绘画,地理,建筑|贝多芬是著名作曲家。",
    "音乐中表示速度逐渐加快的术语是？|渐快|2|渐慢,休止,降调|渐快表示演奏速度逐步提高。",
    "二胡演奏时通常使用什么摩擦琴弦发声？|弓|1|鼓槌,拨片,键盘|二胡使用夹在弦间的弓毛摩擦发声。",
    "架子鼓中的踩镲通常主要用哪只脚控制？|左脚|2|右脚,双手,头部|常规架子鼓配置中左脚控制踩镲。",
    "一段旋律移高或移低但音程关系不变称为什么？|移调|2|休止,切分,弱拍|移调改变调高但保留音程结构。",
    "合唱中常见的女高音英文缩写是？|S|1|B,T,A|S代表Soprano。"
  ],
  "游戏": [
    "国际象棋中唯一可以跳过其他棋子的常规棋子是？|马|1|车,象,后|马可以越过其他棋子。",
    "围棋棋盘标准纵横各有多少条线？|19|2|9,13,21|标准围棋棋盘为19路。",
    "扑克牌中同花顺和四条通常哪个牌型更大？|同花顺|3|四条,葫芦,两对|常见扑克规则中同花顺大于四条。",
    "数独标准盘面通常是几乘几？|9乘9|3|6乘6,8乘8,10乘10|标准数独为9×9。",
    "剪刀石头布中石头克制什么？|剪刀|2|布,石头,全部|石头击败剪刀。",
    "桌游中负责说明可执行操作和胜负条件的文本称为？|规则|2|封面,插画,广告|规则定义游戏流程与胜负。",
    "电子游戏中NPC通常指什么？|非玩家角色|5|网络密码,画面帧率,游戏手柄|NPC是Non-Player Character。",
    "RPG通常是哪类游戏的缩写？|角色扮演游戏|6|竞速游戏,音乐游戏,体育游戏|RPG指Role-Playing Game。",
    "合作游戏的玩家通常需要共同对抗什么？|游戏系统|4|所有队友,计时器本身,游戏包装|合作游戏常由玩家共同对抗系统挑战。",
    "卡牌游戏中把牌随机重新排列的动作称为？|洗牌|2|弃牌,亮牌,停牌|洗牌用于随机化牌序。"
  ],
  "美食": [
    "制作豆腐的主要原料是？|大豆|2|小麦,玉米,高粱|豆腐主要由大豆加工制成。",
    "寿司中常见的醋饭主要使用哪种谷物？|大米|2|燕麦,小麦,高粱|寿司醋饭以大米为主。",
    "巧克力的主要风味原料来自哪种植物种子？|可可|2|咖啡,茶树,橄榄|巧克力主要源自可可豆。",
    "意大利面传统上主要以哪种粮食制成？|小麦|2|水稻,大豆,花生|意大利面主要由硬质小麦制成。",
    "泡菜制作常利用哪类微生物发酵？|乳酸菌|3|酵母以外的霉菌,病毒,藻类|泡菜酸味主要来自乳酸菌发酵。",
    "蜂蜜主要由蜜蜂采集什么加工而成？|花蜜|2|树皮,石头,海水|蜜蜂采集花蜜并加工储存为蜂蜜。",
    "传统饺子的外皮主要用什么制成？|面粉|2|豆腐,奶酪,海带|饺子皮通常由面粉和水制成。",
    "爆米花通常使用哪类玉米制作？|爆裂玉米|4|糯玉米,甜玉米罐头,青玉米|爆裂型玉米受热后易膨爆。",
    "味觉中的鲜味主要与哪类物质有关？|谷氨酸盐|4|纯水,氧气,纤维素|谷氨酸盐是常见鲜味来源。",
    "面包发酵时常用哪种微生物产生气体？|酵母菌|3|乳酸菌,蓝藻,病毒|酵母发酵产生二氧化碳使面团膨松。"
  ],
  "文学艺术": [
    "《静夜思》的作者是谁？|李白|2|杜甫,白居易,王维|《静夜思》是李白的作品。",
    "《红楼梦》传统上认为前八十回的作者是谁？|曹雪芹|3|罗贯中,施耐庵,吴承恩|《红楼梦》前八十回通常归于曹雪芹。",
    "《蒙娜丽莎》的作者是谁？|达芬奇|3|梵高,莫奈,毕加索|《蒙娜丽莎》由列奥纳多·达·芬奇创作。",
    "中国书法中的文房四宝不包括哪一项？|算盘|2|笔,墨,纸|文房四宝是笔墨纸砚。",
    "《哈姆雷特》的作者是谁？|莎士比亚|4|狄更斯,雨果,歌德|《哈姆雷特》是莎士比亚戏剧。",
    "诗句“海内存知己”的下一句是？|天涯若比邻|5|更上一层楼,江春入旧年,云深不知处|出自王勃《送杜少府之任蜀州》。|fill",
    "诗句“欲穷千里目”的下一句是？|更上一层楼|5|天涯若比邻,低头思故乡,春风吹又生|出自王之涣《登鹳雀楼》。|fill",
    "诗句“野火烧不尽”的下一句是？|春风吹又生|5|明月何时照我还,一览众山小,更上一层楼|出自白居易《赋得古原草送别》。|fill",
    "诗句“举头望明月”的下一句是？|低头思故乡|5|春风吹又生,江清月近人,粒粒皆辛苦|出自李白《静夜思》。|fill",
    "诗句“谁知盘中餐”的下一句是？|粒粒皆辛苦|5|低头思故乡,润物细无声,春眠不觉晓|出自李绅《悯农》。|fill"
  ],
  "自然动物": [
    "世界上现存体型最大的动物是？|蓝鲸|2|非洲象,长颈鹿,鲸鲨|蓝鲸是现存体型最大的动物。",
    "企鹅主要分布在哪个半球？|南半球|3|北半球,东半球,仅赤道|大多数企鹅自然分布在南半球。",
    "蝙蝠属于哪一类动物？|哺乳动物|4|鸟类,昆虫,爬行动物|蝙蝠是能够持续飞行的哺乳动物。",
    "青蛙的幼体通常称为什么？|蝌蚪|2|幼虫,鱼苗,蛹|青蛙幼体称蝌蚪。",
    "骆驼的驼峰主要储存什么？|脂肪|2|水,空气,血液|驼峰主要储存脂肪。",
    "蜜蜂通过什么动作向同伴传递蜜源方向？|舞蹈|2|睡眠,蜕皮,冬眠|蜜蜂用舞蹈传递方向和距离信息。",
    "大熊猫主要以哪种植物为食？|竹子|2|松树,仙人掌,水稻|竹子是大熊猫主要食物。",
    "章鱼通常有几条腕？|8|1|6,10,12|章鱼有八条腕。",
    "鸟类身体表面特有的覆盖物是？|羽毛|2|鳞片,毛发,甲壳|羽毛是现生鸟类的典型特征。",
    "珊瑚在生物分类上属于动物还是植物？|动物|2|植物,真菌,细菌|造礁珊瑚由珊瑚虫等动物构成。"
  ],
  "趣味冷知识": [
    "通常情况下，人的左右肺哪一侧叶数更多？|右肺|2|左肺,完全相同,没有肺叶|右肺三叶，左肺两叶。",
    "铅笔芯的主要成分是石墨和什么？|黏土|2|铅,银,塑料|铅笔芯主要由石墨与黏土混合制成。",
    "香蕉在植物学上属于浆果吗？|属于|2|不属于,只属于坚果,只属于豆类|植物学定义下香蕉属于浆果。|judge",
    "人的指纹在胎儿时期就会形成吗？|会|1|不会,出生十年后形成,成年后形成|指纹纹路在出生前已经形成。|judge",
    "海马主要由雌性还是雄性负责孕育幼体？|雄性|2|雌性,双方都不孕育,由其他鱼类|雄海马拥有育儿袋。",
    "一副不含大小王的扑克牌共有多少张？|52|2|48,54,56|四种花色各13张，共52张。",
    "国际单位制中温度的基本单位是？|开尔文|3|摄氏度,华氏度,焦耳|开尔文是SI温度基本单位。",
    "蜂鸟能够向后飞行吗？|能够|2|不能,只能滑翔,只能水下后退|蜂鸟特殊的翅膀运动使其可向后飞。|judge",
    "北极熊的皮肤通常是什么颜色？|黑色|2|白色,粉色,透明|北极熊毛发透明，皮肤通常呈黑色。",
    "人耳中最小的骨头叫什么？|镫骨|2|股骨,尺骨,髌骨|镫骨位于中耳，是人体最小骨。"
  ],
  "网络文化": [
    "网络聊天中“233”通常表达什么情绪？|大笑|2|悲伤,困倦,愤怒|233常用于表达大笑。",
    "网络中的“UP主”通常指什么？|内容创作者|5|快递员,裁判员,网络线路|UP主通常指上传和创作内容的用户。",
    "“弹幕”在网络视频中通常指什么？|滚动评论|4|视频广告,背景音乐,下载按钮|弹幕是随视频画面滚动显示的评论。",
    "“破防了”在网络语境中常表示什么？|情绪受到触动|6|设备损坏,网速提升,完成防守|网络语境中常指心理防线被触动。",
    "网络缩写“YYDS”通常表示？|永远的神|4|音乐电视,一眼定胜负,页面已删除|YYDS来自“永远的神”的拼音首字母。",
    "“吃瓜群众”通常指哪类人？|围观者|3|厨师,运动员,种植者|通常指围观事件的网友。",
    "互联网中的“云玩家”常指什么？|看别人玩但自己少玩的人|10|维修服务器的人,气象玩家,只玩飞行游戏的人|该词常指主要通过视频直播了解游戏的人。",
    "“社死”是哪个说法的简称？|社会性死亡|5|社交软件,社会实践,社区服务|社死是“社会性死亡”的网络简称。",
    "网络中的“梗”通常指什么？|反复传播的趣味表达|9|网络电缆,植物根茎,文件格式|网络梗是被大量引用和再创作的表达。",
    "“种草”在网络消费语境中常表示什么？|产生购买兴趣|6|园艺劳动,取消订单,退还商品|种草常指受到推荐后产生购买兴趣。"
  ],
  "时事政治": [
    "联合国总部位于哪座城市？|纽约|2|日内瓦,巴黎,伦敦|联合国总部设在美国纽约。",
    "英国议会由上议院和什么组成？|下议院|3|参议院,众议院,国务院|英国议会由君主、上议院和下议院构成。",
    "欧洲联盟常用的英文缩写是？|EU|2|UN,NATO,WHO|EU是European Union的缩写。",
    "世界卫生组织常用的英文缩写是？|WHO|3|WTO,IMF,IOC|WHO是World Health Organization。",
    "2024年夏季奥运会的主办城市是？|巴黎|2|东京,伦敦,洛杉矶|2024年夏季奥运会在巴黎举办。",
    "联合国安全理事会常任理事国共有几个？|5|1|4,6,10|安理会有五个常任理事国。",
    "英国首相通常在哪座建筑办公和居住？|唐宁街10号|6|白金汉宫,威斯敏斯特教堂,温莎城堡|英国首相官邸位于唐宁街10号。",
    "北大西洋公约组织常用的英文缩写是？|NATO|4|NASA,OPEC,UNESCO|NATO是北大西洋公约组织。",
    "国际法院设在哪座城市？|海牙|2|布鲁塞尔,维也纳,马德里|国际法院位于荷兰海牙。",
    "二十国集团通常使用哪个英文缩写？|G20|3|G2,G7,G77|二十国集团通常简称G20。"
  ]
};

function rotate(items, amount) {
  const count = amount % items.length;
  return [...items.slice(count), ...items.slice(0, count)];
}

function parseRow(category, row, rowIndex) {
  const [prompt, answer, answerLength, distractorText, explanation, explicitKind] = row.split("|");
  return { category, prompt, answer, answerLength: Number(answerLength) || [...answer].length, distractors: distractorText.split(","), explanation, kind: explicitKind || "choice", knowledgeKey: `${category}-${rowIndex + 1}` };
}

function buildLocalQuestions() {
  const questions = [];
  for (const category of Object.keys(FACT_ROWS)) {
    FACT_ROWS[category].map((row, index) => parseRow(category, row, index)).forEach((fact, factIndex) => {
      const promptPrefix = ["", "请问，", "快速答题：", "知识挑战：", "你知道吗？", "挑战一下：", "在这道题中，", "判断下面的问题：", "答题时间：", "站神考场："];
      for (let variant = 0; variant < 35; variant += 1) {
        const optionPool = fact.kind === "judge" ? [fact.answer, fact.distractors[0]] : [fact.answer, ...fact.distractors];
        const options = rotate(optionPool, variant);
        questions.push({
          id: `local-${category}-${factIndex + 1}-${variant + 1}`,
          knowledgeKey: fact.knowledgeKey,
          category,
          pack: ["网络文化", "影视", "音乐", "游戏", "美食"].includes(category) ? "party" : ["时事政治"].includes(category) ? "current" : "classic",
          kind: fact.kind,
          prompt: `${promptPrefix[variant % promptPrefix.length]}${fact.prompt}`,
          answer: fact.answer,
          aliases: [fact.answer],
          answerLength: fact.answerLength,
          options,
          explanation: fact.explanation,
          source: "站神基础题库",
          updatedAt: "2026-08-04"
        });
      }
    });
  }
  CHARACTER_FACTS.forEach(([imageKey, answer, aliases, explanation], index) => {
    questions.push({
      id: `character-${imageKey}`,
      knowledgeKey: `动漫角色-${imageKey}`,
      category: "动漫角色",
      pack: "party",
      kind: "image-fill",
      prompt: "请填写图中角色的完整姓名",
      answer,
      aliases: [answer, ...aliases],
      answerLength: [...answer].filter((character) => !/[·.\s]/.test(character)).length,
      options: [],
      imageUrl: `/api/games/quiz-arena/character-image/${imageKey}`,
      explanation,
      source: "AniList角色图鉴",
      updatedAt: "2026-08-04",
      order: index
    });
  });
  CHILD_CHARACTER_FACTS.forEach(([imageKey, answer, aliases, explanation, source], index) => {
    questions.push({
      id: `child-character-${imageKey}`,
      knowledgeKey: `儿童动画角色-${imageKey}`,
      category: "儿童动画角色",
      pack: "party",
      kind: "image-fill",
      prompt: "请填写图中角色的完整姓名",
      answer,
      aliases: [answer, ...aliases],
      answerLength: [...answer].filter((character) => !/[·.\s]/.test(character)).length,
      options: [],
      imageUrl: `/api/games/quiz-arena/character-image/${imageKey}`,
      explanation,
      source,
      updatedAt: "2026-08-04",
      order: index
    });
  });
  return questions;
}

const LOCAL_QUESTIONS = buildLocalQuestions();
let remoteQuestions = [];

function validateRemoteQuestion(question, index) {
  if (!question || typeof question.prompt !== "string" || typeof question.answer !== "string" || !CATEGORIES.includes(question.category)) return null;
  const answer = question.answer.trim().slice(0, 80);
  const prompt = question.prompt.trim().slice(0, 240);
  if (!answer || !prompt) return null;
  const options = Array.isArray(question.options) ? question.options.map(String).filter(Boolean).slice(0, 4) : [];
  return {
    id: `remote-${String(question.id || index).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || index}`,
    knowledgeKey: `remote-${String(question.knowledgeKey || question.id || index).slice(0, 80)}`,
    category: question.category,
    pack: ["classic", "party", "current"].includes(question.pack) ? question.pack : "classic",
    kind: ["choice", "judge", "fill"].includes(question.kind) ? question.kind : "choice",
    prompt,
    answer,
    aliases: [...new Set([answer, ...(Array.isArray(question.aliases) ? question.aliases.map(String) : [])])].slice(0, 8),
    answerLength: Math.max(1, Math.min(40, Number(question.answerLength) || [...answer].length)),
    options: options.includes(answer) ? options : [answer, ...options].slice(0, 4),
    explanation: String(question.explanation || "").slice(0, 300),
    source: String(question.source || "在线题包").slice(0, 80),
    updatedAt: String(question.updatedAt || new Date().toISOString().slice(0, 10)).slice(0, 10)
  };
}

function installRemoteQuestions(items) {
  remoteQuestions = Array.isArray(items) ? items.map(validateRemoteQuestion).filter(Boolean).slice(0, 20_000) : [];
  return remoteQuestions.length;
}

function getQuestionBank() { return [...remoteQuestions, ...LOCAL_QUESTIONS]; }
function questionPackInfo() { return { localCount: LOCAL_QUESTIONS.length, remoteCount: remoteQuestions.length, total: LOCAL_QUESTIONS.length + remoteQuestions.length, version: "2026.08.04", categories: CATEGORIES }; }

module.exports = { CATEGORIES, CHARACTER_IMAGE_QUERIES, CHILD_CHARACTER_IMAGE_URLS, LOCAL_QUESTIONS, getQuestionBank, installRemoteQuestions, questionPackInfo };
