import { describe, expect, it } from "vitest";
import { getFifaKnockoutTeamUpdates } from "../src/lib/fifaTeamSync";
import type { Match } from "../src/types";

const baseMatch: Match = {
  id: "m073",
  matchNo: 73,
  phase: "round32",
  kickoffAt: "2026-06-28T19:00:00Z",
  venue: "Los Angeles Stadium",
  homeTeam: "待定",
  awayTeam: "待定",
  homeScore: null,
  awayScore: null,
  status: "scheduled",
  winner: null
};

describe("FIFA knockout team sync", () => {
  it("fills only TBD knockout team names from FIFA data", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      Results: [{
        MatchNumber: 73,
        Home: { TeamName: [{ Locale: "en-GB", Description: "Mexico" }] },
        Away: { TeamName: [{ Locale: "en-GB", Description: "South Africa" }] }
      }]
    }));

    await expect(getFifaKnockoutTeamUpdates([baseMatch], fetcher as typeof fetch)).resolves.toEqual([
      { id: "m073", homeTeam: "墨西哥", awayTeam: "南非" }
    ]);
  });

  it("does not overwrite manually filled team names", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      Results: [{
        MatchNumber: 73,
        Home: { TeamName: [{ Locale: "en-GB", Description: "Mexico" }] },
        Away: { TeamName: [{ Locale: "en-GB", Description: "South Africa" }] }
      }]
    }));

    const updates = await getFifaKnockoutTeamUpdates([
      { ...baseMatch, homeTeam: "管理员手动主队", awayTeam: "待定" }
    ], fetcher as typeof fetch);

    expect(updates).toEqual([
      { id: "m073", homeTeam: "管理员手动主队", awayTeam: "南非" }
    ]);
  });
});
