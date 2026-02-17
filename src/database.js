import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pwhxnqiekanbpylvggnl.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RSPFNJoI2epUn9WCJzckqw_LQxq1f5T';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || 'c1b2db4edd224a12be391e77c7f72567';

export const signInWithGoogle = async () => {
  const origin = window?.location?.origin || '';
  const redirectTo = origin ? `${origin}/FoodChoice/` : undefined;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: redirectTo ? { redirectTo } : undefined
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session || null;
};

export const onAuthStateChange = (callback) => supabase.auth.onAuthStateChange((event, session) => {
  callback?.(event, session);
});

export const ensureUserProfile = async (user) => {
  if (!user?.id) return null;
  const identities = (user.identities || []).map((identity) => ({
    provider: identity.provider,
    provider_id: identity.provider_id,
    identity_id: identity.id
  }));
  const payload = {
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
    avatar_url: user.user_metadata?.avatar_url || '',
    oauth_identities: identities,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase
    .from('users')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const createGroup = async ({ name, description, ownerId }) => {
  if (!name?.trim()) throw new Error('缺少群組名稱');
  const { data, error } = await supabase
    .from('groups')
    .insert({
      name: name.trim(),
      description: description || '',
      owner_id: ownerId,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) throw error;

  if (data?.id && ownerId) {
    const { error: memberError } = await supabase
      .from('group_memberships')
      .insert({
        group_id: data.id,
        user_id: ownerId,
        role: 'admin',
        created_at: new Date().toISOString()
      });
    if (memberError) throw memberError;
  }
  return data;
};

export const deleteGroup = async ({ groupId, userId }) => {
  if (!groupId) throw new Error('缺少群組資訊');
  if (!userId) throw new Error('請先登入');
  const { data: membership, error: roleError } = await supabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();
  if (roleError) throw roleError;
  if (membership?.role !== 'admin') throw new Error('僅管理員可刪除群組');

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId);
  if (error) throw error;
  return true;
};

export const getMyGroups = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('group_memberships')
    .select('role, groups(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row.groups,
    role: row.role
  })).filter(Boolean);
};

export const getGroupRole = async (groupId, userId) => {
  if (!groupId || !userId) return null;
  const { data, error } = await supabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data?.role || null;
};

export const getGroupMembers = async (groupId) => {
  if (!groupId) return [];
  const { data, error } = await supabase
    .from('group_memberships')
    .select('id, user_id, role, created_at, users(email, full_name, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

const generateInviteToken = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const createInvitation = async ({ groupId, email, role, invitedBy }) => {
  if (!groupId) throw new Error('缺少群組資訊');
  const token = generateInviteToken();
  const { data, error } = await supabase
    .from('group_invitations')
    .insert({
      group_id: groupId,
      token,
      type: 'one_time',
      permission_grant: role || 'readonly',
      email: email ? email.trim().toLowerCase() : null,
      created_by: invitedBy || null,
      status: 'active',
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const acceptInvitation = async ({ token, userId, userEmail }) => {
  if (!token || !userId) throw new Error('缺少邀請資訊');
  const { data: invite, error: inviteError } = await supabase
    .from('group_invitations')
    .select('*')
    .eq('token', token)
    .single();
  if (inviteError) throw inviteError;
  if (!invite || invite.status !== 'active') throw new Error('邀請已失效');
  if (invite.email && userEmail && invite.email !== userEmail.toLowerCase()) {
    throw new Error('此邀請不適用於目前帳號');
  }
  if (invite.max_uses && invite.used_count >= invite.max_uses) {
    throw new Error('邀請已達使用上限');
  }

  const { error: memberError } = await supabase
    .from('group_memberships')
    .insert({
      group_id: invite.group_id,
      user_id: userId,
      role: invite.permission_grant || 'readonly',
      created_at: new Date().toISOString()
    });
  if (memberError) throw memberError;

  const nextUsedCount = (invite.used_count || 0) + 1;
  const nextStatus = invite.max_uses && nextUsedCount >= invite.max_uses ? 'used' : 'active';
  const { error: updateError } = await supabase
    .from('group_invitations')
    .update({
      used_count: nextUsedCount,
      status: nextStatus,
      used_at: new Date().toISOString()
    })
    .eq('id', invite.id);
  if (updateError) throw updateError;

  return invite;
};

export const getFoodsByGroup = async (groupId) => {
  if (!groupId) return [];
  try {
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .eq('group_id', groupId)
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
  const { name, flavor, businessHours, portion, price, guiltIndex, addressText, groupId } = foodData;
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
      group_id: groupId || null,
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
