import { Check, Lock, Music, Music2, ShieldCheck, Trophy, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_FEATURED_MATCHES, DEMO_MATCHES, DEMO_PICKS } from "./data/demoMatches";
import { FRIENDS } from "./data/friends";
import { getFifaKnockoutTeamUpdates } from "./lib/fifaTeamSync";
import {
  calculateStandings,
  canPick,
  canManageFeaturedMatch,
  canRecordResult,
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
const APP_PASSCODE = import.meta.env.VITE_APP_PASSCODE ?? "";
const LOGIN_EMAILS_BY_NAME: Record<string, string> = {
  "王森": "wang-sen@jingcai-meijiamo.com",
  "杨宇恒": "yang-yuheng@jingcai-meijiamo.com",
  "王晓明": "wang-xiaoming@jingcai-meijiamo.com",
  "毕艺馨": "bi-yixin@jingcai-meijiamo.com",
  "赵文宣": "zhao-wenxuan@jingcai-meijiamo.com",
  "梁东旭": "liang-dongxu@jingcai-meijiamo.com"
};
const EXCLUDED_PROFILE_IDS = new Set(["10000000-0000-0000-0000-000000000003"]);

function friendDefaults(displayName: string, fallbackIndex: number) {
  return FRIENDS.find((friend) => friend.displayName === displayName) ?? FRIENDS[fallbackIndex % FRIENDS.length];
}

function remapUserIdToRemote(userId: string | null, remoteFriends: Friend[]) {
  if (!userId) return null;
  if (remoteFriends.some((friend) => friend.id === userId)) return userId;

  const localFriend = FRIENDS.find((friend) => friend.id === userId);
  if (!localFriend) return null;

  return remoteFriends.find((friend) => friend.displayName === localFriend.displayName)?.id ?? null;
}

export function App() {
  const [friends, setFriends] = useState<Friend[]>(FRIENDS);
  const [selectedUserId, setSelectedUserId] = useState(FRIENDS[0].id);
  const [password, setPassword] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(isDemoMode ? FRIENDS[0].id : null);
  const [matches, setMatches] = useState<Match[]>(DEMO_MATCHES);
  const [picks, setPicks] = useState<Pick[]>([...DEMO_PICKS]);
  const [featuredMatches, setFeaturedMatches] = useState<FeaturedMatch[]>([...DEMO_FEATURED_MATCHES]);
  const [musicOn, setMusicOn] = useState(() => localStorage.getItem("musicOn") !== "false");
  const [lastLocked, setLastLocked] = useState<string | null>(null);
  const [savingFeaturedId, setSavingFeaturedId] = useState<string | null>(null);
  const [savingResultId, setSavingResultId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lockAudioRef = useRef<HTMLAudioElement>(null);
  const lastTeamSyncRef = useRef(0);

  const now = new Date();
  const effectiveUserId = isDemoMode ? selectedUserId : activeUserId;
  const selectedUser = friends.find((friend) => friend.id === effectiveUserId) ?? friends.find((friend) => friend.id === selectedUserId) ?? friends[0];
  const selectedLoginUser = friends.find((friend) => friend.id === selectedUserId) ?? selectedUser;
  const selectedUserLoggedIn = activeUserId === selectedUserId;
  const isCurrentUserAdmin = Boolean(effectiveUserId && selectedUser.isAdmin);
  const featuredIds = new Set(featuredMatches.map((featured) => featured.matchId));
  const todayMatches = getTodayMatches(matches, now, featuredIds);
  const todayKey = getCurrentMatchDateKey(matches, now, featuredIds);
  const todayFeaturedCount = todayMatches.filter((match) => featuredIds.has(match.id)).length;
  const todayPickCount = effectiveUserId ? userDailyPickCount(effectiveUserId, picks as Pick[], matches, todayKey) : 0;
  const standings = useMemo(() => calculateStandings(friends, matches, picks as Pick[]), [friends, matches, picks]);
  const previousDay = getPreviousMatchDay(matches, now, featuredIds);

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
        const remoteFriends = profiles.filter((profile) => !EXCLUDED_PROFILE_IDS.has(profile.id)).map((profile, index) => {
          const defaults = friendDefaults(profile.display_name, index);
          return {
            id: profile.id,
            displayName: profile.display_name,
            isAdmin: Boolean(profile.is_admin),
            color: defaults.color
          };
        });
        setFriends(remoteFriends);
        setSelectedUserId((current) => (
          remapUserIdToRemote(current, remoteFriends)
            ?? remoteFriends[0]?.id
            ?? current
        ));
        setActiveUserId((current) => remapUserIdToRemote(current, remoteFriends));
      }
      if (remoteMatches?.length) setMatches(mergeMatchesWithFallback(remoteMatches.map(fromMatchRow)));
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

  useEffect(() => {
    if (!musicOn) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.45;

    const play = () => {
      void audio.play().catch(() => undefined);
    };
    play();

    window.addEventListener("pointerdown", play, { once: true });
    window.addEventListener("touchstart", play, { once: true });

    return () => {
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("touchstart", play);
    };
  }, [musicOn]);

  useEffect(() => {
    if (isDemoMode || !supabase) return;
    const client = supabase;
    if (!matches.some((match) => match.phase !== "group" && hasTbdTeam(match))) return;
    if (Date.now() - lastTeamSyncRef.current < 5 * 60 * 1000) return;

    lastTeamSyncRef.current = Date.now();
    let cancelled = false;

    async function syncKnockoutTeams() {
      try {
        const updates = await getFifaKnockoutTeamUpdates(matches);
        if (!updates.length || cancelled) return;

        await Promise.all(updates.map((update) => client
          .from("matches")
          .update({
            home_team: update.homeTeam,
            away_team: update.awayTeam,
            source: "fifa-api-team-sync",
            source_updated_at: new Date().toISOString()
          })
          .eq("id", update.id)
        ));

        if (cancelled) return;
        setMatches((current) => current.map((match) => {
          const update = updates.find((item) => item.id === match.id);
          return update ? { ...match, homeTeam: update.homeTeam, awayTeam: update.awayTeam, sourceUpdatedAt: new Date().toISOString() } : match;
        }));
      } catch {
        // Keep the admin manual team editor as the fallback when FIFA data is unavailable.
      }
    }

    void syncKnockoutTeams();

    return () => {
      cancelled = true;
    };
  }, [matches]);

  async function signIn() {
    if (isDemoMode || !supabase) {
      setActiveUserId(selectedUserId);
      return;
    }

    if (APP_PASSCODE) {
      if (password !== APP_PASSCODE) {
        alert("登录失败，请检查口令。");
        return;
      }
      setActiveUserId(selectedUserId);
      setPassword("");
      return;
    }

    const email = LOGIN_EMAILS_BY_NAME[selectedLoginUser.displayName];
    if (!email) {
      alert("登录失败，请检查用户配置。");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || data.user?.id !== selectedUserId) {
      await supabase.auth.signOut();
      alert("登录失败，请检查口令。");
      return;
    }
    setActiveUserId(data.user.id);
    setPassword("");
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

  async function lockPick(match: Match, choice: PickChoice) {
    if (!effectiveUserId) return;
    if (!featuredIds.has(match.id)) return;
    const already = picks.some((pick) => pick.userId === effectiveUserId && pick.matchId === match.id);
    const dayCount = userDailyPickCount(effectiveUserId, picks as Pick[], matches, easternDateKey(match.kickoffAt));
    if (already || !canPick(match) || dayCount >= MAX_DAILY_PICKS) return;

    let pick: Pick = {
      id: crypto.randomUUID(),
      userId: effectiveUserId,
      matchId: match.id,
      choice,
      lockedAt: new Date().toISOString()
    };

    if (!isDemoMode && supabase) {
      const { data, error } = await supabase.from("picks").insert({
        user_id: effectiveUserId,
        match_id: match.id,
        choice
      }).select("*").single();

      if (error) {
        alert(`保存失败：${error.message}`);
        return;
      }
      if (data) pick = fromPickRow(data);
    }

    setPicks((current) => [...current, pick]);
    setLastLocked(match.id);
    void lockAudioRef.current?.play().catch(() => undefined);
    window.setTimeout(() => setLastLocked(null), 1600);
  }

  async function toggleFeaturedMatch(match: Match) {
    if (!isCurrentUserAdmin || !effectiveUserId || !canManageFeaturedMatch(match, now)) return;
    const selected = featuredIds.has(match.id);
    const sameDayFeatured = todayMatches.filter((item) => featuredIds.has(item.id));
    if (!selected && sameDayFeatured.length >= MAX_DAILY_PICKS) return;

    setSavingFeaturedId(match.id);

    if (!isDemoMode && supabase) {
      const response = selected
        ? await supabase.from("featured_matches").delete().eq("match_id", match.id)
        : await persistMatchAndFeature(match, effectiveUserId);

      if (response.error) {
        setSavingFeaturedId(null);
        alert(formatSaveError(response.error.message));
        return;
      }

      const { data: remoteFeatured } = await supabase.from("featured_matches").select("*");
      if (remoteFeatured) {
        setFeaturedMatches(remoteFeatured.map(fromFeaturedMatchRow));
      }
      setSavingFeaturedId(null);
      return;
    }

    setFeaturedMatches((current) => {
      if (selected) {
        return current.filter((item) => item.matchId !== match.id);
      }
      return [
        ...current,
        {
          matchId: match.id,
          selectedBy: effectiveUserId,
          selectedAt: new Date().toISOString()
        }
      ];
    });
    setSavingFeaturedId(null);
  }

  async function updateMatchTeams(match: Match) {
    if (!isCurrentUserAdmin) return;
    const homeTeam = window.prompt("请输入主队名称", match.homeTeam)?.trim();
    if (!homeTeam) return;
    const awayTeam = window.prompt("请输入客队名称", match.awayTeam)?.trim();
    if (!awayTeam) return;

    if (!isDemoMode && supabase) {
      const { error } = await supabase
        .from("matches")
        .update({
          home_team: homeTeam,
          away_team: awayTeam,
          source_updated_at: new Date().toISOString()
        })
        .eq("id", match.id);

      if (error) {
        alert(`保存失败：${error.message}`);
        return;
      }
    }

    setMatches((current) => current.map((item) => (
      item.id === match.id
        ? { ...item, homeTeam, awayTeam, sourceUpdatedAt: new Date().toISOString() }
        : item
    )));
  }

  async function updateMatchResult(match: Match) {
    if (!isCurrentUserAdmin || !canRecordResult(match, now)) return;

    const homeScoreValue = window.prompt(`请输入${match.homeTeam}进球数`, match.homeScore?.toString() ?? "");
    if (homeScoreValue === null) return;
    const awayScoreValue = window.prompt(`请输入${match.awayTeam}进球数`, match.awayScore?.toString() ?? "");
    if (awayScoreValue === null) return;

    const homeScore = Number(homeScoreValue);
    const awayScore = Number(awayScoreValue);
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      alert("比分必须是 0 或更大的整数。");
      return;
    }

    const allowedChoices = choicesForMatch(match);
    const resultInput = window.prompt(
      `请选择赛果：${allowedChoices.map(choiceLabel).join(" / ")}`,
      homeScore > awayScore ? "主胜" : homeScore < awayScore ? "客胜" : "平"
    )?.trim();
    if (!resultInput) return;

    const winner = allowedChoices.find((choice) => {
      const labels = choice === "home" ? ["主胜", "主", "home", match.homeTeam] : choice === "away" ? ["客胜", "客", "away", match.awayTeam] : ["平", "平局", "draw"];
      return labels.some((label) => label.toLowerCase() === resultInput.toLowerCase());
    });

    if (!winner) {
      alert(`赛果只能选择：${allowedChoices.map(choiceLabel).join(" / ")}`);
      return;
    }

    setSavingResultId(match.id);

    const updatedMatch: Match = {
      ...match,
      homeScore,
      awayScore,
      status: "finished",
      winner,
      sourceUpdatedAt: new Date().toISOString()
    };

    if (!isDemoMode && supabase) {
      const { error } = await supabase
        .from("matches")
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: "finished",
          winner,
          source: "manual-admin",
          source_updated_at: updatedMatch.sourceUpdatedAt
        })
        .eq("id", match.id);

      if (error) {
        setSavingResultId(null);
        alert(`保存失败：${error.message}`);
        return;
      }
    }

    setMatches((current) => current.map((item) => (item.id === match.id ? updatedMatch : item)));
    setSavingResultId(null);
  }

  return (
    <main className="shell">
      <audio ref={audioRef} src="/audio/dai-dai.m4a" loop preload="auto" autoPlay />
      <audio ref={lockAudioRef} src="/audio/lock.mp3" preload="none" />

      <section className="hero">
        <img
          src="/worldcup-core-visual.png"
          alt=""
          className="heroImage"
          loading="eager"
          decoding="async"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
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
            setPassword("");
            if (isDemoMode) {
              setActiveUserId(event.target.value);
            } else {
              void supabase?.auth.signOut();
              setActiveUserId(null);
            }
          }}
        >
          {friends.map((friend) => (
            <option value={friend.id} key={friend.id}>{friend.displayName}{friend.isAdmin ? "（管理员）" : ""}</option>
          ))}
        </select>
        {!isDemoMode && selectedUserLoggedIn ? (
          <div className="loginStatus">
            <span>已登录为 {selectedLoginUser.displayName}{selectedLoginUser.isAdmin ? " · 管理员" : ""}</span>
            <button
              className="secondaryButton"
              onClick={() => {
                void supabase?.auth.signOut();
                setActiveUserId(null);
                setPassword("");
              }}
            >
              切换用户
            </button>
          </div>
        ) : null}
        {!isDemoMode && !selectedUserLoggedIn ? (
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
        {isCurrentUserAdmin && !todayMatches.some((match) => canManageFeaturedMatch(match, now)) ? (
          <p className="muted deadlineNote">本比赛日剩余比赛均已开赛，管理员不能再调整竞猜场次。</p>
        ) : null}
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
              canManageFeatured={canManageFeaturedMatch(match, now)}
              savingFeatured={savingFeaturedId === match.id}
              savingResult={savingResultId === match.id}
              dailyFull={todayPickCount >= MAX_DAILY_PICKS}
              justLocked={lastLocked === match.id}
              onPick={lockPick}
              onToggleFeatured={toggleFeaturedMatch}
              onUpdateTeams={updateMatchTeams}
              onUpdateResult={updateMatchResult}
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
              <ResultCard
                key={match.id}
                match={match}
                picks={picks as Pick[]}
                friends={friends}
                isAdmin={isCurrentUserAdmin}
                canEditResult={canRecordResult(match, now)}
                savingResult={savingResultId === match.id}
                onUpdateResult={updateMatchResult}
              />
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
  savingFeatured,
  savingResult,
  dailyFull,
  justLocked,
  onPick,
  onToggleFeatured,
  onUpdateTeams,
  onUpdateResult
}: {
  match: Match;
  friends: Friend[];
  picks: Pick[];
  selectedUserId: string;
  selectedForPick: boolean;
  isAdmin: boolean;
  canFeatureMore: boolean;
  canManageFeatured: boolean;
  savingFeatured: boolean;
  savingResult: boolean;
  dailyFull: boolean;
  justLocked: boolean;
  onPick: (match: Match, choice: PickChoice) => void;
  onToggleFeatured: (match: Match) => void;
  onUpdateTeams: (match: Match) => void;
  onUpdateResult: (match: Match) => void;
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
              disabled={savingFeatured || !canManageFeatured || (!selectedForPick && !canFeatureMore)}
              onClick={() => onToggleFeatured(match)}
            >
              <ShieldCheck size={15} />
              {savingFeatured ? "保存中" : selectedForPick ? "取消竞猜" : "设为竞猜"}
            </button>
            {hasTbdTeam(match) ? (
              <button className="adminToggle" onClick={() => onUpdateTeams(match)}>
                更新球队
              </button>
            ) : null}
            {canRecordResult(match) ? (
              <button
                className="adminToggle resultButton"
                disabled={savingResult}
                onClick={() => onUpdateResult(match)}
              >
                {savingResult ? "保存中" : match.status === "finished" ? "修改赛果" : "录入赛果"}
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

function ResultCard({
  match,
  picks,
  friends,
  isAdmin,
  canEditResult,
  savingResult,
  onUpdateResult
}: {
  match: Match;
  picks: Pick[];
  friends: Friend[];
  isAdmin?: boolean;
  canEditResult?: boolean;
  savingResult?: boolean;
  onUpdateResult?: (match: Match) => void;
}) {
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
      {isAdmin && canEditResult && onUpdateResult ? (
        <button
          className="adminToggle resultButton resultEdit"
          disabled={savingResult}
          onClick={() => onUpdateResult(match)}
        >
          {savingResult ? "保存中" : match.status === "finished" ? "修改赛果" : "录入赛果"}
        </button>
      ) : null}
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

function mergeMatchesWithFallback(remoteMatches: Match[]) {
  const byId = new Map(DEMO_MATCHES.map((match) => [match.id, match]));
  for (const match of remoteMatches) byId.set(match.id, match);
  return Array.from(byId.values()).sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
}

async function persistMatchAndFeature(match: Match, selectedBy: string) {
  if (!supabase) return { error: null };

  const matchResponse = await supabase
    .from("matches")
    .upsert({
      id: match.id,
      match_no: match.matchNo,
      phase: match.phase,
      kickoff_at: match.kickoffAt,
      venue: match.venue,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      home_score: match.homeScore,
      away_score: match.awayScore,
      status: match.status,
      winner: match.winner,
      source: "manual-admin",
      source_updated_at: new Date().toISOString()
    }, { onConflict: "id" });

  if (matchResponse.error) return matchResponse;

  return supabase.from("featured_matches").insert({
    match_id: match.id,
    selected_by: selectedBy
  });
}

function formatSaveError(message: string) {
  if (/row-level security|violates foreign key|not present in table/i.test(message)) {
    return "保存失败：数据库还没有允许写入新的比赛日赛程。请先在 Supabase SQL Editor 运行项目里的 supabase/enable-app-passcode-access.sql，然后再点设为竞猜。";
  }
  return `保存失败：${message}`;
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
