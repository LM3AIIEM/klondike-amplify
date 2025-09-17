import { useState, useCallback, useMemo } from 'react';

const MobileKlondikeSolitaire = () => {
  // Card suits and ranks
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const suitSymbols = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };
  const rankLabels = {
    1: 'A', 11: 'J', 12: 'Q', 13: 'K'
  };

  // Create a shuffled deck
  const createDeck = () => {
    const deck = [];
    suits.forEach(suit => {
      ranks.forEach(rank => {
        deck.push({ suit, rank, faceUp: false, id: `${suit}-${rank}` });
      });
    });
    
    // Shuffle using Fisher-Yates algorithm
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  // Initial game state
  const initializeGame = () => {
    const deck = createDeck();
    const tableau = [[], [], [], [], [], [], []];
    const foundations = [[], [], [], []];
    
    // Deal cards to tableau
    let deckIndex = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = { ...deck[deckIndex] };
        card.faceUp = row === col; // Only top card face up
        tableau[col].push(card);
        deckIndex++;
      }
    }
    
    const stock = deck.slice(deckIndex);
    
    return {
      stock,
      waste: [],
      foundations,
      tableau,
      selected: null,
      moves: 0,
      gameWon: false
    };
  };

  const [gameState, setGameState] = useState(initializeGame);
  const [moveHistory, setMoveHistory] = useState([]);
  const [lastTap, setLastTap] = useState({ time: 0, target: null });

  // Card component - removing memo to simplify and avoid type issues
  const Card = ({ card, onClick, selected = false }) => {
    const isRed = ['hearts', 'diamonds'].includes(card.suit);
    const displayRank = rankLabels[card.rank] || card.rank;
    
    if (!card.faceUp) {
      return (
        <div 
          className="card card-back"
          onClick={onClick}
        >
          <div className="card-pattern"></div>
        </div>
      );
    }

    return (
      <div 
        className={`card card-face ${isRed ? 'red' : 'black'} ${selected ? 'selected' : ''}`}
        onClick={onClick}
      >
        <div className="card-corner top-left">
          <div className="rank">{displayRank}</div>
          <div className="suit">{suitSymbols[card.suit]}</div>
        </div>
        <div className="card-center">
          <div className="suit-large">{suitSymbols[card.suit]}</div>
        </div>
        <div className="card-corner bottom-right">
          <div className="rank">{displayRank}</div>
          <div className="suit">{suitSymbols[card.suit]}</div>
        </div>
      </div>
    );
  };

  // Check if card can be moved to foundation
  const canMoveToFoundation = useCallback((card, foundation) => {
    if (foundation.length === 0) {
      return card.rank === 1;
    }
    const topCard = foundation[foundation.length - 1];
    return card.suit === topCard.suit && card.rank === topCard.rank + 1;
  }, []);

  // Check if card can be moved to tableau
  const canMoveToTableau = useCallback((card, tableau) => {
    if (tableau.length === 0) {
      return card.rank === 13;
    }
    const topCard = tableau[tableau.length - 1];
    const redSuits = ['hearts', 'diamonds'];
    const isCardRed = redSuits.includes(card.suit);
    const isTopRed = redSuits.includes(topCard.suit);
    return card.rank === topCard.rank - 1 && isCardRed !== isTopRed;
  }, []);

  // Auto-move card to foundation if possible
  const autoMoveToFoundation = useCallback((card, foundations) => {
    for (let i = 0; i < 4; i++) {
      if (canMoveToFoundation(card, foundations[i])) {
        return i;
      }
    }
    return -1;
  }, [canMoveToFoundation]);

  // Helper function to create deep copy of game state
  const deepCopyGameState = useCallback((state) => {
    return {
      ...state,
      stock: [...state.stock],
      waste: [...state.waste],
      foundations: state.foundations.map(foundation => [...foundation]),
      tableau: state.tableau.map(column => [...column]),
      selected: state.selected ? { ...state.selected, location: { ...state.selected.location } } : null
    };
  }, []);

  // Handle card selection and movement
  const handleCardTap = useCallback((location, pileIndex = 0, cardIndex = 0) => {
    const now = Date.now();
    const timeDiff = now - lastTap.time;
    const isSameTarget = lastTap.target === `${location}-${pileIndex}-${cardIndex}`;
    const isDoubleTap = timeDiff < 300 && isSameTarget;

    setLastTap({ time: now, target: `${location}-${pileIndex}-${cardIndex}` });

    setGameState(prev => {
      // Save current state to history before making changes
      setMoveHistory(prevHistory => {
        const newHistory = [...prevHistory, deepCopyGameState(prev)];
        return newHistory.slice(-10); // Keep only last 10 moves
      });

      if (location === 'stock') {
        const newState = deepCopyGameState(prev);
        
        if (newState.stock.length > 0) {
          const card = newState.stock.pop();
          card.faceUp = true;
          newState.waste.push(card);
          newState.moves++;
        } else if (newState.waste.length > 0) {
          newState.stock = newState.waste.map(card => ({ ...card, faceUp: false })).reverse();
          newState.waste = [];
          newState.moves++;
        }
        newState.selected = null;
        return newState;
      }

      let selectedCard = null;
      let selectedLocation = null;

      // Get the selected card
      if (location === 'waste' && prev.waste.length > 0) {
        selectedCard = prev.waste[prev.waste.length - 1];
        selectedLocation = { type: 'waste' };
      } else if (location === 'tableau' && prev.tableau[pileIndex].length > cardIndex) {
        const card = prev.tableau[pileIndex][cardIndex];
        if (card.faceUp) {
          selectedCard = card;
          selectedLocation = { type: 'tableau', pile: pileIndex, index: cardIndex };
        }
      } else if (location === 'foundation' && prev.foundations[pileIndex].length > 0) {
        selectedCard = prev.foundations[pileIndex][prev.foundations[pileIndex].length - 1];
        selectedLocation = { type: 'foundation', pile: pileIndex };
      }

      // Handle double-tap auto-move
      if (isDoubleTap && selectedCard) {
        const foundationIndex = autoMoveToFoundation(selectedCard, prev.foundations);
        if (foundationIndex !== -1) {
          const newState = deepCopyGameState(prev);
          
          // Remove card from source
          if (selectedLocation.type === 'waste') {
            newState.waste.pop();
          } else if (selectedLocation.type === 'tableau') {
            newState.tableau[selectedLocation.pile].pop();
            
            // Flip next card if needed
            const pile = newState.tableau[selectedLocation.pile];
            if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
              pile[pile.length - 1].faceUp = true;
            }
          } else if (selectedLocation.type === 'foundation') {
            newState.foundations[selectedLocation.pile].pop();
          }
          
          // Add to foundation
          newState.foundations[foundationIndex].push(selectedCard);
          newState.moves++;
          newState.selected = null;
          return newState;
        }
      }

      // Handle selection/movement
      if (!prev.selected && selectedCard) {
        return {
          ...prev,
          selected: { card: selectedCard, location: selectedLocation }
        };
      } else if (prev.selected) {
        const { card: movingCard, location: sourceLocation } = prev.selected;
        
        if (location === 'foundation') {
          // Move to foundation
          if (canMoveToFoundation(movingCard, prev.foundations[pileIndex])) {
            const newState = deepCopyGameState(prev);
            
            // Add to foundation
            newState.foundations[pileIndex].push(movingCard);
            
            // Remove from source
            if (sourceLocation.type === 'waste') {
              newState.waste.pop();
            } else if (sourceLocation.type === 'tableau') {
              newState.tableau[sourceLocation.pile].pop();
              
              // Flip next card if needed
              const pile = newState.tableau[sourceLocation.pile];
              if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
                pile[pile.length - 1].faceUp = true;
              }
            }
            
            newState.moves++;
            newState.selected = null;
            
            // Check for win condition
            const totalFoundationCards = newState.foundations.reduce((sum, pile) => sum + pile.length, 0);
            if (totalFoundationCards === 52) {
              newState.gameWon = true;
            }
            
            return newState;
          }
        } else if (location === 'tableau') {
          // Move to tableau
          if (canMoveToTableau(movingCard, prev.tableau[pileIndex])) {
            const newState = deepCopyGameState(prev);
            
            if (sourceLocation.type === 'waste') {
              // Move single card from waste
              newState.waste.pop();
              newState.tableau[pileIndex].push(movingCard);
            } else if (sourceLocation.type === 'tableau') {
              // Move cards from tableau to tableau
              const sourceCards = newState.tableau[sourceLocation.pile].slice(sourceLocation.index);
              
              // Remove cards from source
              newState.tableau[sourceLocation.pile] = newState.tableau[sourceLocation.pile].slice(0, sourceLocation.index);
              
              // Flip next card if needed
              const sourcePile = newState.tableau[sourceLocation.pile];
              if (sourcePile.length > 0 && !sourcePile[sourcePile.length - 1].faceUp) {
                sourcePile[sourcePile.length - 1].faceUp = true;
              }
              
              // Add cards to destination
              newState.tableau[pileIndex].push(...sourceCards);
            } else if (sourceLocation.type === 'foundation') {
              newState.foundations[sourceLocation.pile].pop();
              newState.tableau[pileIndex].push(movingCard);
            }
            
            newState.moves++;
            newState.selected = null;
            return newState;
          }
        }

        // If no valid move, just deselect
        return { ...prev, selected: null };
      }

      return prev;
    });
  }, [lastTap, canMoveToFoundation, canMoveToTableau, autoMoveToFoundation, deepCopyGameState]);

  // Handle empty tableau tap
  const handleEmptyTableauTap = useCallback((pileIndex) => {
    if (gameState.selected && gameState.selected.card.rank === 13) {
      handleCardTap('tableau', pileIndex, 0);
    }
  }, [gameState.selected, handleCardTap]);

  // Undo last move
  const undoMove = useCallback(() => {
    if (moveHistory.length > 0) {
      const previousState = moveHistory[moveHistory.length - 1];
      setGameState(previousState);
      setMoveHistory(prev => prev.slice(0, -1));
    }
  }, [moveHistory]);

  // New game
  const newGame = useCallback(() => {
    setGameState(initializeGame());
    setMoveHistory([]);
  }, []);

  // Memoized tableau rendering to prevent unnecessary re-renders
  const tableauPiles = useMemo(() => {
    return gameState.tableau.map((pile, pileIndex) => (
      <div key={pileIndex} className="tableau-pile">
        {pile.length > 0 ? (
          <div className="tableau-cards">
            {pile.map((card, cardIndex) => (
              <div
                key={card.id}
                className="tableau-card-wrapper"
                style={{
                  position: 'absolute',
                  top: `${cardIndex * 3}vw`,
                  left: 0,
                  zIndex: cardIndex,
                  width: '12vw',
                  '--card-index': cardIndex
                } as React.CSSProperties}
              >
                <Card 
                  card={card}
                  onClick={() => handleCardTap('tableau', pileIndex, cardIndex)}
                  selected={gameState.selected?.location?.type === 'tableau' && 
                           gameState.selected?.location?.pile === pileIndex &&
                           gameState.selected?.location?.index === cardIndex}
                />
              </div>
            ))}
          </div>
        ) : (
          <div 
            className="pile-placeholder"
            onClick={() => handleEmptyTableauTap(pileIndex)}
          >
            K
          </div>
        )}
      </div>
    ));
  }, [gameState.tableau, gameState.selected, handleCardTap, handleEmptyTableauTap]);

  return (
    <div className="solitaire-game">
      <style>{`
        .solitaire-game {
          width: 100vw;
          min-height: 100vh;
          background: linear-gradient(135deg, #0f5132 0%, #198754 50%, #20c997 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          overflow-x: hidden;
          position: relative;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2vw 3vw;
          background: rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
        }

        .game-title {
          font-size: 5vw;
          font-weight: bold;
          color: white;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .game-stats {
          display: flex;
          gap: 4vw;
          align-items: center;
        }

        .stat {
          color: white;
          font-size: 3.5vw;
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .game-controls {
          display: flex;
          gap: 2vw;
        }

        .control-btn {
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 2vw;
          color: white;
          font-size: 3vw;
          font-weight: 600;
          padding: 2vw 4vw;
          min-width: 44px;
          min-height: 44px;
          cursor: pointer;
          transition: all 0.2s ease;
          backdrop-filter: blur(5px);
        }

        .control-btn:active {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.3);
        }

        .control-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .game-board {
          padding: 2vw;
          display: grid;
          grid-template-rows: auto auto 1fr;
          gap: 3vw;
          min-height: calc(100vh - 15vw);
        }

        .top-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 2vw;
          justify-items: center;
        }

        .stock-waste {
          grid-column: 1 / 3;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2vw;
        }

        .foundations {
          grid-column: 3 / 5;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2vw;
        }

        .tableau {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1vw;
          align-items: start;
        }

        .pile {
          min-height: 20vw;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .pile-placeholder {
          width: 12vw;
          height: 16vw;
          border: 2px dashed rgba(255, 255, 255, 0.3);
          border-radius: 1.5vw;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 2.5vw;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 44px;
          min-height: 44px;
        }

        .pile-placeholder:active {
          border-color: rgba(255, 255, 255, 0.6);
          background: rgba(255, 255, 255, 0.1);
        }

        .tableau-pile {
          position: relative;
          min-height: 50vw;
        }

        .tableau-cards {
          position: relative;
          width: 12vw;
        }

        .card {
          width: 12vw;
          height: 16vw;
          border-radius: 1.5vw;
          border: 1px solid #ccc;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-weight: bold;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          min-width: 44px;
          min-height: 58px;
        }

        .card:active {
          transform: scale(0.95);
        }

        .card.selected {
          border: 3px solid #ffd700;
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
          z-index: 100;
        }

        .card-back {
          background: linear-gradient(135deg, #1e3a8a, #3730a3);
          border-color: #1e40af;
        }

        .card-pattern {
          width: 100%;
          height: 100%;
          background-image: 
            repeating-linear-gradient(45deg, 
              rgba(255,255,255,0.1) 0px, 
              rgba(255,255,255,0.1) 2px, 
              transparent 2px, 
              transparent 4px);
          border-radius: inherit;
        }

        .card-face.red {
          color: #dc2626;
        }

        .card-face.black {
          color: #1f2937;
        }

        .card-corner {
          font-size: 2.5vw;
          line-height: 1;
          padding: 1vw;
        }

        .card-corner.top-left {
          align-self: flex-start;
        }

        .card-corner.bottom-right {
          align-self: flex-end;
          transform: rotate(180deg);
        }

        .card-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .suit-large {
          font-size: 4vw;
        }

        .win-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .win-message {
          background: white;
          padding: 8vw;
          border-radius: 4vw;
          text-align: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          max-width: 80vw;
        }

        .win-title {
          font-size: 8vw;
          color: #198754;
          margin-bottom: 4vw;
          font-weight: bold;
        }

        .win-stats {
          font-size: 4vw;
          color: #666;
          margin-bottom: 6vw;
        }

        .win-button {
          background: #198754;
          color: white;
          border: none;
          border-radius: 2vw;
          padding: 3vw 6vw;
          font-size: 4vw;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .win-button:active {
          transform: scale(0.95);
          background: #157347;
        }

        /* Desktop optimizations */
        @media (min-width: 768px) {
          .game-title {
            font-size: 24px;
          }
          
          .stat {
            font-size: 16px;
          }
          
          .control-btn {
            font-size: 14px;
            padding: 8px 16px;
            border-radius: 8px;
          }
          
          .tableau-pile {
            min-height: 400px;
          }
          
          .tableau-cards {
            width: 80px;
          }
          
          .tableau-card-wrapper {
            top: calc(var(--card-index) * 20px) !important;
            width: 80px !important;
          }
          
          .card {
            width: 80px;
            height: 112px;
            border-radius: 8px;
          }
          
          .card-corner {
            font-size: 12px;
            padding: 4px;
          }
          
          .suit-large {
            font-size: 24px;
          }
          
          .pile-placeholder {
            width: 80px;
            height: 112px;
            border-radius: 8px;
            font-size: 14px;
          }
          
          .win-title {
            font-size: 32px;
          }
          
          .win-stats {
            font-size: 18px;
          }
          
          .win-button {
            font-size: 16px;
            padding: 12px 24px;
            border-radius: 8px;
          }
        }
      `}</style>

      <div className="game-header">
        <div className="game-title">Klondike</div>
        <div className="game-stats">
          <div className="stat">Moves: {gameState.moves}</div>
        </div>
        <div className="game-controls">
          <button 
            className="control-btn"
            onClick={undoMove}
            disabled={moveHistory.length === 0}
          >
            Undo
          </button>
          <button className="control-btn" onClick={newGame}>
            New Game
          </button>
        </div>
      </div>

      <div className="game-board">
        <div className="top-row">
          <div className="stock-waste">
            <div className="pile">
              {gameState.stock.length > 0 ? (
                <Card 
                  card={gameState.stock[gameState.stock.length - 1]}
                  onClick={() => handleCardTap('stock')}
                />
              ) : (
                <div 
                  className="pile-placeholder"
                  onClick={() => handleCardTap('stock')}
                >
                  ↻
                </div>
              )}
            </div>
            <div className="pile">
              {gameState.waste.length > 0 ? (
                <Card 
                  card={gameState.waste[gameState.waste.length - 1]}
                  onClick={() => handleCardTap('waste')}
                  selected={gameState.selected?.location?.type === 'waste'}
                />
              ) : (
                <div className="pile-placeholder"></div>
              )}
            </div>
          </div>
          
          <div className="foundations">
            {gameState.foundations.map((foundation, index) => (
              <div key={index} className="pile">
                {foundation.length > 0 ? (
                  <Card 
                    card={foundation[foundation.length - 1]}
                    onClick={() => handleCardTap('foundation', index)}
                    selected={gameState.selected?.location?.type === 'foundation' && 
                             gameState.selected?.location?.pile === index}
                  />
                ) : (
                  <div 
                    className="pile-placeholder"
                    onClick={() => handleCardTap('foundation', index)}
                  >
                    A
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="tableau">
          {tableauPiles}
        </div>
      </div>

      {gameState.gameWon && (
        <div className="win-overlay">
          <div className="win-message">
            <div className="win-title">🎉 You Win! 🎉</div>
            <div className="win-stats">
              Completed in {gameState.moves} moves
            </div>
            <button className="win-button" onClick={newGame}>
              New Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileKlondikeSolitaire;