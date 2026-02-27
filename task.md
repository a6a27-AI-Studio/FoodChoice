# FoodChoice — 探索優化（v4）

## 目標
- 個人化推薦（你可能會喜歡）
- 收藏按鈕跨區塊狀態同步（推薦/熱門/搜尋）

## Stage-gate checklist

### 1) DB / RPC
- [x] 新增 `get_personalized_public_group_recommendations(limit)`

### 2) Frontend
- [x] 探索頁新增「你可能會喜歡」區塊
- [x] 同一團在不同區塊收藏狀態同步切換

### 3) Local build/test
- [ ] `npm run build`
- [ ] 手動驗證收藏同步與個人化推薦

### 4) Deploy
- [ ] push main
- [ ] GitHub Actions Pages 成功
- [ ] 線上網址驗證
