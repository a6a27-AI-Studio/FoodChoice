import { useState, useEffect } from 'react';
import { initDatabase, getFoodsByGroup, addFood, updateFood, deleteFood, getRandomFood, setRating, getRecommendedFood, getAllRatings, signInWithGoogle, signOut, getSession, onAuthStateChange, ensureUserProfile, getMyGroups, getMyFavoriteGroups, toggleGroupFavorite, searchPublicGroups, getPublicGroupRecommendations, getPublicGroupTrending, createGroup, updateGroup, getGroupRole, deleteGroup, createInvitation, acceptInvitation, getGroupMembers, removeGroupMember, leaveGroup } from './database';
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
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [favoriteGroups, setFavoriteGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [exploreOpen, setExploreOpen] = useState(false);
  const [exploreKeyword, setExploreKeyword] = useState('');
  const [exploreStatus, setExploreStatus] = useState('');
  const [exploreResults, setExploreResults] = useState([]);
  const [recommendedGroups, setRecommendedGroups] = useState([]);
  const [trendingGroups, setTrendingGroups] = useState([]);
  const [exploreSort, setExploreSort] = useState('popular');
  const [isExploring, setIsExploring] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState({ name: '', description: '', isPublic: false, category: '', tagsText: '' });
  const [memberRole, setMemberRole] = useState('');
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
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createGroupForm, setCreateGroupForm] = useState({
    name: '',
    description: '',
    isPublic: false,
    category: '',
    tagsText: ''
  });
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [shareGroupOpen, setShareGroupOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('readonly');
  const [shareStatus, setShareStatus] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [membersStatus, setMembersStatus] = useState('');
  const [memberActionId, setMemberActionId] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationError, setLocationError] = useState('');
  const [guestFoods, setGuestFoods] = useState([]);
  const [guestRatings, setGuestRatings] = useState({});
  const guestStorageKey = 'foodchoice.guest.v1';

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        setDbReady(true);
        const currentSession = await getSession();
        setSession(currentSession);
        setUser(currentSession?.user || null);
        if (currentSession?.user) {
          await ensureUserProfile(currentSession.user);
          await loadGroups(currentSession.user.id);
          await loadFavorites(currentSession.user.id);
        }
      } catch (error) {
        console.error('初始化失敗:', error);
        setDbReady(true);
      }
    };
    init();

    try {
      const raw = localStorage.getItem(guestStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.foods)) setGuestFoods(parsed.foods);
        if (parsed?.ratings && typeof parsed.ratings === 'object') setGuestRatings(parsed.ratings);
      }
    } catch (error) {
      console.warn('讀取訪客資料失敗:', error);
    }

    const hash = window.location.hash || '';
    const tokenMatch = hash.match(/#\/invite\/(.+)$/);
    if (tokenMatch?.[1]) {
      setInviteToken(tokenMatch[1]);
    }

    const { data } = onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);
      if (newSession?.user) {
        await ensureUserProfile(newSession.user);
        await loadGroups(newSession.user.id);
        await loadFavorites(newSession.user.id);
      } else {
        setGroups([]);
        setFavoriteGroups([]);
        setActiveGroupId('');
        setMemberRole('');
        setFoods([]);
      }
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sortBy === 'distanceAsc' || sortBy === 'distanceDesc') {
      ensureLocation();
    }
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem(guestStorageKey, JSON.stringify({ foods: guestFoods, ratings: guestRatings }));
  }, [guestFoods, guestRatings]);

  useEffect(() => {
    const refreshGroup = async () => {
      if (!activeGroupId || !user?.id) {
        setMemberRole('');
        setFoods([]);
        return;
      }
      const role = await getGroupRole(activeGroupId, user.id);
      setMemberRole(role || '');
      await loadFoods(activeGroupId);
    };
    refreshGroup();
  }, [activeGroupId, user?.id]);

  useEffect(() => {
    const acceptInviteIfNeeded = async () => {
      if (!inviteToken || !user?.id) return;
      try {
        const invite = await acceptInvitation({ token: inviteToken, userId: user.id, userEmail: user.email });
        await loadGroups(user.id);
        await loadFavorites(user.id);
        if (invite?.group_id) {
          setActiveGroupId(invite.group_id);
        }
        setInviteToken('');
        window.history.replaceState({}, '', '/FoodChoice/#');
        alert('已加入美食團');
      } catch (error) {
        alert(error?.message || '加入美食團失敗');
      }
    };
    acceptInviteIfNeeded();
  }, [inviteToken, user?.id]);

  const loadFoods = async (groupId) => {
    if (!groupId) {
      setFoods([]);
      setRatings({});
      return;
    }
    const allFoods = await getFoodsByGroup(groupId);
    const allRatings = await getAllRatings();
    setFoods(allFoods);
    setRatings(allRatings);
  };

  const loadGroups = async (userId) => {
    const myGroups = await getMyGroups(userId);
    setGroups(myGroups);
    if (myGroups.length > 0) {
      setActiveGroupId((prev) => (prev && myGroups.some((g) => g.id === prev) ? prev : myGroups[0].id));
    } else {
      setActiveGroupId('');
      setFoods([]);
    }
  };

  const loadFavorites = async (userId) => {
    const list = await getMyFavoriteGroups(userId);
    setFavoriteGroups(list);
  };

  const handleAddFood = async (formData) => {
    if (!user) {
      const item = {
        id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: formData.name,
        flavor: formData.flavor,
        businessHours: formData.businessHours,
        portion: formData.portion,
        price: formData.price,
        guiltIndex: formData.guiltIndex,
        addressText: formData.addressText || '',
        created_at: new Date().toISOString(),
        lat: null,
        lng: null
      };
      setGuestFoods((prev) => [item, ...prev]);
      return true;
    }

    try {
      if (await addFood({ ...formData, groupId: activeGroupId })) {
        await loadFoods(activeGroupId);
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
    if (!user) {
      setGuestFoods((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setGuestRatings((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      setDeleteTarget(null);
      return;
    }

    if (await deleteFood(deleteTarget.id)) {
      await loadFoods(activeGroupId);
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

    if (!user) {
      setGuestFoods((prev) => prev.map((item) => item.id === editTarget.id ? { ...item, ...editForm } : item));
      setEditTarget(null);
      return;
    }

    try {
      const ok = await updateFood(editTarget.id, {
        ...editForm
      });
      if (ok) {
        await loadFoods(activeGroupId);
        setEditTarget(null);
      }
    } catch (error) {
      alert(error?.message || '更新失敗，請稍後再試');
    }
  };

  const handleRating = async (foodId, rating) => {
    if (!user) {
      setGuestRatings((prev) => ({ ...prev, [foodId]: rating }));
      return;
    }
    await setRating(foodId, rating);
    const allRatings = await getAllRatings();
    setRatings(allRatings);
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      alert(error?.message || '登入失敗，請稍後再試');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      alert(error?.message || '登出失敗，請稍後再試');
    }
  };

  const handleCreateGroup = () => {
    setCreateGroupForm({ name: '', description: '', isPublic: false, category: '', tagsText: '' });
    setCreateGroupOpen(true);
  };

  const handleCreateGroupSubmit = async () => {
    if (isCreatingGroup) return;
    if (!createGroupForm.name.trim()) {
      alert('請輸入團名稱');
      return;
    }
    try {
      setIsCreatingGroup(true);
      const group = await createGroup({
        name: createGroupForm.name,
        description: createGroupForm.description,
        ownerId: user?.id,
        isPublic: createGroupForm.isPublic,
        category: createGroupForm.category,
        tags: (createGroupForm.tagsText || '').split(',').map((t) => t.trim()).filter(Boolean)
      });
      await loadGroups(user?.id);
      if (group?.id) {
        setActiveGroupId(group.id);
      }
      setCreateGroupOpen(false);
    } catch (error) {
      alert(error?.message || '建立群組失敗');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleOpenEditGroup = () => {
    const current = groups.find((g) => g.id === activeGroupId);
    if (!current) return;
    setEditGroupForm({
      name: current.name || '',
      description: current.description || '',
      isPublic: !!current.is_public,
      category: current.category || '',
      tagsText: Array.isArray(current.search_tags) ? current.search_tags.join(', ') : ''
    });
    setEditGroupOpen(true);
  };

  const handleEditGroupSubmit = async () => {
    if (!activeGroupId || !user?.id) return;
    if (!editGroupForm.name.trim()) {
      alert('請輸入團名稱');
      return;
    }
    if (isSavingGroup) return;
    try {
      setIsSavingGroup(true);
      await updateGroup({
        groupId: activeGroupId,
        userId: user.id,
        name: editGroupForm.name,
        description: editGroupForm.description,
        isPublic: editGroupForm.isPublic,
        category: editGroupForm.category,
        tags: (editGroupForm.tagsText || '').split(',').map((t) => t.trim()).filter(Boolean)
      });
      await loadGroups(user.id);
      await loadFavorites(user.id);
      setEditGroupOpen(false);
    } catch (error) {
      alert(error?.message || '更新群組失敗');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeGroupId || !user?.id) return;
    if (!canDeleteGroup) {
      alert('僅管理員可刪除群組');
      return;
    }
    if (isDeletingGroup) return;
    try {
      setIsDeletingGroup(true);
      await deleteGroup({ groupId: activeGroupId, userId: user.id });
      setDeleteGroupOpen(false);
      await loadGroups(user.id);
      setActiveGroupId('');
      setFoods([]);
    } catch (error) {
      alert(error?.message || '刪除群組失敗');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!activeGroupId || !user?.id) return;
    if (isSharing) return;
    try {
      setIsSharing(true);
      const invite = await createInvitation({
        groupId: activeGroupId,
        role: shareRole,
        invitedBy: user.id
      });
      const link = buildInviteLink(invite.token);
      setShareLink(link);
      setShareStatus('已產生邀請連結');
    } catch (error) {
      setShareStatus(error?.message || '產生邀請連結失敗');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCreateEmailInvite = async () => {
    if (!activeGroupId || !user?.id) return;
    if (!shareEmail.trim()) {
      setShareStatus('請輸入 Email');
      return;
    }
    if (isSharing) return;
    try {
      setIsSharing(true);
      const invite = await createInvitation({
        groupId: activeGroupId,
        role: shareRole,
        invitedBy: user.id,
        email: shareEmail
      });
      const link = buildInviteLink(invite.token);
      setShareLink(link);
      setShareStatus('已建立 Email 邀請，請將連結寄給對方');
    } catch (error) {
      setShareStatus(error?.message || 'Email 邀請建立失敗');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareStatus('已複製連結');
    } catch (error) {
      setShareStatus('複製失敗，請手動複製');
    }
  };

  const loadMembers = async () => {
    if (!activeGroupId) return;
    setMembersStatus('載入中...');
    try {
      const list = await getGroupMembers(activeGroupId);
      setGroupMembers(list);
      setMembersStatus('');
    } catch (error) {
      setMembersStatus(error?.message || '載入成員失敗');
    }
  };

  const handleOpenMembers = async () => {
    setMembersOpen(true);
    await loadMembers();
  };

  const handleLeaveGroup = async () => {
    if (!activeGroupId || !user?.id) return;
    const ok = window.confirm('確定要退出這個美食團嗎？');
    if (!ok) return;
    try {
      await leaveGroup({ groupId: activeGroupId, userId: user.id });
      setMembersOpen(false);
      await loadGroups(user.id);
    } catch (error) {
      alert(error?.message || '退出群組失敗');
    }
  };

  const handleRemoveMember = async (member) => {
    if (!activeGroupId || !user?.id) return;
    if (member.user_id === user.id) {
      await handleLeaveGroup();
      return;
    }
    const ok = window.confirm(`確定要移除 ${member.users?.full_name || member.users?.email || '此成員'} 嗎？`);
    if (!ok) return;
    try {
      setMemberActionId(member.user_id);
      await removeGroupMember({
        groupId: activeGroupId,
        adminId: user.id,
        targetUserId: member.user_id
      });
      await loadMembers();
      await loadGroups(user.id);
    } catch (error) {
      alert(error?.message || '移除成員失敗');
    } finally {
      setMemberActionId('');
    }
  };

  const sortExploreList = (list, sortKey) => {
    const arr = [...(list || [])];
    if (sortKey === 'name') return arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'));
    if (sortKey === 'random') return arr.sort(() => Math.random() - 0.5);
    return arr.sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0));
  };

  const loadExploreRecommendations = async () => {
    if (!user?.id) return;
    try {
      const recs = await getPublicGroupRecommendations({ limit: 6 });
      setRecommendedGroups(recs);
    } catch (error) {
      setRecommendedGroups([]);
    }
  };

  const loadTrendingGroups = async () => {
    if (!user?.id) return;
    try {
      const top = await getPublicGroupTrending({ limit: 10 });
      setTrendingGroups(top);
    } catch (error) {
      setTrendingGroups([]);
    }
  };

  const handleOpenExplore = async () => {
    setExploreOpen(true);
    setExploreStatus('');
    setExploreKeyword('');
    setExploreSort('popular');
    setExploreResults([]);
    await loadExploreRecommendations();
    await loadTrendingGroups();
  };

  const runExploreSearch = async (forcedKeyword = null) => {
    if (!user?.id) return;
    if (isExploring) return;
    try {
      setIsExploring(true);
      setExploreStatus('搜尋中...');
      const keyword = forcedKeyword === null ? exploreKeyword : forcedKeyword;
      const results = await searchPublicGroups({ keyword, limit: 50 });
      const sorted = sortExploreList(results, exploreSort);
      setExploreResults(sorted);
      setExploreStatus(sorted.length === 0 ? '找不到符合的公開美食團' : '');
    } catch (error) {
      setExploreStatus(error?.message || '搜尋失敗');
    } finally {
      setIsExploring(false);
    }
  };

  const handleToggleFavorite = async (groupId, nextFavorited) => {
    if (!user?.id) return;
    try {
      await toggleGroupFavorite({ groupId, userId: user.id, nextFavorited });
      await loadFavorites(user.id);
      await loadExploreRecommendations();
      // refresh search list so ★數/狀態同步
      if ((exploreKeyword || '').trim()) {
        await runExploreSearch(exploreKeyword);
      }
    } catch (error) {
      alert(error?.message || '收藏操作失敗');
    }
  };

  const favoriteAsGroups = favoriteGroups.map((g) => ({ ...g, role: 'favorite' }));
  const combinedGroups = [...groups, ...favoriteAsGroups.filter((g) => !groups.some((m) => m.id === g.id))];

  const canEdit = user ? (memberRole && memberRole !== 'readonly') : true;
  const canDeleteGroup = memberRole === 'admin';
  const sourceFoods = user ? foods : guestFoods;
  const sourceRatings = user ? ratings : guestRatings;
  const roleLabels = {
    admin: '管理員',
    member: '可編輯',
    readonly: '唯讀',
    favorite: '收藏(唯讀)'
  };

  const buildInviteLink = (token) => {
    const base = `${window.location.origin}/FoodChoice/`;
    return `${base}#/invite/${token}`;
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
    const recommended = getRecommendedFood(filteredFoods, sourceRatings);
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

  const filteredFoods = sourceFoods.filter((food) => {
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
        <div className="header-row">
          <div>
            <h1>🎲 美食骰子</h1>
            <p>今晚吃什麼？讓骰子決定！</p>
          </div>
          <div className="auth-actions">
            {user ? (
              <>
                <span className="user-info">{user.user_metadata?.full_name || user.email}</span>
                <button onClick={handleSignOut} className="btn-secondary">登出</button>
              </>
            ) : (
              <button onClick={handleSignIn} className="btn-primary">Google 登入</button>
            )}
          </div>
        </div>
        {user && (
          <div className="group-bar">
            <select
              value={activeGroupId}
              onChange={(e) => setActiveGroupId(e.target.value)}
              className="group-select"
            >
              {combinedGroups.length === 0 && <option value="">尚未加入任何團</option>}
              {combinedGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({roleLabels[group.role] || group.role}{typeof group.favorite_count === 'number' ? `, ★${group.favorite_count}` : ''})
                </option>
              ))}
            </select>
            <button onClick={handleCreateGroup} className="btn-secondary">建立團</button>
            <button onClick={handleOpenExplore} className="btn-secondary">探索公開團</button>
            {activeGroupId && (
              <button onClick={() => { setShareGroupOpen(true); setShareStatus(''); setShareLink(''); }} className="btn-secondary">分享團</button>
            )}
            {canDeleteGroup && activeGroupId && (
              <button onClick={handleOpenEditGroup} className="btn-secondary">編輯團設定</button>
            )}
            {activeGroupId && (
              <button onClick={handleOpenMembers} className="btn-secondary">成員管理</button>
            )}
            {canDeleteGroup && activeGroupId && (
              <button onClick={() => setDeleteGroupOpen(true)} className="btn-danger">刪除團</button>
            )}
          </div>
        )}
      </header>

      <main className="main">
        {!user && (
          <div className="notice">目前是訪客模式：資料只會存在你的瀏覽器（localStorage）。</div>
        )}
        {user && !activeGroupId && (
          <div className="notice">尚未加入任何美食團，請建立新團或接受邀請。</div>
        )}

        {(!user || activeGroupId) && (
          <>
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

            <AddFoodForm onAdd={handleAddFood} foods={foods} disabled={!canEdit} />

            <FoodList 
              foods={sortedFoods} 
              ratings={sourceRatings}
              onDelete={handleDeleteFood}
              onRating={handleRating}
              onEdit={openEdit}
              canEdit={canEdit}
            />
          </>
        )}
      </main>

      {canEdit && deleteTarget && (
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

      {canEdit && editTarget && (
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

      {user && createGroupOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>建立新團</h3>
            <div className="modal-form">
              <label>
                團名稱
                <input
                  type="text"
                  value={createGroupForm.name}
                  onChange={(e) => setCreateGroupForm({ ...createGroupForm, name: e.target.value })}
                />
              </label>
              <label>
                描述（選填）
                <input
                  type="text"
                  value={createGroupForm.description}
                  onChange={(e) => setCreateGroupForm({ ...createGroupForm, description: e.target.value })}
                />
              </label>
              <label>
                分類（選填）
                <input
                  type="text"
                  placeholder="例如：宵夜、減脂餐、咖啡甜點"
                  value={createGroupForm.category}
                  onChange={(e) => setCreateGroupForm({ ...createGroupForm, category: e.target.value })}
                />
              </label>
              <label>
                搜尋標籤（選填，逗號分隔）
                <input
                  type="text"
                  placeholder="例如：台北,火鍋,聚餐"
                  value={createGroupForm.tagsText}
                  onChange={(e) => setCreateGroupForm({ ...createGroupForm, tagsText: e.target.value })}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!createGroupForm.isPublic}
                  onChange={(e) => setCreateGroupForm({ ...createGroupForm, isPublic: e.target.checked })}
                />
                公開美食團（可被搜尋/收藏）
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setCreateGroupOpen(false)}>取消</button>
              <button className="btn-primary" onClick={handleCreateGroupSubmit} disabled={isCreatingGroup}>
                {isCreatingGroup ? '建立中...' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}

      {user && editGroupOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>編輯團設定</h3>
            <div className="modal-form">
              <label>
                團名稱
                <input type="text" value={editGroupForm.name} onChange={(e) => setEditGroupForm({ ...editGroupForm, name: e.target.value })} />
              </label>
              <label>
                描述（選填）
                <input type="text" value={editGroupForm.description} onChange={(e) => setEditGroupForm({ ...editGroupForm, description: e.target.value })} />
              </label>
              <label>
                分類（選填）
                <input type="text" value={editGroupForm.category} onChange={(e) => setEditGroupForm({ ...editGroupForm, category: e.target.value })} />
              </label>
              <label>
                搜尋標籤（逗號分隔）
                <input type="text" value={editGroupForm.tagsText} onChange={(e) => setEditGroupForm({ ...editGroupForm, tagsText: e.target.value })} />
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={!!editGroupForm.isPublic} onChange={(e) => setEditGroupForm({ ...editGroupForm, isPublic: e.target.checked })} />
                公開美食團（可被搜尋/收藏）
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditGroupOpen(false)}>取消</button>
              <button className="btn-primary" onClick={handleEditGroupSubmit} disabled={isSavingGroup}>{isSavingGroup ? '儲存中...' : '儲存'}</button>
            </div>
          </div>
        </div>
      )}

      {user && deleteGroupOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>刪除群組</h3>
            <p>確定要刪除目前這個群組嗎？此動作無法復原。</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteGroupOpen(false)}>取消</button>
              <button className="btn-danger" onClick={handleDeleteGroup} disabled={isDeletingGroup}>
                {isDeletingGroup ? '刪除中...' : '刪除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {user && shareGroupOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>分享美食團</h3>
            <div className="modal-form">
              <label>
                權限
                <select value={shareRole} onChange={(e) => setShareRole(e.target.value)}>
                  <option value="readonly">唯讀</option>
                  <option value="member">可編輯</option>
                  <option value="admin">管理員</option>
                </select>
              </label>
              <div className="modal-actions" style={{ justifyContent: 'flex-start', gap: '8px' }}>
                <button className="btn-primary" onClick={handleCreateShareLink} disabled={isSharing}>產生邀請連結</button>
                {shareLink && (
                  <button className="btn-secondary" onClick={handleCopyShareLink}>複製連結</button>
                )}
              </div>
              {shareLink && (
                <div className="notice" style={{ wordBreak: 'break-all' }}>{shareLink}</div>
              )}
              <hr style={{ margin: '16px 0' }} />
              <label>
                Email 邀請
                <input
                  type="email"
                  placeholder="輸入對方 Email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                />
              </label>
              <div className="modal-actions" style={{ justifyContent: 'flex-start', gap: '8px' }}>
                <button className="btn-primary" onClick={handleCreateEmailInvite} disabled={isSharing}>建立 Email 邀請</button>
              </div>
              {shareStatus && (
                <div className="notice">{shareStatus}</div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShareGroupOpen(false)}>關閉</button>
            </div>
          </div>
        </div>
      )}

      {user && membersOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>成員管理</h3>
            {membersStatus && (
              <div className="notice">{membersStatus}</div>
            )}
            <div className="member-list">
              {groupMembers.map((member) => {
                const displayName = member.users?.full_name || member.users?.email || '未命名';
                const roleLabel = roleLabels[member.role] || member.role;
                const isSelf = member.user_id === user?.id;
                return (
                  <div className={`member-row${isSelf ? ' is-self' : ''}`} key={member.id}>
                    <div className="member-info">
                      <div className="member-name">
                        {displayName}
                        {isSelf && (
                          <span className="self-badge">你</span>
                        )}
                      </div>
                      {member.users?.email && (
                        <div className="member-email">{member.users.email}</div>
                      )}
                    </div>
                    <div className="member-role">{roleLabel}</div>
                    {(canDeleteGroup || isSelf) && (
                      <button
                        className={isSelf ? 'btn-secondary' : 'btn-danger'}
                        onClick={() => handleRemoveMember(member)}
                        disabled={memberActionId === member.user_id}
                      >
                        {memberActionId === member.user_id
                          ? '處理中...'
                          : isSelf
                          ? '退出團'
                          : '移除成員'}
                      </button>
                    )}
                  </div>
                );
              })}
              {groupMembers.length === 0 && !membersStatus && (
                <div className="notice">尚無成員資料</div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setMembersOpen(false)}>關閉</button>
            </div>
          </div>
        </div>
      )}

      {user && exploreOpen && (
        <div className="modal-backdrop">
          <div className="modal modal-wide">
            <h3>探索公開美食團</h3>
            <div className="modal-form">
              <label>
                關鍵字（團名 / 美食名 / 分類 / 標籤）
                <input
                  type="text"
                  value={exploreKeyword}
                  onChange={(e) => setExploreKeyword(e.target.value)}
                  placeholder="例如：火鍋 / 拉麵 / 台北 / 宵夜"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runExploreSearch();
                  }}
                />
              </label>

              <div className="explore-toolbar">
                <div className="quick-tags">
                  {['火鍋', '拉麵', '宵夜', '咖啡', '健康餐'].map((tag) => (
                    <button key={tag} className="tag-chip" onClick={() => { setExploreKeyword(tag); runExploreSearch(tag); }}>{tag}</button>
                  ))}
                </div>
                <select value={exploreSort} onChange={(e) => {
                  const next = e.target.value;
                  setExploreSort(next);
                  setExploreResults((prev) => sortExploreList(prev, next));
                }}>
                  <option value="popular">熱門優先（★）</option>
                  <option value="name">名稱排序</option>
                  <option value="random">隨機排序</option>
                </select>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setExploreOpen(false)}>關閉</button>
                <button className="btn-secondary" onClick={loadExploreRecommendations}>刷新推薦</button>
                <button className="btn-primary" onClick={runExploreSearch} disabled={isExploring}>
                  {isExploring ? '搜尋中...' : '搜尋'}
                </button>
              </div>

              {(exploreKeyword || '').trim() === '' && recommendedGroups.length > 0 && (
                <>
                  <h4>🎯 隨機推薦（搜尋前）</h4>
                  <div className="explore-results">
                    {recommendedGroups.map((g) => (
                      <div key={g.id} className="explore-row">
                        <div className="explore-main">
                          <div className="explore-title">{g.name}</div>
                          {g.description && <div className="explore-desc">{g.description}</div>}
                          <div className="explore-meta">★ {g.favorite_count || 0}{g.category ? ` · ${g.category}` : ''}{g.recommendation_reason ? ` · ${g.recommendation_reason}` : ''}</div>
                        </div>
                        <div className="explore-actions">
                          <button className={g.is_favorited ? 'btn-secondary' : 'btn-primary'} onClick={() => handleToggleFavorite(g.id, !g.is_favorited)}>{g.is_favorited ? '取消收藏' : '收藏'}</button>
                          <button className="btn-secondary" onClick={() => { setActiveGroupId(g.id); setExploreOpen(false); }}>打開</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(exploreKeyword || '').trim() === '' && trendingGroups.length > 0 && (
                <>
                  <h4>🔥 今日熱門榜 Top 10</h4>
                  <div className="explore-results">
                    {trendingGroups.map((g, idx) => (
                      <div key={g.id} className="explore-row">
                        <div className="explore-main">
                          <div className="explore-title">#{idx + 1} {g.name}</div>
                          {g.description && <div className="explore-desc">{g.description}</div>}
                          <div className="explore-meta">★ {g.favorite_count || 0}{g.food_count ? ` · 美食 ${g.food_count}` : ''}{g.category ? ` · ${g.category}` : ''}</div>
                        </div>
                        <div className="explore-actions">
                          <button className={g.is_favorited ? 'btn-secondary' : 'btn-primary'} onClick={() => handleToggleFavorite(g.id, !g.is_favorited)}>{g.is_favorited ? '取消收藏' : '收藏'}</button>
                          <button className="btn-secondary" onClick={() => { setActiveGroupId(g.id); setExploreOpen(false); }}>打開</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {exploreStatus && <div className="notice">{exploreStatus}</div>}

              {exploreResults.length > 0 && (
                <>
                  <h4>🔎 搜尋結果</h4>
                  <div className="explore-results">
                    {exploreResults.map((g) => (
                      <div key={g.id} className="explore-row">
                        <div className="explore-main">
                          <div className="explore-title">{g.name}</div>
                          {g.description && <div className="explore-desc">{g.description}</div>}
                          <div className="explore-meta">★ {g.favorite_count || 0}{g.matched_food_count ? ` · 命中美食 ${g.matched_food_count}` : ''}{g.category ? ` · ${g.category}` : ''}</div>
                          {Array.isArray(g.search_tags) && g.search_tags.length > 0 && (
                            <div className="tag-row">{g.search_tags.slice(0, 6).map((t) => <span key={t} className="tag-pill">#{t}</span>)}</div>
                          )}
                        </div>
                        <div className="explore-actions">
                          <button className={g.is_favorited ? 'btn-secondary' : 'btn-primary'} onClick={() => handleToggleFavorite(g.id, !g.is_favorited)}>{g.is_favorited ? '取消收藏' : '收藏'}</button>
                          <button className="btn-secondary" onClick={() => { setActiveGroupId(g.id); setExploreOpen(false); }}>打開</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        {(!user || activeGroupId) ? (
          <p>總共有 {sourceFoods.length} 個美食選項，篩選後 {filteredFoods.length} 個</p>
        ) : (
          <p>登入後即可建立與管理美食團。</p>
        )}
      </footer>
    </div>
  );
}

export default App;
