# FoodChoice — 公開美食團搜尋 & 收藏

## 目標
- 美食團可設定 **公開**（公開團可被搜尋）
- 可用關鍵字搜尋公開團（團名 / 團內任一美食名稱）
- 使用者可 **收藏** 公開團（唯讀瀏覽）
- 每個公開團顯示 **星星數（被收藏次數）**，可依熱門排序

## Stage-gate checklist

### 1) DB / RLS / RPC
- [ ] `groups` 增加 `is_public`、`favorite_count`
- [ ] 新增 `group_favorites`（unique: group_id + user_id）
- [ ] trigger 維護 `groups.favorite_count`
- [ ] RLS：公開團允許 select；公開團 foods 允許 select；收藏表只允許本人 CRUD
- [ ] RPC：`search_public_groups(keyword)` 回傳公開團 + 星星數 + 是否已收藏

### 2) Frontend
- [ ] 建立團時可勾選「公開」
- [ ] 新增「探索公開團」UI：搜尋 + 結果列表 + 收藏/取消收藏
- [ ] 收藏後可從 UI 開啟該團（唯讀），顯示星星數
- [ ] 唯讀狀態下：不能新增/編輯/刪除美食（既有 canEdit 應 cover）

### 3) Local build/test
- [ ] `npm run build`
- [ ] 手動驗證流程（登入、建立公開團、搜尋、收藏、星星數變化、唯讀限制）

### 4) Deploy
- [ ] push main
- [ ] GitHub Actions Pages 成功
- [ ] 線上網址驗證
