import './FoodList.css';

function FoodList({ foods, ratings = {}, onDelete, onRating, onEdit }) {
  const StarRating = ({ foodId }) => {
    const currentRating = ratings[foodId] || 0;
    return (
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map(star => (
          <span
            key={star}
            onClick={() => onRating(foodId, star)}
            className={`star ${star <= currentRating ? 'active' : ''}`}
            title={`評分 ${star} 星`}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  if (foods.length === 0) {
    return (
      <div className="food-list">
        <h2>📋 美食清單</h2>
        <div className="empty-state">
          <p>還沒有任何美食選項</p>
          <p className="hint">快新增你喜歡的餐廳或食物吧！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="food-list">
      <h2>📋 美食清單</h2>
      <div className="food-items">
        {foods.map((food, index) => (
          <div key={food.id} className="food-item" style={{ animationDelay: `${index * 0.05}s` }}>
            <div className="food-details">
              <span className="food-icon">🍴</span>
              <span className="food-name">{food.name}</span>
              <div className="food-attributes">
                <span className="attribute">口味: {food.flavor}</span>
                <span className="attribute">營業時間: {food.businessHours}</span>
                <span className="attribute">份量: {food.portion}</span>
                <span className="attribute">價格: {food.price}</span>
                <span className="attribute">罪惡指數: {food.guiltIndex}</span>
                {food.addressText && <span className="attribute">地址: {food.addressText}</span>}
                {Number.isFinite(food.distanceKm) && (
                  <span className="attribute">距離: {food.distanceKm.toFixed(1)} km</span>
                )}
              </div>
            </div>
            <StarRating foodId={food.id} />
            <div className="food-actions">
              <button 
                className="edit-button"
                onClick={() => onEdit?.(food)}
                title="編輯"
              >
                ✏️
              </button>
              <button 
                className="delete-button"
                onClick={() => onDelete(food)}
                title="刪除"
              >
                ❌
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FoodList;
