import { useState, useEffect } from 'react';
import { initDatabase, getAllFoods, addFood, updateFood, deleteFood, getRandomFood, setRating, getRecommendedFood, getAllRatings } from './database';
import DiceRoll from './components/DiceRoll';
import FoodList from './components/FoodList';
import AddFoodForm from './components/AddFoodForm';
import './App.css';

function App() {
  const [foods, setFoods] = useState([]);
  const [ratings, setRatings] = useState({});
  const [selectedFood, setSelectedFood] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    flavor: '',
    portion: '',
    price: '',
    guiltIndex: '',
    businessHours: ''
  });
  const [sortBy, setSortBy] = useState('latest');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    flavor: '',
    businessHours: '',
    portion: '',
    price: '',
    guiltIndex: '',
    addressText: ''
  });
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        setDbReady(true);
        await loadFoods();
      } catch (error) {
        console.error('初始化失敗:', error);
        // 即使失敗也設置為 ready，因為有備援
        setDbReady(true);
        await loadFoods();
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (sortBy === 'distanceAsc' || sortBy === 'distanceDesc') {
      ensureLocation();
    }
  }, [sortBy]);

  const loadFoods = async () => {
    const allFoods = await getAllFoods();
    const allRatings = await getAllRatings();
    setFoods(allFoods);
    setRatings(allRatings);
  };

  const handleAddFood = async (formData) => {
    try {
      if (await addFood(formData)) {
        await loadFoods();
        return true;
      }
      return false;
    } catch (error) {
      alert(error?.message || '新增失敗，請稍後再試');
      return false;
    }
  };

  const handleDeleteFood = (food) => {
    setDeleteTarget(food);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (await deleteFood(deleteTarget.id)) {
      await loadFoods();
    }
    setDeleteTarget(null);
  };

  const openEdit = (food) => {
    setEditTarget(food);
    setEditForm({
      name: food.name || '',
      flavor: food.flavor || '',
      businessHours: food.businessHours || '',
      portion: food.portion || '',
      price: food.price || '',
      guiltIndex: food.guiltIndex || '',
      addressText: food.addressText || ''
    });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) {
      alert('請輸入食物名稱');
      return;
    }

    try {
      const ok = await updateFood(editTarget.id, {
        ...editForm
      });
      if (ok) {
        await loadFoods();
        setEditTarget(null);
      }
    } catch (error) {
      alert(error?.message || '更新失敗，請稍後再試');
    }
  };

  const handleRating = async (foodId, rating) => {
    await setRating(foodId, rating);
    const allRatings = await getAllRatings();
    setRatings(allRatings);
  };

  const handleRollDice = () => {
    if (filteredFoods.length === 0) {
      alert('沒有符合篩選條件的美食選項！');
      return;
    }

    setIsRolling(true);
    setSelectedFood(null);

    // 骰子動畫持續 2 秒
    setTimeout(() => {
      const randomFood = getRandomFood(filteredFoods);
      setSelectedFood(randomFood);
      setIsRolling(false);
    }, 2000);
  };

  const handleRecommend = () => {
    const recommended = getRecommendedFood(filteredFoods, ratings);
    if (!recommended) {
      alert('沒有評分的食物，請先評分一些食物！');
      return;
    }
    setSelectedFood(recommended);
    setSearchQuery(recommended.name); // Highlight in search
  };

  const ensureLocation = async () => {
    if (userLocation || locationStatus === 'requesting') return;
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('此瀏覽器不支援定位功能');
      return;
    }

    setLocationStatus('requesting');
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setLocationStatus('ready');
      },
      (error) => {
        console.warn('定位失敗:', error);
        setLocationStatus(error.code === 1 ? 'denied' : 'error');
        setLocationError('未取得定位權限，距離排序將停用');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredFoods = foods.filter((food) => {
    const query = searchQuery.trim().toLowerCase();
    if (query && !food.name.toLowerCase().includes(query)) return false;
    
    if (filters.flavor && food.flavor !== filters.flavor) return false;
    if (filters.portion && food.portion !== filters.portion) return false;
    if (filters.price && food.price !== filters.price) return false;
    if (filters.guiltIndex && food.guiltIndex !== filters.guiltIndex) return false;
    // For business hours, check if current time is within range (no cross-midnight)
    if (filters.businessHours === 'open') {
      if (!food.businessHours || !food.businessHours.includes('-')) return false;
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [start, end] = food.businessHours.split('-').map(t => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      });
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      if (start >= end) return false; // 不支援跨午夜
      if (currentMinutes < start || currentMinutes > end) return false;
    }
    
    return true;
  });

  const handleFilterChange = (filterKey, value) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  };

  const decoratedFoods = filteredFoods.map((food) => {
    if (!userLocation || !Number.isFinite(food.lat) || !Number.isFinite(food.lng)) {
      return { ...food, distanceKm: null };
    }
    return {
      ...food,
      distanceKm: haversineKm(userLocation.lat, userLocation.lng, food.lat, food.lng)
    };
  });

  const sortedFoods = (() => {
    const list = [...decoratedFoods];
    switch (sortBy) {
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
      case 'distanceAsc':
        if (!userLocation) return list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        return list.sort((a, b) => {
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        });
      case 'distanceDesc':
        if (!userLocation) return list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        return list.sort((a, b) => {
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return b.distanceKm - a.distanceKm;
        });
      case 'latest':
      default:
        return list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }
  })();

  if (!dbReady) {
    return (
      <div className="app">
        <div className="loading">載入中...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎲 美食骰子</h1>
        <p>今晚吃什麼？讓骰子決定！</p>
      </header>

      <main className="main">
        <div className="search-section">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋美食..."
            className="search-input"
          />
          <button onClick={handleRecommend} className="recommend-button">
            推薦食物
          </button>
        </div>

        <div className="filters-section">
          <h3>篩選器</h3>
          <div className="location-row">
            <button className="location-button" onClick={ensureLocation}>取得定位</button>
            <span className="location-hint">定位僅用於距離計算，不會儲存。</span>
          </div>
          {locationError && (
            <div className="location-error">{locationError}</div>
          )}
          <div className="filters">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="latest">最新加入</option>
              <option value="name">名稱排序</option>
              <option value="distanceAsc">距離最近</option>
              <option value="distanceDesc">距離最遠</option>
            </select>
            <select value={filters.flavor} onChange={(e) => handleFilterChange('flavor', e.target.value)}>
              <option value="">所有口味</option>
              <option value="甜">甜</option>
              <option value="鹹">鹹</option>
              <option value="酸">酸</option>
              <option value="辣">辣</option>
              <option value="苦">苦</option>
              <option value="混合">混合</option>
            </select>
            <select value={filters.portion} onChange={(e) => handleFilterChange('portion', e.target.value)}>
              <option value="">所有份量</option>
              <option value="小">小</option>
              <option value="中">中</option>
              <option value="大">大</option>
            </select>
            <select value={filters.price} onChange={(e) => handleFilterChange('price', e.target.value)}>
              <option value="">所有價格</option>
              <option value="低">低</option>
              <option value="中">中</option>
              <option value="高">高</option>
            </select>
            <select value={filters.guiltIndex} onChange={(e) => handleFilterChange('guiltIndex', e.target.value)}>
              <option value="">所有罪惡指數</option>
              <option value="低">低</option>
              <option value="中">中</option>
              <option value="高">高</option>
            </select>
            <select value={filters.businessHours} onChange={(e) => handleFilterChange('businessHours', e.target.value)}>
              <option value="">所有營業時間</option>
              <option value="open">現在營業</option>
            </select>
          </div>
        </div>

        <DiceRoll 
          isRolling={isRolling} 
          selectedFood={selectedFood}
          onRoll={handleRollDice}
        />

        <AddFoodForm onAdd={handleAddFood} foods={foods} />

        <FoodList 
          foods={sortedFoods} 
          ratings={ratings}
          onDelete={handleDeleteFood}
          onRating={handleRating}
          onEdit={openEdit}
        />
      </main>

      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>確認刪除</h3>
            <p>確定要刪除「{deleteTarget.name}」嗎？</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>取消</button>
              <button className="btn-danger" onClick={confirmDelete}>刪除</button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>編輯美食</h3>
            <div className="modal-form">
              <label>
                食物名稱
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </label>
              <label>
                口味
                <select
                  value={editForm.flavor}
                  onChange={(e) => setEditForm({ ...editForm, flavor: e.target.value })}
                >
                  <option value="">選擇口味</option>
                  <option value="甜">甜</option>
                  <option value="鹹">鹹</option>
                  <option value="酸">酸</option>
                  <option value="辣">辣</option>
                  <option value="苦">苦</option>
                  <option value="混合">混合</option>
                </select>
              </label>
              <label>
                營業時間
                <input
                  type="text"
                  placeholder="例如 11:00-21:00"
                  value={editForm.businessHours}
                  onChange={(e) => setEditForm({ ...editForm, businessHours: e.target.value })}
                />
              </label>
              <label>
                份量
                <select
                  value={editForm.portion}
                  onChange={(e) => setEditForm({ ...editForm, portion: e.target.value })}
                >
                  <option value="">選擇份量</option>
                  <option value="小">小</option>
                  <option value="中">中</option>
                  <option value="大">大</option>
                </select>
              </label>
              <label>
                價格
                <select
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                >
                  <option value="">選擇價格</option>
                  <option value="低">低</option>
                  <option value="中">中</option>
                  <option value="高">高</option>
                </select>
              </label>
              <label>
                罪惡指數
                <select
                  value={editForm.guiltIndex}
                  onChange={(e) => setEditForm({ ...editForm, guiltIndex: e.target.value })}
                >
                  <option value="">選擇罪惡指數</option>
                  <option value="低">低</option>
                  <option value="中">中</option>
                  <option value="高">高</option>
                </select>
              </label>
              <label>
                地址
                <input
                  type="text"
                  placeholder="例如 台北市信義區..."
                  value={editForm.addressText}
                  onChange={(e) => setEditForm({ ...editForm, addressText: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditTarget(null)}>取消</button>
              <button className="btn-primary" onClick={handleEditSave}>儲存</button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>總共有 {foods.length} 個美食選項，篩選後 {filteredFoods.length} 個</p>
      </footer>
    </div>
  );
}

export default App;
