# FoodChoice — 公開美食團探索升級（v2）

## 目標
- 搜尋前就有「隨機推薦公開團」
- 強化探索 UI/UX（快速標籤、排序、資訊卡）
- 搜尋欄位更完整（團名 / 美食名 / 分類 / 標籤）

## Stage-gate checklist

### 1) DB / RPC（Supabase CLI migrations）
- [x] `groups` 新增 `category`
- [x] `groups` 新增 `search_tags text[]`
- [x] 強化 `search_public_groups(keyword)`（支援分類與標籤命中）
- [x] 新增 `get_public_group_recommendations(limit)`

### 2) Frontend
- [x] 建立團可填：分類、搜尋標籤（逗號分隔）
- [x] 探索公開團：初始顯示隨機推薦
- [x] 快速標籤（火鍋/拉麵/宵夜/咖啡/健康餐）
- [x] 搜尋結果排序（熱門/名稱/隨機）
- [x] 顯示更多資訊（分類、標籤、推薦理由）

### 3) Local build/test
- [ ] `npm run build`
- [ ] 手動驗證流程（推薦/搜尋/收藏/唯讀）

### 4) Deploy
- [ ] push main
- [ ] GitHub Actions Pages 成功
- [ ] 線上網址驗證
