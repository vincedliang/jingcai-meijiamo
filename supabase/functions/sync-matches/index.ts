import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type SourceMatch = Record<string, unknown>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OFFICIAL_SCHEDULE_URL =
  Deno.env.get("OFFICIAL_SCHEDULE_URL") ??
  "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=US&wtw-filter=ALL";
const MATCH_DATA_API_URL = Deno.env.get("MATCH_DATA_API_URL");
const MATCH_DATA_API_TOKEN = Deno.env.get("MATCH_DATA_API_TOKEN");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async () => {
  if (!MATCH_DATA_API_URL) {
    return Response.json({
      ok: false,
      error: "MATCH_DATA_API_URL is not configured. Import fixtures from the official FIFA scores-fixtures page first.",
      officialScheduleUrl: OFFICIAL_SCHEDULE_URL
    }, { status: 422 });
  }

  const response = await fetch(MATCH_DATA_API_URL, {
    headers: MATCH_DATA_API_TOKEN ? { Authorization: `Bearer ${MATCH_DATA_API_TOKEN}` } : undefined
  });
  if (!response.ok) {
    return Response.json({ ok: false, error: `source responded ${response.status}` }, { status: 502 });
  }

  const payload = await response.json();
  const sourceMatches: SourceMatch[] = Array.isArray(payload) ? payload : payload.matches ?? payload.data ?? payload.games ?? [];
  if (!Array.isArray(sourceMatches)) {
    return Response.json({ ok: false, error: "source payload does not contain matches" }, { status: 422 });
  }

  const rows = sourceMatches.map(normalizeMatch).filter(Boolean);
  const { error } = await supabase.from("matches").upsert(rows, { onConflict: "id" });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({ ok: true, count: rows.length });
});

function normalizeMatch(item: SourceMatch) {
  const id = stringValue(item.id) ?? stringValue(item.match_id) ?? stringValue(item.matchNo);
  const kickoff = stringValue(item.kickoff_at) ?? stringValue(item.date) ?? stringValue(item.utcDate) ?? parseLocalDate(stringValue(item.local_date));
  if (!id || !kickoff) return null;

  const homeScore = numberValue(item.home_score ?? item.homeScore);
  const awayScore = numberValue(item.away_score ?? item.awayScore);
  const status = normalizeStatus(stringValue(item.status));
  const phase = normalizePhase(stringValue(item.phase) ?? stringValue(item.stage));

  return {
    id,
    match_no: numberValue(item.match_no ?? item.matchNo ?? item.number) ?? 0,
    phase,
    kickoff_at: kickoff,
    venue: stringValue(item.venue) ?? stringValue(item.stadium) ?? stringValue(item.stadium_id) ?? "",
    home_team: stringValue(item.home_team) ?? stringValue(item.homeTeam) ?? stringValue(item.home_team_label) ?? `球队 ${stringValue(item.home_team_id) ?? "待定"}`,
    away_team: stringValue(item.away_team) ?? stringValue(item.awayTeam) ?? stringValue(item.away_team_label) ?? `球队 ${stringValue(item.away_team_id) ?? "待定"}`,
    home_score: homeScore,
    away_score: awayScore,
    status,
    winner: normalizeWinner(item, phase, homeScore, awayScore, status),
    source: stringValue(item.source) ?? "fifa.com scores-fixtures",
    source_updated_at: new Date().toISOString()
  };
}

function normalizeWinner(item: SourceMatch, phase: string, homeScore: number | null, awayScore: number | null, status: string) {
  const raw = stringValue(item.winner);
  if (raw === "home" || raw === "draw" || raw === "away") return raw;
  if (status !== "finished" || homeScore === null || awayScore === null) return null;
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  if (phase === "group") return "draw";
  const advanced = stringValue(item.advanced) ?? stringValue(item.qualified);
  if (advanced === "home" || advanced === "away") return advanced;
  return null;
}

function normalizeStatus(status?: string | null) {
  if (!status) return "scheduled";
  const value = status.toLowerCase();
  if (value.includes("finish") || value === "ft") return "finished";
  if (value.includes("live") || value.includes("progress")) return "live";
  return "scheduled";
}

function normalizePhase(phase?: string | null) {
  const value = (phase ?? "group").toLowerCase();
  if (value.includes("16")) return "round16";
  if (value.includes("quarter")) return "quarter";
  if (value.includes("semi")) return "semi";
  if (value.includes("third")) return "third";
  if (value.includes("final")) return "final";
  return "group";
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return null;
}

function parseLocalDate(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const [, month, day, year, hour, minute] = match;
  return `${year}-${month}-${day}T${hour.padStart(2, "0")}:${minute}:00-05:00`;
}
