import { describe, expect, it } from "vitest";
import { FRIENDS } from "../src/data/friends";
import {
  canManageFeaturedMatch,
  canManageFeaturedMatches,
  calculateStandings,
  canPick,
  choicesForMatch,
  easternDateKey,
  formatEasternTime,
  getDayNumber,
  getPreviousMatchDay,
  getTodayMatches,
  hasTbdTeam,
  shanghaiDateKey
} from "../src/lib/rules";
import type { Match, Pick } from "../src/types";

const baseMatch: Match = {
  id: "m1",
  matchNo: 1,
  phase: "group",
  kickoffAt: "2026-06-12T08:00:00+08:00",
  venue: "Test",
  homeTeam: "主队",
  awayTeam: "客队",
  homeScore: 1,
  awayScore: 1,
  status: "finished",
  winner: "draw"
};

describe("prediction rules", () => {
  it("scores wrong picks as 10 points and correct picks as 0", () => {
    const picks: Pick[] = [
      { id: "p1", userId: FRIENDS[0].id, matchId: "m1", choice: "draw", lockedAt: "2026-06-11T12:00:00+08:00" },
      { id: "p2", userId: FRIENDS[1].id, matchId: "m1", choice: "home", lockedAt: "2026-06-11T12:00:00+08:00" }
    ];

    const standings = calculateStandings(FRIENDS.slice(0, 2), [baseMatch], picks);

    expect(standings.find((row) => row.userId === FRIENDS[0].id)?.points).toBe(0);
    expect(standings.find((row) => row.userId === FRIENDS[1].id)?.points).toBe(10);
  });

  it("removes draw from knockout choices", () => {
    expect(choicesForMatch({ ...baseMatch, phase: "round16" })).toEqual(["home", "away"]);
  });

  it("blocks picks after kickoff", () => {
    const scheduled: Match = { ...baseMatch, status: "scheduled", winner: null, kickoffAt: "2026-06-12T08:00:00+08:00" };
    expect(canPick(scheduled, new Date("2026-06-12T08:01:00+08:00"))).toBe(false);
  });

  it("uses Asia Shanghai date keys", () => {
    expect(shanghaiDateKey("2026-06-11T18:30:00Z")).toBe("2026-06-12");
  });

  it("uses Eastern date keys for match-day organization", () => {
    expect(easternDateKey("2026-06-13T02:30:00Z")).toBe("2026-06-12");
  });

  it("calculates match day from tournament dates", () => {
    const matches = [
      baseMatch,
      { ...baseMatch, id: "m2", matchNo: 2, kickoffAt: "2026-06-13T11:00:00+08:00" }
    ];
    expect(getDayNumber(matches, new Date("2026-06-13T12:00:00+08:00"))).toBe(2);
  });

  it("returns the full current match-day schedule instead of auto-selecting two matches", () => {
    const matches = [
      { ...baseMatch, id: "m1", matchNo: 1, status: "scheduled" as const, winner: null, kickoffAt: "2026-06-13T08:00:00+08:00" },
      { ...baseMatch, id: "m2", matchNo: 2, status: "scheduled" as const, winner: null, kickoffAt: "2026-06-13T09:00:00+08:00" },
      { ...baseMatch, id: "m3", matchNo: 3, status: "scheduled" as const, winner: null, kickoffAt: "2026-06-13T10:00:00+08:00" }
    ];

    expect(getTodayMatches(matches, new Date("2026-06-13T09:30:00+08:00"))).toHaveLength(3);
  });

  it("moves to the next match day after all current Eastern day results are entered", () => {
    const matches = [
      { ...baseMatch, id: "m1", matchNo: 1, kickoffAt: "2026-06-12T15:00:00-04:00", status: "finished" as const, winner: "home" as const },
      { ...baseMatch, id: "m2", matchNo: 2, kickoffAt: "2026-06-12T22:00:00-04:00", status: "finished" as const, winner: "away" as const },
      { ...baseMatch, id: "m3", matchNo: 3, kickoffAt: "2026-06-13T15:00:00-04:00", status: "scheduled" as const, winner: null },
      { ...baseMatch, id: "m4", matchNo: 4, kickoffAt: "2026-06-13T21:00:00-04:00", status: "scheduled" as const, winner: null }
    ];

    const activeMatches = getTodayMatches(matches, new Date("2026-06-12T23:30:00-04:00"));
    expect(activeMatches.map((match) => match.id)).toEqual(["m3", "m4"]);
    expect(getPreviousMatchDay(matches, new Date("2026-06-12T23:30:00-04:00"))?.matches.map((match) => match.id)).toEqual(["m1", "m2"]);
  });

  it("moves to the next day when all featured matches on the current day are finished", () => {
    const matches = [
      { ...baseMatch, id: "m1", matchNo: 1, kickoffAt: "2026-06-12T15:00:00-04:00", status: "scheduled" as const, winner: null },
      { ...baseMatch, id: "m2", matchNo: 2, kickoffAt: "2026-06-12T22:00:00-04:00", status: "finished" as const, winner: "home" as const },
      { ...baseMatch, id: "m3", matchNo: 3, kickoffAt: "2026-06-13T15:00:00-04:00", status: "scheduled" as const, winner: null }
    ];
    const featuredIds = new Set(["m2"]);

    expect(getTodayMatches(matches, new Date("2026-06-12T23:30:00-04:00"), featuredIds).map((match) => match.id)).toEqual(["m3"]);
    expect(getPreviousMatchDay(matches, new Date("2026-06-12T23:30:00-04:00"), featuredIds)?.matches.map((match) => match.id)).toEqual(["m2"]);
  });

  it("lets admins manage a featured match until that match kicks off", () => {
    const matches = [
      { ...baseMatch, id: "m1", matchNo: 1, status: "scheduled" as const, winner: null, kickoffAt: "2026-06-13T08:00:00+08:00" },
      { ...baseMatch, id: "m2", matchNo: 2, status: "scheduled" as const, winner: null, kickoffAt: "2026-06-13T11:00:00+08:00" }
    ];

    expect(canManageFeaturedMatches(matches, new Date("2026-06-13T07:59:00+08:00"))).toBe(true);
    expect(canManageFeaturedMatch(matches[0], new Date("2026-06-13T08:00:00+08:00"))).toBe(false);
    expect(canManageFeaturedMatch(matches[1], new Date("2026-06-13T08:00:00+08:00"))).toBe(true);
    expect(canManageFeaturedMatches(matches, new Date("2026-06-13T08:00:00+08:00"))).toBe(true);
    expect(canManageFeaturedMatches(matches, new Date("2026-06-13T11:00:00+08:00"))).toBe(false);
  });

  it("formats Eastern and Beijing times separately", () => {
    expect(formatEasternTime("2026-06-13T08:00:00+08:00")).toBe("20:00");
    expect(formatEasternTime("2026-06-13T11:00:00+08:00")).toBe("23:00");
  });

  it("detects TBD teams that need knockout updates", () => {
    expect(hasTbdTeam({ ...baseMatch, homeTeam: "待定 1A", awayTeam: "韩国" })).toBe(true);
    expect(hasTbdTeam({ ...baseMatch, homeTeam: "TBD", awayTeam: "捷克" })).toBe(true);
    expect(hasTbdTeam({ ...baseMatch, homeTeam: "墨西哥", awayTeam: "南非" })).toBe(false);
  });
});
