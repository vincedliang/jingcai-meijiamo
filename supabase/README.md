# Supabase setup

## 1. Apply schema

Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor or through the Supabase CLI.

## 2. Create the seven friend accounts

Create Auth users with these emails and private passwords:

- `wang-sen@jingcai.local` -> 王森
- `yang-yuheng@jingcai.local` -> 杨宇恒
- `yu-yang@jingcai.local` -> 于洋
- `wang-xiaoming@jingcai.local` -> 王晓明
- `bi-yixin@jingcai.local` -> 毕艺馨
- `zhao-wenxuan@jingcai.local` -> 赵文宣
- `liang-dongxu@jingcai.local` -> 梁东旭（管理员）

After creating each Auth user, insert one matching row in `profiles` using the Auth user UUID:

```sql
insert into public.profiles (id, display_name, is_admin)
values
  ('AUTH_UUID_HERE', '王森', false);
```

Set 梁东旭's `profiles.is_admin` to `true`; other friends should stay `false`.

## 3. Select daily quiz matches

The home page shows the full current match-day schedule by Eastern Time. 梁东旭 can mark 1 to 2 matches as quiz matches from the app UI before the first match starts on that Eastern Time match day.

Selections are stored in `featured_matches`. Only admins can insert or delete those rows, and normal users can only submit picks for matches that already exist in `featured_matches`.

## 4. Sync matches

Deploy `supabase/functions/sync-matches`. Configure:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OFFICIAL_SCHEDULE_URL=https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=US&wtw-filter=ALL`
- `MATCH_DATA_API_URL` should point to a JSON feed/export that has already been reconciled with the FIFA official scores-fixtures page
- `MATCH_DATA_API_TOKEN` only if the upstream JSON feed requires a token

Schedule the function to run periodically before and during the tournament. During live matches, run it more frequently. Do not let an unreconciled third-party feed decide match dates, kickoff times, venues, or match-day grouping.

For knockout rounds, run the sync more frequently around group completion and bracket confirmation. When FIFA confirms a matchup, the sync should update `matches.home_team` and `matches.away_team`; Supabase Realtime will push the updated team names to the quiz page. If the automatic feed lags, 梁东旭 can update TBD team names directly from the app.

## 5. Vercel

Set these frontend variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DEMO_MODE=false`
- `VITE_APP_TZ=Asia/Shanghai`
