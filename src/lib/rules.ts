import type { Friend, Match, Pick, PickChoice, Standing } from "../types";

export const SHANGHAI_TZ = "Asia/Shanghai";
export const EASTERN_TZ = "America/New_York";

export function choiceLabel(choice: PickChoice) {
  if (choice === "home") return "主胜";
  if (choice === "away") return "客胜";
  return "平";
}

export function canPick(match: Match, now = new Date()) {
  return match.status === "scheduled" && now.getTime() < new Date(match.kickoffAt).getTime();
}

export function choicesForMatch(match: Match): PickChoice[] {
  return match.phase === "group" ? ["home", "draw", "away"] : ["home", "away"];
}

export function canRecordResult(match: Match, now = new Date()) {
  const earliestResultTime = new Date(match.kickoffAt).getTime() + 2 * 60 * 60 * 1000;
  return now.getTime() >= earliestResultTime;
}

export function hasTbdTeam(match: Match) {
  return [match.homeTeam, match.awayTeam].some((team) => /待定|TBD|to be determined/i.test(team));
}

export function isPickCorrect(pick: Pick, match: Match) {
  if (match.status !== "finished" || !match.winner) return null;
  return pick.choice === match.winner;
}

export function calculateStandings(friends: Friend[], matches: Match[], picks: Pick[]): Standing[] {
  const byMatch = new Map(matches.map((match) => [match.id, match]));
  const rows = friends.map((friend) => {
    const userPicks = picks.filter((pick) => pick.userId === friend.id);
    let wrong = 0;
    let played = 0;

    for (const pick of userPicks) {
      const match = byMatch.get(pick.matchId);
      if (!match || match.status !== "finished" || !match.winner) continue;
      played += 1;
      if (pick.choice !== match.winner) wrong += 1;
    }

    return {
      userId: friend.id,
      displayName: friend.displayName,
      wrong,
      points: wrong * 10,
      played,
      rank: 0
    };
  });

  rows.sort((a, b) => a.points - b.points || b.played - a.played || a.displayName.localeCompare(b.displayName, "zh-Hans-CN"));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function dateKeyForTimezone(input: string | Date, timeZone: string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function easternDateKey(input: string | Date) {
  return dateKeyForTimezone(input, EASTERN_TZ);
}

export function shanghaiDateKey(input: string | Date) {
  return dateKeyForTimezone(input, SHANGHAI_TZ);
}

function formatDate(input: string | Date, timeZone: string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
}

export function formatEasternDate(input: string | Date) {
  return formatDate(input, EASTERN_TZ);
}

export function formatShanghaiDate(input: string | Date) {
  return formatDate(input, SHANGHAI_TZ);
}

function formatTime(input: string | Date, timeZone: string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function formatEasternTime(input: string | Date) {
  return formatTime(input, EASTERN_TZ);
}

export function formatShanghaiTime(input: string | Date) {
  return formatTime(input, SHANGHAI_TZ);
}

export function getTournamentDays(matches: Match[]) {
  return Array.from(new Set(matches.map((match) => easternDateKey(match.kickoffAt)))).sort();
}

export function getDayNumber(matches: Match[], date = new Date()) {
  const days = getTournamentDays(matches);
  const key = easternDateKey(date);
  const exact = days.indexOf(key);
  if (exact >= 0) return exact + 1;
  const before = days.filter((day) => day < key).length;
  return Math.min(Math.max(before + 1, 1), days.length);
}

export function getTodayMatches(matches: Match[], date = new Date(), featuredMatchIds?: ReadonlySet<string>) {
  const key = easternDateKey(date);
  const sameDay = matches.filter((match) => easternDateKey(match.kickoffAt) === key);
  const sameDayFeatured = featuredMatchIds ? sameDay.filter((match) => featuredMatchIds.has(match.id)) : [];
  const requiredResults = sameDayFeatured.length ? sameDayFeatured : sameDay;
  if (sameDay.length && requiredResults.some((match) => match.status !== "finished")) return sameDay;

  const nextScheduled = matches.find((match) => easternDateKey(match.kickoffAt) > key && match.status !== "finished")
    ?? matches.find((match) => match.status !== "finished");
  if (!nextScheduled) return [];
  const nextKey = easternDateKey(nextScheduled.kickoffAt);
  return matches.filter((match) => easternDateKey(match.kickoffAt) === nextKey);
}

export function getCurrentMatchDateKey(matches: Match[], date = new Date(), featuredMatchIds?: ReadonlySet<string>) {
  const todayMatches = getTodayMatches(matches, date, featuredMatchIds);
  return easternDateKey(todayMatches[0]?.kickoffAt ?? date);
}

export function getPreviousMatchDay(matches: Match[], date = new Date(), featuredMatchIds?: ReadonlySet<string>) {
  const activeKey = getCurrentMatchDateKey(matches, date, featuredMatchIds);
  const previous = getTournamentDays(matches).filter((day) => day < activeKey).pop();
  if (!previous) return null;
  const previousMatches = matches.filter((match) => easternDateKey(match.kickoffAt) === previous);
  const resultMatches = featuredMatchIds
    ? previousMatches.filter((match) => featuredMatchIds.has(match.id) || match.status === "finished")
    : previousMatches;
  return {
    dateKey: previous,
    dayNo: getTournamentDays(matches).indexOf(previous) + 1,
    matches: resultMatches
  };
}

export function userDailyPickCount(userId: string, picks: Pick[], matches: Match[], dateKey: string) {
  const matchIds = new Set(matches.filter((match) => easternDateKey(match.kickoffAt) === dateKey).map((match) => match.id));
  return picks.filter((pick) => pick.userId === userId && matchIds.has(pick.matchId)).length;
}

export function canManageFeaturedMatch(match: Match, now = new Date()) {
  return match.status === "scheduled" && now.getTime() < new Date(match.kickoffAt).getTime();
}

export function canManageFeaturedMatches(matchesForDay: Match[], now = new Date()) {
  return matchesForDay.some((match) => canManageFeaturedMatch(match, now));
}
