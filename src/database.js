import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let SQL = null;
let db = null;

const DB_NAME = 'foodchoice-sqlite';
const DB_KEY = 'foodchoice-db';

const openIDB = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('db');
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const loadFromIDB = async () => {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('db', 'readonly');
    const store = tx.objectStore('db');
    const getReq = store.get(DB_KEY);
    getReq.onsuccess = () => resolve(getReq.result || null);
    getReq.onerror = () => reject(getReq.error);
  });
};

const saveToIDB = async () => {
  if (!db) return;
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('db', 'readwrite');
    const store = tx.objectStore('db');
    store.put(db.export(), DB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const run = (sql, params = []) => {
  if (!params || params.length === 0) {
    db.run(sql);
    return;
  }
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
};

const queryAll = (sql, params = []) => {
  const result = db.exec(sql, params);
  if (!result[0]) return [];
  const columns = result[0].columns || result[0].lc || [];
  const values = result[0].values || [];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
};

const ensureSchema = () => {
  run(`
    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      flavor TEXT,
      businessHours TEXT,
      portion TEXT,
      price TEXT,
      guiltIndex TEXT,
      created_at TEXT
    );
  `);
  run(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER NOT NULL,
      stars INTEGER NOT NULL,
      created_at TEXT
    );
  `);
  run(`
    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE,
      value TEXT
    );
  `);
  run(`
    CREATE TABLE IF NOT EXISTS recommend_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER NOT NULL,
      recommended_at TEXT
    );
  `);
};

const migrateFromLocalStorage = async () => {
  if (localStorage.getItem('foodChoiceMigratedToSQLite') === '1') return;
  const rawFoods = localStorage.getItem('foodChoiceDB');
  const rawRatings = localStorage.getItem('foodChoiceRatings');
  const foods = rawFoods ? JSON.parse(rawFoods) : [];
  const ratings = rawRatings ? JSON.parse(rawRatings) : {};

  foods.forEach((food) => {
    if (!food?.name) return;
    try {
      run(
        `INSERT INTO foods (id, name, flavor, businessHours, portion, price, guiltIndex, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          food.id || null,
          food.name || '',
          food.flavor || '',
          food.businessHours || '',
          food.portion || '',
          food.price || '',
          food.guiltIndex || '',
          food.created_at || new Date().toISOString()
        ]
      );
    } catch (error) {
      console.warn('略過無效的美食資料', food, error);
    }
  });

  foods.forEach((food) => {
    const legacyRating = ratings[food.id];
    if (legacyRating) {
      run(
        `INSERT INTO ratings (food_id, stars, created_at) VALUES (?, ?, ?)` ,
        [food.id, legacyRating, new Date().toISOString()]
      );
    }
  });

  localStorage.setItem('foodChoiceMigratedToSQLite', '1');
  await saveToIDB();
};

export const initDatabase = async () => {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl
    });
  }

  const saved = await loadFromIDB();
  db = saved ? new SQL.Database(saved) : new SQL.Database();
  ensureSchema();
  await migrateFromLocalStorage();
  await saveToIDB();
};

export const getAllFoods = async () => {
  try {
    return queryAll('SELECT * FROM foods ORDER BY id DESC');
  } catch (error) {
    console.error('載入資料失敗:', error);
    return [];
  }
};

export const addFood = async (foodData) => {
  const { name, flavor, businessHours, portion, price, guiltIndex } = foodData;
  if (!name.trim()) return false;
  try {
    run(
      `INSERT INTO foods (name, flavor, businessHours, portion, price, guiltIndex, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [
        name.trim(),
        flavor,
        businessHours,
        portion,
        price,
        guiltIndex,
        new Date().toISOString()
      ]
    );
    await saveToIDB();
    return true;
  } catch (error) {
    console.error('新增美食失敗:', error);
    return false;
  }
};

export const deleteFood = async (id) => {
  try {
    run('DELETE FROM foods WHERE id = ?', [id]);
    run('DELETE FROM ratings WHERE food_id = ?', [id]);
    await saveToIDB();
    return true;
  } catch (error) {
    console.error('刪除美食失敗:', error);
    return false;
  }
};

export const getRandomFood = (filteredFoods = null) => {
  const foods = filteredFoods || [];
  if (foods.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * foods.length);
  return foods[randomIndex];
};

export const getAllRatings = async () => {
  try {
    const rows = queryAll('SELECT food_id, stars FROM ratings');
    return rows.reduce((acc, row) => {
      acc[row.food_id] = row.stars;
      return acc;
    }, {});
  } catch (error) {
    console.error('載入評分失敗:', error);
    return {};
  }
};

export const setRating = async (foodId, rating) => {
  try {
    run('DELETE FROM ratings WHERE food_id = ?', [foodId]);
    run(
      `INSERT INTO ratings (food_id, stars, created_at) VALUES (?, ?, ?)` ,
      [foodId, rating, new Date().toISOString()]
    );
    await saveToIDB();
  } catch (error) {
    console.error('設定評分失敗:', error);
  }
};

export const getRecommendedFood = (filteredFoods, ratingsMap) => {
  const foods = filteredFoods || [];
  const ratedFoods = foods.filter(food => (ratingsMap?.[food.id] || 0) > 0);
  if (ratedFoods.length === 0) return null;

  const totalWeight = ratedFoods.reduce((sum, food) => sum + (ratingsMap?.[food.id] || 0), 0);
  let random = Math.random() * totalWeight;
  for (const food of ratedFoods) {
    random -= (ratingsMap?.[food.id] || 0);
    if (random <= 0) {
      return food;
    }
  }
  return ratedFoods[ratedFoods.length - 1];
};

export const exportData = async () => {
  const foods = queryAll('SELECT * FROM foods ORDER BY id ASC');
  const ratings = queryAll('SELECT food_id, stars, created_at FROM ratings');
  return JSON.stringify({ foods, ratings });
};

export const importData = async (jsonText) => {
  try {
    const payload = JSON.parse(jsonText);
    const foods = Array.isArray(payload) ? payload : (payload.foods || []);
    const ratings = payload.ratings || [];

    foods.forEach((food) => {
      run(
        `INSERT INTO foods (id, name, flavor, businessHours, portion, price, guiltIndex, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          food.id || null,
          food.name || '',
          food.flavor || '',
          food.businessHours || '',
          food.portion || '',
          food.price || '',
          food.guiltIndex || '',
          food.created_at || new Date().toISOString()
        ]
      );
    });

    ratings.forEach((rating) => {
      if (!rating.food_id || !rating.stars) return;
      run(
        `INSERT INTO ratings (food_id, stars, created_at) VALUES (?, ?, ?)` ,
        [rating.food_id, rating.stars, rating.created_at || new Date().toISOString()]
      );
    });

    await saveToIDB();
    return true;
  } catch (error) {
    console.error('匯入失敗:', error);
    return false;
  }
};

