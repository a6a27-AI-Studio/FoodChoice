import { useState } from 'react';
import './AddFoodForm.css';

function AddFoodForm({ onAdd, foods }) {
  const [formData, setFormData] = useState({
    name: '',
    flavor: '',
    portion: '',
    price: '',
    guiltIndex: '',
    addressText: ''
  });
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');

  const timeOptions = (() => {
    const options = [];
    for (let h = 0; h < 24; h += 1) {
      for (let m = 0; m < 60; m += 30) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        options.push(`${hh}:${mm}`);
      }
    }
    return options;
  })();

  const toMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('請輸入美食名稱');
      return;
    }

    if (!formData.flavor || !formData.portion || !formData.price || !formData.guiltIndex || !startTime || !endTime) {
      setError('請填寫所有欄位');
      return;
    }

    const nameTrimmed = formData.name.trim();
    const duplicated = (foods || []).some((food) =>
      food.name && food.name.trim().toLowerCase() === nameTrimmed.toLowerCase()
    );
    if (duplicated) {
      setError('已有相同名稱的美食，請更換名稱');
      return;
    }

    if (toMinutes(endTime) <= toMinutes(startTime)) {
      setError('結束時間需晚於開始時間');
      return;
    }

    const submitData = {
      ...formData,
      businessHours: `${startTime}-${endTime}`
    };

    if (await onAdd(submitData)) {
      setFormData({
        name: '',
        flavor: '',
        portion: '',
        price: '',
        guiltIndex: '',
        addressText: ''
      });
      setStartTime('');
      setEndTime('');
      setError('');
    } else {
      setError('新增失敗，請重試');
    }
  };

  return (
    <div className="add-food-form">
      <h2>➕ 新增美食</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">食物名稱:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="例如：小高拉麵、火鍋、大胖炒飯..."
            maxLength={50}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="flavor">口味:</label>
          <select id="flavor" name="flavor" value={formData.flavor} onChange={handleChange} required>
            <option value="">選擇口味</option>
            <option value="甜">甜</option>
            <option value="鹹">鹹</option>
            <option value="酸">酸</option>
            <option value="辣">辣</option>
            <option value="苦">苦</option>
            <option value="混合">混合</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="businessHoursStart">營業時間:</label>
          <div className="time-range">
            <select
              id="businessHoursStart"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setError('');
              }}
              required
            >
              <option value="">開始時間</option>
              {timeOptions.map((time) => (
                <option key={`start-${time}`} value={time}>{time}</option>
              ))}
            </select>
            <span className="time-separator">至</span>
            <select
              id="businessHoursEnd"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setError('');
              }}
              required
            >
              <option value="">結束時間</option>
              {timeOptions.map((time) => (
                <option key={`end-${time}`} value={time}>{time}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="portion">份量:</label>
          <select id="portion" name="portion" value={formData.portion} onChange={handleChange} required>
            <option value="">選擇份量</option>
            <option value="小">小</option>
            <option value="中">中</option>
            <option value="大">大</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="price">價格:</label>
          <select id="price" name="price" value={formData.price} onChange={handleChange} required>
            <option value="">選擇價格</option>
            <option value="低">低</option>
            <option value="中">中</option>
            <option value="高">高</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="guiltIndex">罪惡指數:</label>
          <select id="guiltIndex" name="guiltIndex" value={formData.guiltIndex} onChange={handleChange} required>
            <option value="">選擇罪惡指數</option>
            <option value="低">低</option>
            <option value="中">中</option>
            <option value="高">高</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="addressText">地址:</label>
          <input
            type="text"
            id="addressText"
            name="addressText"
            value={formData.addressText}
            onChange={handleChange}
            placeholder="例如 台北市信義區..."
          />
        </div>

        <button type="submit">新增</button>
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
}

export default AddFoodForm;
