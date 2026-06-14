import type { Match } from "../types";
import { hasTbdTeam } from "./rules";

const FIFA_2026_MATCHES_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&count=200&idCompetition=17&idSeason=285023";

const TEAM_NAME_ZH: Record<string, string> = {
  "Algeria": "阿尔及利亚",
  "Argentina": "阿根廷",
  "Australia": "澳大利亚",
  "Austria": "奥地利",
  "Belgium": "比利时",
  "Bosnia and Herzegovina": "波黑",
  "Brazil": "巴西",
  "Cabo Verde": "佛得角",
  "Canada": "加拿大",
  "Colombia": "哥伦比亚",
  "Congo DR": "民主刚果",
  "Croatia": "克罗地亚",
  "Curaçao": "库拉索",
  "Czechia": "捷克",
  "Côte d'Ivoire": "科特迪瓦",
  "Ecuador": "厄瓜多尔",
  "Egypt": "埃及",
  "England": "英格兰",
  "France": "法国",
  "Germany": "德国",
  "Ghana": "加纳",
  "Haiti": "海地",
  "IR Iran": "伊朗",
  "Iraq": "伊拉克",
  "Japan": "日本",
  "Jordan": "约旦",
  "Korea Republic": "韩国",
  "Mexico": "墨西哥",
  "Morocco": "摩洛哥",
  "Netherlands": "荷兰",
  "New Zealand": "新西兰",
  "Norway": "挪威",
  "Panama": "巴拿马",
  "Paraguay": "巴拉圭",
  "Portugal": "葡萄牙",
  "Qatar": "卡塔尔",
  "Saudi Arabia": "沙特阿拉伯",
  "Scotland": "苏格兰",
  "Senegal": "塞内加尔",
  "South Africa": "南非",
  "Spain": "西班牙",
  "Sweden": "瑞典",
  "Switzerland": "瑞士",
  "Tunisia": "突尼斯",
  "Türkiye": "土耳其",
  "USA": "美国",
  "Uruguay": "乌拉圭",
  "Uzbekistan": "乌兹别克斯坦"
};

type FifaLocaleText = { Locale?: string; Description?: string };
type FifaTeam = {
  TeamName?: FifaLocaleText[];
  ShortClubName?: string;
  Abbreviation?: string;
};
type FifaMatch = {
  MatchNumber?: number;
  Home?: FifaTeam;
  Away?: FifaTeam;
};

export type TeamNameUpdate = {
  id: string;
  homeTeam: string;
  awayTeam: string;
};

export async function getFifaKnockoutTeamUpdates(matches: Match[], fetcher: typeof fetch = fetch) {
  const tbdKnockoutMatches = matches.filter((match) => match.phase !== "group" && hasTbdTeam(match));
  if (!tbdKnockoutMatches.length) return [];

  const response = await fetcher(FIFA_2026_MATCHES_URL);
  if (!response.ok) throw new Error(`FIFA schedule responded ${response.status}`);

  const payload = await response.json() as { Results?: FifaMatch[] };
  const byMatchNo = new Map((payload.Results ?? []).map((match) => [Number(match.MatchNumber), match]));

  return tbdKnockoutMatches.flatMap((match): TeamNameUpdate[] => {
    const fifaMatch = byMatchNo.get(match.matchNo);
    if (!fifaMatch) return [];

    const nextHome = hasTbdText(match.homeTeam) ? translatedTeamName(fifaMatch.Home) : match.homeTeam;
    const nextAway = hasTbdText(match.awayTeam) ? translatedTeamName(fifaMatch.Away) : match.awayTeam;

    if (!nextHome || !nextAway || hasTbdText(nextHome) || hasTbdText(nextAway)) return [];
    if (nextHome === match.homeTeam && nextAway === match.awayTeam) return [];

    return [{ id: match.id, homeTeam: nextHome, awayTeam: nextAway }];
  });
}

function translatedTeamName(team?: FifaTeam) {
  const english = pickEnglish(team?.TeamName) || team?.ShortClubName || team?.Abbreviation || "";
  return TEAM_NAME_ZH[english] ?? english;
}

function pickEnglish(values?: FifaLocaleText[]) {
  return values?.find((value) => value.Locale?.toLowerCase().startsWith("en"))?.Description
    ?? values?.[0]?.Description
    ?? "";
}

function hasTbdText(value: string) {
  return /待定|TBD|to be determined/i.test(value);
}
