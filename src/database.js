import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pwhxnqiekanbpylvggnl.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RSPFNJoI2epUn9WCJzckqw_LQxq1f5T';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || 'c1b2db4edd224a12be391e77c7f72567';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const geocodeAddress = async (addressText) => {
  if (!GEOAPIFY_KEY) {
    throw new Error('缺少 Geoapify API Key');
  }
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(addressText)}&limit=1&apiKey=${GEOAPIFY_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geoapify 查詢失敗 (${response.status})`);
  }
  const payload = await response.json();
  const feature = payload.features && payload.features[0];
  if (!feature) {
    throw new Error('找不到符合的地址座標');
  }
  return {
    lat: toNumber(feature.properties.lat),
    lng: toNumber(feature.properties.lon)
  };
};

export const initDatabase = async () => true;

export const getAllFoods = async () => {
  try {
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .order('id', { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      businessHours: row.businesshours ?? row.businessHours ?? '',
      guiltIndex: row.guiltindex ?? row.guiltIndex ?? '',
      addressText: row.address_text ?? row.addressText ?? '',
      lat: toNumber(row.lat ?? row.latitude),
      lng: toNumber(row.lng ?? row.longitude)
    }));
  } catch (error) {
    console.error('載入資料失敗:', error);
    return [];
  }
};

export const addFood = async (foodData) => {
  const { name, flavor, businessHours, portion, price, guiltIndex, addressText } = foodData;
  if (!name?.trim()) return false;
  try {
    let geo = { lat: null, lng: null };
    const addressValue = addressText?.trim();
    if (addressValue) {
      geo = await geocodeAddress(addressValue);
    }
    const { error } = await supabase.from('foods').insert({
      name: name.trim(),
      flavor: flavor || '',
      businesshours: businessHours || '',
      portion: portion || '',
      price: price || '',
      guiltindex: guiltIndex || '',
      address_text: addressValue || '',
      lat: geo.lat,
      lng: geo.lng,
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('新增美食失敗:', error);
    throw error;
  }
};

export const updateFood = async (id, updates) => {
  try {
    const addressValue = (updates.addressText || updates.address_text || '').trim();
    let geo = { lat: null, lng: null };
    if (addressValue) {
      geo = await geocodeAddress(addressValue);
    }
    const payload = {
      name: updates.name?.trim() || '',
      flavor: updates.flavor || '',
      businesshours: updates.businessHours || updates.businesshours || '',
      portion: updates.portion || '',
      price: updates.price || '',
      guiltindex: updates.guiltIndex || updates.guiltindex || '',
      address_text: addressValue,
      lat: geo.lat,
      lng: geo.lng
    };
    const { error } = await supabase.from('foods').update(payload).eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('更新美食失敗:', error);
    throw error;
  }
};

export const deleteFood = async (id) => {
  try {
    const { error } = await supabase.from('foods').delete().eq('id', id);
    if (error) throw error;
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
    const { data, error } = await supabase
      .from('ratings')
      .select('food_id, stars');
    if (error) throw error;
    return (data || []).reduce((acc, row) => {
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
    const { error } = await supabase
      .from('ratings')
      .upsert({
        food_id: foodId,
        stars: rating,
        created_at: new Date().toISOString()
      }, { onConflict: 'food_id' });
    if (error) throw error;
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
