import { useState, useEffect } from 'react';
import { initDatabase, getFoodsByGroup, addFood, updateFood, deleteFood, getRandomFood, setRating, getRecommendedFood, getAllRatings, signInWithGoogle, signOut, getSession, onAuthStateChange, ensureUserProfile, getMyGroups, createGroup, getGroupRole, deleteGroup, createInvitation, acceptInvitation, getGroupMembers, removeGroupMember, leaveGroup } from './database';
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
  const [activeGroupId, setActiveGroupId] = useState('');
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
    description: ''
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
        }
      } catch (error) {
        console.error('初始化失敗:', error);
        setDbReady(true);
      }
    };
    init();

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
      } else {
        setGroups([]);
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

  const handleAddFood = async (formData) => {
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
    setCreateGroupForm({ name: '', description: '' });
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
        ownerId: user?.id
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

  const canEdit = memberRole && memberRole !== 'readonly';
  const canDeleteGroup = memberRole === 'admin';
  const roleLabels = {
    admin: '管理員',
    member: '可編輯',
    readonly: '唯讀'
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
              {groups.length === 0 && <option value="">尚未加入任何團</option>}
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.role})
                </option>
              ))}
            </select>
            <button onClick={handleCreateGroup} className="btn-secondary">建立團</button>
            {activeGroupId && (
              <button onClick={() => { setShareGroupOpen(true); setShareStatus(''); setShareLink(''); }} className="btn-secondary">分享團</button>
            )}
            {activeGroupId && (
              <button onClick={handleOpenMembers} className="btn-secondary">成員管理</button>
            )}
            {activeGroupId && (
              <button onClick={handleLeaveGroup} className="btn-secondary">退出團</button>
            )}
            {canDeleteGroup && activeGroupId && (
              <button onClick={() => setDeleteGroupOpen(true)} className="btn-danger">刪除團</button>
            )}
          </div>
        )}
      </header>

      <main className="main">
        {!user && (
          <div className="notice">請先登入以使用美食團功能。</div>
        )}
        {user && !activeGroupId && (
          <div className="notice">尚未加入任何美食團，請建立新團或接受邀請。</div>
        )}

        {user && activeGroupId && (
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
              ratings={ratings}
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
                  <div className="member-row" key={member.id}>
                    <div className="member-info">
                      <div className="member-name">{displayName}</div>
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

      <footer className="footer">
        {user && activeGroupId ? (
          <p>總共有 {foods.length} 個美食選項，篩選後 {filteredFoods.length} 個</p>
        ) : (
          <p>登入後即可建立與管理美食團。</p>
        )}
      </footer>
    </div>
  );
}

export default App;
