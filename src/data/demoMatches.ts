import type { Match } from "../types";

export const DEMO_MATCHES: Match[] = [
  {
    id: "m001",
    matchNo: 1,
    phase: "group",
    kickoffAt: "2026-06-11T15:00:00-04:00",
    venue: "Mexico City Stadium",
    homeTeam: "墨西哥",
    awayTeam: "南非",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    winner: null,
    sourceUpdatedAt: "FIFA official scores-fixtures reference"
  },
  {
    id: "m002",
    matchNo: 2,
    phase: "group",
    kickoffAt: "2026-06-11T22:00:00-04:00",
    venue: "Estadio Akron, Guadalajara",
    homeTeam: "韩国",
    awayTeam: "捷克",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    winner: null,
    sourceUpdatedAt: "FIFA official scores-fixtures reference"
  },
  {
    id: "m003",
    matchNo: 3,
    phase: "group",
    kickoffAt: "2026-06-12T15:00:00-04:00",
    venue: "Toronto",
    homeTeam: "加拿大",
    awayTeam: "波黑",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    winner: null,
    sourceUpdatedAt: "FIFA official scores-fixtures reference"
  },
  {
    id: "m004",
    matchNo: 4,
    phase: "group",
    kickoffAt: "2026-06-12T21:00:00-04:00",
    venue: "Los Angeles",
    homeTeam: "美国",
    awayTeam: "巴拉圭",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    winner: null,
    sourceUpdatedAt: "FIFA official scores-fixtures reference"
  },
  {
    id: "m005",
    matchNo: 5,
    phase: "group",
    kickoffAt: "2026-06-14T05:00:00+08:00",
    venue: "New York New Jersey",
    homeTeam: "待定 C1",
    awayTeam: "待定 C2",
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    winner: null,
    sourceUpdatedAt: "FIFA official scores-fixtures reference"
  }
];

export const DEMO_PICKS = [] as const;

export const DEMO_FEATURED_MATCHES = [
  { matchId: "m001", selectedBy: "liang-dongxu", selectedAt: "2026-06-10T21:00:00-04:00" }
] as const;
