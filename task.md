# FoodChoice — 探索優化（v3）

## 目標
- 搜尋前有隨機推薦
- 新增熱門榜 Top 10
- 團主可二次編輯團設定

## Stage-gate checklist

### 1) DB / RPC（Supabase CLI migrations）
- [x] 新增 `get_public_group_trending(limit)`
- [x] `groups` 補 `updated_at` + trigger（更新排序/審計）

### 2) Frontend
- [x] 探索頁顯示「🔥 今日熱門榜 Top 10」
- [x] 建立團後可從「編輯團設定」二次編輯
- [x] 可編輯欄位：名稱、描述、公開、分類、標籤

### 3) Local build/test
- [x] `npm run build`
- [ ] 手動驗證流程（熱門榜/編輯團設定/收藏狀態同步）

### 4) Deploy
- [ ] push main
- [ ] GitHub Actions Pages 成功
- [ ] 線上網址驗證
