// 海外音乐作品采用发行时的正式标题。题干仍使用中文，避免把玩家熟悉的
// 英文歌名、专辑名机械翻译成并不存在的中文名称。
const WIKIDATA_ENGLISH_TITLES = {
  Q169226: "Sgt. Pepper's Lonely Hearts Club Band", Q173643: "Abbey Road", Q44320: "Thriller",
  Q131182: "The Fame", Q181826: "Please Please Me", Q3295515: "The Beatles", Q199585: "Let It Be",
  Q182518: "A Hard Day's Night", Q185121: "Revolver", Q182389: "With the Beatles", Q193490: "Queen",
  Q201816: "Help!", Q164621: "The Fame Monster", Q164646: "Born This Way", Q190640: "Rubber Soul",
  Q131919251: "Mayhem", Q207336: "Beatles for Sale", Q223181: "Queen II", Q153064: "Bad Romance",
  Q60676411: "Magical Mystery Tour", Q2743297: "ARTPOP", Q44104: "Dangerous", Q44142: "Bad",
  Q842214: "Fearless", Q17544553: "1989", Q37814092: "Reputation", Q44289: "Off the Wall",
  Q153044: "Alejandro", Q155169: "21", Q26898358: "Joanne", Q385122: "Speak Now", Q858750: "Red",
  Q188766: "Judas", Q190960: "LoveGame", Q19060: "Got to Be There",
  Q44347: "HIStory: Past, Present and Future, Book I", Q44376: "Invincible", Q86919359: "Chromatica",
  Q97620733: "Folklore", Q21168841: "25", Q44185: "Ben", Q44247: "Forever, Michael",
  Q64596218: "Lover", Q744564: "Somebody to Love", Q44209: "Music & Me", Q113640799: "Midnights",
  Q208902: "19", Q381033: "Michael", Q300973: "You Are Not Alone", Q135726298: "The Life of a Showgirl",
  Q14344806: "Applause", Q104092260: "Evermore", Q124426354: "The Tortured Poets Department",
  Q300976: "You Rock My World", Q37912621: "Look What You Made Me Do", Q15966854: "G.U.Y.",
  Q18247605: "Out of the Woods", Q725876: "Dance in the Dark", Q1648799: "Mine", Q756785: "Cry",
  Q848774: "Hollywood Tonight", Q276585: "I Knew You Were Trouble"
};

function preserveOfficialProperNouns(question) {
  if (question.category !== "音乐" || !question.id?.startsWith("wikidata-")) return question;
  const entityId = question.id.match(/-(Q\d+)-/)?.[1];
  const officialTitle = WIKIDATA_ENGLISH_TITLES[entityId];
  if (!officialTitle) return question;
  const replaceTitle = (text) => String(text || "").replace(/《[^》]+》/, `《${officialTitle}》`);
  return { ...question, prompt: replaceTitle(question.prompt), explanation: replaceTitle(question.explanation), officialTitle };
}

module.exports = { WIKIDATA_ENGLISH_TITLES, preserveOfficialProperNouns };
