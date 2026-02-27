# 🎲 美食骰子 - 今晚吃什麼？

解決選擇困難症的美食決策應用！

## 功能特色

- 📝 記錄喜歡的美食
- 🎲 骰子動畫隨機選擇
- 👥 美食團（建立/分享/邀請/成員管理）
- 🌐 公開美食團（可被搜尋 / 收藏，並顯示 ★ 星星數）
- 🔐 Google 登入
- ☁️ Supabase 雲端儲存（跨裝置同步）
- ⚡ React + Vite 快速開發

## 安裝與執行

```bash
# 安裝依賴
npm install

# 開發模式
npm run dev

# 建置
npm run build
```

## 使用說明

1. 使用 Google 登入
2. 建立或加入美食團（可分享邀請連結）
3. 在團內新增美食，並用骰子隨機選擇
4. 公開團可以在「探索公開團」中被搜尋（團名或團內美食名稱）
5. 可收藏別人的公開團（唯讀），並可看到該團被收藏的 ★ 次數

## Supabase（schema / migrations）

本 repo 已加入 `supabase/migrations/`。

### 套用 migrations（建議）

```bash
# 1) 初始化（若尚未有 supabase/）
# supabase init

# 2) 連結到你的 Supabase 專案（需要 Project Ref）
supabase link --project-ref <your-project-ref>

# 3) 推送 migrations 到遠端 DB
supabase db push
```

> 注意：`supabase status` / `supabase start` 需要 Docker；但 `supabase link` / `supabase db push` 連遠端不一定需要 Docker。

## 資料庫安全（RLS）

本專案使用 Supabase RLS 保護資料。

- migrations 會建立/更新必要的 RLS（包含公開團/收藏功能所需的額外 policy）
- 另保留一份可手動套用的政策腳本：`rls_policies.sql`

**重點：**
- 使用 security definer function 避免 policy 自我遞迴
- `ratings.food_id` 為 bigint，對應 helper function 亦採 bigint
