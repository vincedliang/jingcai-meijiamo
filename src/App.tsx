import { Check, Lock, Music, Music2, ShieldCheck, Trophy, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import heroMatch from "./assets/worldcup-core-visual.jpg";
import { FIFA_SCORES_FIXTURES_URL } from "./config/sources";
import { DEMO_FEATURED_MATCHES, DEMO_MATCHES, DEMO_PICKS } from "./data/demoMatches";
import { FRIENDS } from "./data/friends";
import {
  calculateStandings,
  canPick,
  canManageFeaturedMatches,
  choiceLabel,
  choicesForMatch,
  easternDateKey,
  formatEasternDate,
  formatEasternTime,
  hasTbdTeam,
  formatShanghaiDate,
  formatShanghaiTime,
  getCurrentMatchDateKey,
  getDayNumber,
  getPreviousMatchDay,
  getTodayMatches,
  userDailyPickCount
} from "./lib/rules";
import { isDemoMode, supabase } from "./lib/supabase";
import type { FeaturedMatch, Friend, Match, Pick, PickChoice } from "./types";

const MAX_DAILY_PICKS = 2;

export function App() {
  const [friends, setFriends] = useState<Friend[]>(FRIENDS);
  const [selectedUserId, setSelectedUserId] = useState(FRIENDS[0].id);
  const [password, setPassword] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(isDemoMode ? FRIENDS[0].id : null);
  const [matches, setMatches] = useState<Match[]>(DEMO_MATCHES);
  const [picks, setPicks] = useState<Pick[]>([...DEMO_PICKS]);
  const [featuredMatches, setFeaturedMatches] = useState<FeaturedMatch[]>([...DEMO_FEATURED_MATCHES]);
  const [musicOn, setMusicOn] = useState(() => localStorage.getItem("musicOn") === "true");
  const [lastLocked, setLastLocked] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lockAudioRef = useRef<HTMLAudioElement>(null);

  const now = new Date();
  const effectiveUserId = activeUserId ?? selectedUserId;
  const selectedUser = friends.find((friend) => friend.id === effectiveUserId) ?? friends.find((friend) => friend.id === selectedUserId) ?? friends[0];
  const isCurrentUserAdmin = Boolean(selectedUser.isAdmin);
  const todayMatches = getTodayMatches(matches, now);
  const todayKey = getCurrentMatchDateKey(matches, now);
  const canManageTodayFeatured = canManageFeaturedMatches(todayMatches, now);
  const featuredIds = new Set(featuredMatches.map((featured) => featured.matchId));
  const todayFeaturedCount = todayMatches.filter((match) => featuredIds.has(match.id)).length;
  const todayPickCount = effectiveUserId ? userDailyPickCount(effectiveUserId, picks as Pick[], matches, todayKey) : 0;
  const standings = useMemo(() => calculateStandings(friends, matches, picks as Pick[]), [friends, matches, picks]);
  const previousDay = getPreviousMatchDay(matches, now);

  useEffect(() => {
    if (isDemoMode || !supabase) return;
    const client = supabase;

    async function load() {
      const [{ data: profiles }, { data: remoteMatches }, { data: remotePicks }, { data: remoteFeatured }] = await Promise.all([
        client.from("profiles").select("id, display_name, is_admin"),
        client.from("matches").select("*").order("kickoff_at", { ascending: true }),
        client.from("picks").select("*"),
        client.from("featured_matches").select("*")
      ]);

      if (profiles?.length) {
        setFriends(profiles.map((profile, index) => ({
          id: profile.id,
          displayName: profile.display_name,
          isAdmin: Boolean(profile.is_admin),
          color: FRIENDS[index % FRIENDS.length].color
        })));
      }
      if (remoteMatches?.length) setMatches(remoteMatches.map(fromMatchRow));
      if (remotePicks) setPicks(remotePicks.map(fromPickRow));
      if (remoteFeatured) setFeaturedMatches(remoteFeatured.map(fromFeaturedMatchRow));
    }

    void load();

    const channel = client
      .channel("public-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "picks" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "featured_matches" }, () => void load())
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  async function signIn() {
    if (isDemoMode || !supabase) {
      setActiveUserId(selectedUserId);
      return;
    }

    const email = `${selectedUserId}@jingcai.local`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      alert("登录失败，请检查口令。");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).single();
    setActiveUserId(profile?.id ?? data.user.id);
  }

  function toggleMusic() {
    const next = !musicOn;
    setMusicOn(next);
    localStorage.setItem("musicOn", String(next));
    const audio = audioRef.current;
    if (!audio) return;
    if (next) {
      void audio.play().catch(() => setMusicOn(false));
    } else {
      audio.pause();
    }
  }

  function lockPick(match: Match, choice: PickChoice) {
    if (!effectiveUserId) return;
    if (!featuredIds.has(match.id)) return;
    const already = picks.some((pick) => pick.userId === effectiveUserId && pick.matchId === match.id);
    const dayCount = userDailyPickCount(effectiveUserId, picks as Pick[], matches, easternDateKey(match.kickoffAt));
    if (already || !canPick(match) || dayCount >= MAX_DAILY_PICKS) return;

    const pick: Pick = {
      id: crypto.randomUUID(),
      userId: effectiveUserId,
      matchId: match.id,
      choice,
      lockedAt: new Date().toISOString()
    };

    if (!isDemoMode && supabase) {
      void supabase.from("picks").insert({
        user_id: effectiveUserId,
        match_id: match.id,
        choice
      });
    }

    setPicks((current) => [...current, pick]);
    setLastLocked(match.id);
    void lockAudioRef.current?.play().catch(() => undefined);
    window.setTimeout(() => setLastLocked(null), 1600);
  }

  function toggleFeaturedMatch(match: Match) {
    if (!isCurrentUserAdmin || !effectiveUserId || !canManageTodayFeatured) return;
    const selected = featuredIds.has(match.id);
    const sameDayFeatured = todayMatches.filter((item) => featuredIds.has(item.id));
    if (!selected && sameDayFeatured.length >= MAX_DAILY_PICKS) return;

    if (!isDemoMode && supabase) {
      if (selected) {
        void supabase.from("featured_matches").delete().eq("match_id", match.id);
      } else {
        void supabase.from("featured_matches").insert({
          match_id: match.id,
          selected_by: effectiveUserId
        });
      }
    }

    setFeaturedMatches((current) => {
      if (selected) return current.filter((item) => item.matchId !== match.id);
      return [
        ...current,
        {
          matchId: match.id,
          selectedBy: effectiveUserId,
          selectedAt: new Date().toISOString()
        }
      ];
    });
  }

  function updateMatchTeams(match: Match) {
    if (!isCurrentUserAdmin) return;
    const homeTeam = window.prompt("请输入主队名称", match.homeTeam)?.trim();
    if (!homeTeam) return;
    const awayTeam = window.prompt("请输入客队名称", match.awayTeam)?.trim();
    if (!awayTeam) return;

    if (!isDemoMode && supabase) {
      void supabase
        .from("matches")
        .update({
          home_team: homeTeam,
          away_team: awayTeam,
          source_updated_at: new Date().toISOString()
        })
        .eq("id", match.id);
    }

    setMatches((current) => current.map((item) => (
      item.id === match.id
        ? { ...item, homeTeam, awayTeam, sourceUpdatedAt: new Date().toISOString() }
        : item
    )));
  }

  return (
    <main className="shell">
      <audio ref={audioRef} src="/audio/dai-dai.m4a" loop preload="none" />
      <audio ref={lockAudioRef} src="/audio/lock.mp3" preload="none" />

      <section className="hero">
        <img src={heroMatch} alt="" className="heroImage" />
        <div className="heroOverlay" />
        <div className="topBar">
          <div>
            <p className="eyebrow">竞猜美加墨</p>
            <h1>美东 {formatEasternDate(now)}</h1>
            <p>北京时间 {formatShanghaiDate(now)} · 世界杯第 {getDayNumber(matches, now)} 个比赛日</p>
          </div>
          <button className="iconButton" onClick={toggleMusic} aria-label={musicOn ? "关闭音乐" : "开启音乐"}>
            {musicOn ? <Music2 size={21} /> : <VolumeX size={21} />}
          </button>
        </div>
        <div className="heroBottom">
          <div>
            <span className="statusDot" />
            {isDemoMode ? "演示模式" : "实时同步"}
          </div>
          <div>{selectedUser.displayName}{selectedUser.isAdmin ? " · 管理员" : ""} 今日已选 {todayPickCount}/2</div>
        </div>
      </section>

      <section className="panel compact">
        <label htmlFor="friend">当前用户</label>
        <select
          id="friend"
          value={selectedUserId}
          onChange={(event) => {
            setSelectedUserId(event.target.value);
            if (isDemoMode) setActiveUserId(event.target.value);
          }}
        >
          {FRIENDS.map((friend) => (
            <option value={friend.id} key={friend.id}>{friend.displayName}{friend.isAdmin ? "（管理员）" : ""}</option>
          ))}
        </select>
        {!isDemoMode ? (
          <>
            <label htmlFor="password">口令</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="primaryButton" onClick={signIn}>登录</button>
          </>
        ) : null}
      </section>

      <section className="ranking">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">实时排名</p>
            <h2>低分在前</h2>
          </div>
          <Trophy size={22} />
        </div>
        <div className="rankList">
          {standings.map((row) => (
            <div className="rankRow" key={row.userId}>
              <strong>{row.rank}</strong>
              <span>{row.displayName}</span>
              <small>{row.played} 场</small>
              <b>{row.points} 分</b>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">当前比赛日赛程（按美东时间）</p>
            <h2>{todayKey}</h2>
          </div>
          <span className="pill">{todayFeaturedCount}/2 场竞猜</span>
        </div>
        {isCurrentUserAdmin && !canManageTodayFeatured ? (
          <p className="muted deadlineNote">本比赛日第一场已经开赛，管理员不能再调整竞猜场次。</p>
        ) : null}
        <a className="sourceLink" href={FIFA_SCORES_FIXTURES_URL} target="_blank" rel="noreferrer">
          赛程与比赛日以 FIFA 官方页面为准
        </a>
        <div className="matchList">
          {todayMatches.map((match) => (
              <MatchCard
              key={match.id}
              match={match}
              friends={friends}
              picks={picks as Pick[]}
              selectedUserId={effectiveUserId ?? ""}
              selectedForPick={featuredIds.has(match.id)}
              isAdmin={isCurrentUserAdmin}
              canFeatureMore={todayFeaturedCount < MAX_DAILY_PICKS}
              canManageFeatured={canManageTodayFeatured}
              dailyFull={todayPickCount >= MAX_DAILY_PICKS}
              justLocked={lastLocked === match.id}
              onPick={lockPick}
              onToggleFeatured={toggleFeaturedMatch}
              onUpdateTeams={updateMatchTeams}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">前一比赛日</p>
            <h2>{previousDay ? `第 ${previousDay.dayNo} 日赛果` : "暂无赛果"}</h2>
          </div>
          <Music size={20} />
        </div>
        {previousDay ? (
          <div className="matchList">
            {previousDay.matches.map((match) => (
              <ResultCard key={match.id} match={match} picks={picks as Pick[]} friends={friends} />
            ))}
          </div>
        ) : (
          <p className="muted">比赛开始后，这里会显示上一比赛日的赛果和大家的选择。</p>
        )}
      </section>
    </main>
  );
}

function MatchCard({
  match,
  friends,
  picks,
  selectedUserId,
  selectedForPick,
  isAdmin,
  canFeatureMore,
  canManageFeatured,
  dailyFull,
  justLocked,
  onPick,
  onToggleFeatured,
  onUpdateTeams
}: {
  match: Match;
  friends: Friend[];
  picks: Pick[];
  selectedUserId: string;
  selectedForPick: boolean;
  isAdmin: boolean;
  canFeatureMore: boolean;
  canManageFeatured: boolean;
  dailyFull: boolean;
  justLocked: boolean;
  onPick: (match: Match, choice: PickChoice) => void;
  onToggleFeatured: (match: Match) => void;
  onUpdateTeams: (match: Match) => void;
}) {
  const userPick = picks.find((pick) => pick.userId === selectedUserId && pick.matchId === match.id);
  const locked = Boolean(userPick);
  const disabled = !selectedForPick || locked || dailyFull || !canPick(match);

  return (
    <article className={`matchCard ${justLocked ? "lockedFlash" : ""}`}>
      <div className="matchMeta">
        <span>#{match.matchNo}</span>
        <span>美东 {formatEasternTime(match.kickoffAt)}</span>
        <span>北京 {formatShanghaiTime(match.kickoffAt)}</span>
        <span>{match.venue}</span>
      </div>
      <div className="cardTop">
        <span className={selectedForPick ? "openBadge" : "scheduleBadge"}>
          {selectedForPick ? "开放竞猜" : "仅显示赛程"}
        </span>
        {isAdmin ? (
          <div className="adminActions">
            <button
              className={selectedForPick ? "adminToggle active" : "adminToggle"}
              disabled={!canManageFeatured || (!selectedForPick && !canFeatureMore)}
              onClick={() => onToggleFeatured(match)}
            >
              <ShieldCheck size={15} />
              {selectedForPick ? "取消竞猜" : "设为竞猜"}
            </button>
            {hasTbdTeam(match) ? (
              <button className="adminToggle" onClick={() => onUpdateTeams(match)}>
                更新球队
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="teams">
        <strong>{match.homeTeam}</strong>
        <span>vs</span>
        <strong>{match.awayTeam}</strong>
      </div>
      {selectedForPick ? (
        <div className="choiceGrid">
          {choicesForMatch(match).map((choice) => (
            <button
              key={choice}
              disabled={disabled}
              className={userPick?.choice === choice ? "choice active" : "choice"}
              onClick={() => onPick(match, choice)}
            >
              {userPick?.choice === choice ? <Lock size={15} /> : null}
              {choice === "home" ? match.homeTeam : choice === "away" ? match.awayTeam : choiceLabel(choice)}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted scheduleHint">等待管理员选择为今日竞猜场次。</p>
      )}
      <PickStrip matchId={match.id} picks={picks} friends={friends} />
    </article>
  );
}

function ResultCard({ match, picks, friends }: { match: Match; picks: Pick[]; friends: Friend[] }) {
  return (
    <article className="matchCard result">
      <div className="matchMeta">
        <span>#{match.matchNo}</span>
        <span>美东 {formatEasternTime(match.kickoffAt)}</span>
        <span>北京 {formatShanghaiTime(match.kickoffAt)}</span>
        <span>{match.status === "finished" ? "已结束" : "待赛果"}</span>
      </div>
      <div className="scoreLine">
        <strong>{match.homeTeam}</strong>
        <b>{match.homeScore ?? "-"} : {match.awayScore ?? "-"}</b>
        <strong>{match.awayTeam}</strong>
      </div>
      <PickStrip matchId={match.id} picks={picks} friends={friends} winner={match.winner} />
    </article>
  );
}

function PickStrip({ matchId, picks, friends, winner }: { matchId: string; picks: Pick[]; friends: Friend[]; winner?: PickChoice | null }) {
  return (
    <div className="pickStrip">
      {friends.map((friend) => {
        const pick = picks.find((item) => item.userId === friend.id && item.matchId === matchId);
        const correct = winner && pick ? winner === pick.choice : null;
        return (
          <span
            key={friend.id}
            className={`avatar ${pick ? "picked" : ""} ${correct === true ? "correct" : ""} ${correct === false ? "wrong" : ""}`}
            title={pick ? `${friend.displayName}: ${choiceLabel(pick.choice)}` : `${friend.displayName}: 未选`}
            style={{ "--friend": friend.color } as React.CSSProperties}
          >
            {pick && correct !== null ? <Check size={12} /> : friend.displayName.slice(0, 1)}
          </span>
        );
      })}
    </div>
  );
}

function fromMatchRow(row: Record<string, unknown>): Match {
  return {
    id: String(row.id),
    matchNo: Number(row.match_no),
    phase: row.phase as Match["phase"],
    kickoffAt: String(row.kickoff_at),
    venue: String(row.venue ?? ""),
    homeTeam: String(row.home_team),
    awayTeam: String(row.away_team),
    homeScore: row.home_score === null ? null : Number(row.home_score),
    awayScore: row.away_score === null ? null : Number(row.away_score),
    status: row.status as Match["status"],
    winner: row.winner as Match["winner"],
    sourceUpdatedAt: row.source_updated_at ? String(row.source_updated_at) : null
  };
}

function fromPickRow(row: Record<string, unknown>): Pick {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    matchId: String(row.match_id),
    choice: row.choice as PickChoice,
    lockedAt: String(row.locked_at)
  };
}

function fromFeaturedMatchRow(row: Record<string, unknown>): FeaturedMatch {
  return {
    matchId: String(row.match_id),
    selectedBy: row.selected_by ? String(row.selected_by) : null,
    selectedAt: String(row.selected_at)
  };
}
