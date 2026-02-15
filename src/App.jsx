import { useState, useEffect, useRef } from 'react';
import { initDatabase, getAllFoods, addFood, deleteFood, getRandomFood, setRating, getRecommendedFood, getAllRatings, exportData, importData } from './database';
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
  const importInputRef = useRef(null);

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

  const loadFoods = async () => {
    const allFoods = await getAllFoods();
    const allRatings = await getAllRatings();
    setFoods(allFoods);
    setRatings(allRatings);
  };

  const handleAddFood = async (formData) => {
    if (await addFood(formData)) {
      await loadFoods();
      return true;
    }
    return false;
  };

  const handleDeleteFood = async (id) => {
    if (await deleteFood(id)) {
      await loadFoods();
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

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foodchoice-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const ok = await importData(text);
    if (ok) {
      await loadFoods();
      alert('匯入成功');
    } else {
      alert('匯入失敗，請確認檔案格式');
    }
    event.target.value = '';
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

  const sortedFoods = (() => {
    const list = [...filteredFoods];
    switch (sortBy) {
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
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

        <div className="data-tools">
          <button onClick={handleExport} className="export-button">匯出資料</button>
          <button onClick={() => importInputRef.current?.click()} className="import-button">匯入資料</button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>

        <div className="filters-section">
          <h3>篩選器</h3>
          <div className="filters">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="latest">最新加入</option>
              <option value="name">名稱排序</option>
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
        />
      </main>

      <footer className="footer">
        <p>總共有 {foods.length} 個美食選項，篩選後 {filteredFoods.length} 個</p>
      </footer>
    </div>
  );
}

export default App;