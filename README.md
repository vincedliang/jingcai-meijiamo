# 竞猜美加墨

面向 7 位朋友的 2026 美加墨世界杯胜负竞猜网页应用。前端使用 React + Vite，线上数据和实时同步使用 Supabase。

比赛日和赛程安排以 FIFA 官方 Scores & Fixtures 页面为准；比赛日按美东时间组织，赛程卡片同时显示美东时间和北京时间。

## 本地运行

1. 安装依赖：`npm install`
2. 复制配置：`cp .env.example .env`
3. 本地演示：保持 `VITE_DEMO_MODE=true`
4. 启动：`npm run dev`

## Supabase

- 数据库结构在 `supabase/migrations/001_initial_schema.sql`
- 赛果同步函数在 `supabase/functions/sync-matches/index.ts`
- 生产环境需要设置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
- 七位用户和口令应通过 Supabase Auth 创建，不要写入前端代码

## 音频

把合法可用的背景音乐文件放到 `public/audio/dai-dai.m4a`。锁定音效可以放到 `public/audio/lock.mp3`，没有文件时应用会静默降级。

## 资料源

- 赛程和比赛日安排以 FIFA 官方页面为准：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=US&wtw-filter=ALL
- 第三方数据源只能作为赛果更新或导入辅助，不能覆盖 FIFA 官方赛程安排
- 淘汰赛阶段如果球队仍显示为“待定/TBD”，管理员可以在页面上手动更新球队；自动同步更新 `matches` 后页面也会实时刷新
- 免费接口不可用时，管理员可通过 `result_overrides` 手动修正
