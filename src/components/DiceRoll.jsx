import './DiceRoll.css';

function DiceRoll({ isRolling, selectedFood, onRoll }) {
  return (
    <div className="dice-container">
      <div className={`dice ${isRolling ? 'rolling' : ''}`}>
        {isRolling ? (
          <div className="dice-face">
            <div className="dice-dots">
              <span>🎲</span>
            </div>
          </div>
        ) : selectedFood ? (
          <div className="result">
            <div className="result-label">今晚吃</div>
            <div className="result-food">{selectedFood.name}</div>
            <div className="result-emoji">🍽️</div>
          </div>
        ) : (
          <div className="dice-placeholder">
            <span className="dice-emoji">🎲</span>
            <p>準備好了嗎？</p>
          </div>
        )}
      </div>

      <button 
        className="roll-button" 
        onClick={onRoll}
        disabled={isRolling}
      >
        {isRolling ? '骰子轉轉轉...' : '🎲 骰子決定！'}
      </button>
    </div>
  );
}

export default DiceRoll;
