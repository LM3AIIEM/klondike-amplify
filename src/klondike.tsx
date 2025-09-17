import { useState, useEffect, useCallback, useRef } from 'react';

// Card suits and values
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_COLORS = { '♠': 'black', '♣': 'black', '♥': 'red', '♦': 'red' };

// Create a deck of cards
const createDeck = () => {
  const deck = [];
  SUITS.forEach(suit => {
    VALUES.forEach(value => {
      deck.push({
        suit,
        value,
        color: SUIT_COLORS[suit],
        id: `${suit}-${value}`,
        faceUp: false
      });
    });
  });
  return deck;
};

// Shuffle array (immutable)
const shuffle = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Deep clone game state
const cloneGameState = (state) => {
  return {
    stock: state.stock.map(card => ({ ...card })),
    waste: state.waste.map(card => ({ ...card })),
    foundations: state.foundations.map(foundation => foundation.map(card => ({ ...card }))),
    tableau: state.tableau.map(column => column.map(card => ({ ...card }))),
    gameWon: state.gameWon,
    moves: state.moves,
    autoSolving: state.autoSolving || false,
    showWaterfall: state.showWaterfall || false
  };
};

// Card component with cleaner drag handling
const Card = ({ card, onClick, onDoubleClick, isDraggable, style, className = "" }) => {
  const dragStartHandler = useCallback((e) => {
    if (!isDraggable || !card.faceUp) {
      e.preventDefault();
      return false;
    }
    
    // Clear any existing drag data
    e.dataTransfer.clearData();
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // Add visual feedback
    e.dataTransfer.setDragImage(e.target, 32, 48);
  }, [isDraggable, card.faceUp, card.id]);

  const cardContent = card.faceUp ? (
    <div className={`w-full h-full flex flex-col justify-between p-1 text-xs font-bold select-none pointer-events-none ${card.color === 'red' ? 'text-red-600' : 'text-black'}`}>
      <div className="flex justify-between">
        <span>{card.value}</span>
        <span>{card.suit}</span>
      </div>
      <div className="text-center text-2xl">
        {card.suit}
      </div>
      <div className="flex justify-between rotate-180">
        <span>{card.value}</span>
        <span>{card.suit}</span>
      </div>
    </div>
  ) : (
    <div className="w-full h-full bg-gradient-to-br from-blue-800 to-blue-900 flex items-center justify-center select-none">
      <div className="text-white opacity-50 text-xs pointer-events-none">🂠</div>
    </div>
  );

  return (
    <div
      className={`w-16 h-24 bg-white border border-gray-400 rounded-lg shadow-md transition-shadow ${
        isDraggable && card.faceUp ? 'cursor-grab active:cursor-grabbing hover:shadow-lg' : 'cursor-default'
      } ${className}`}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable={isDraggable && card.faceUp}
      onDragStart={dragStartHandler}
      onDragEnd={(e) => {
        e.dataTransfer.clearData();
      }}
    >
      {cardContent}
    </div>
  );
};

// Drop zone component with better event handling
const DropZone = ({ onDrop, children, className = "", canDrop = true, style = {} }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const dragOverHandler = useCallback((e) => {
    if (!canDrop) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, [canDrop]);

  const dragLeaveHandler = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const dropHandler = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (!canDrop) return;
    
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId && onDrop) {
      onDrop(cardId);
    }
    
    // Clear drag data
    e.dataTransfer.clearData();
  }, [canDrop, onDrop]);

  const dragEnterHandler = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div
      className={`${className} ${isDragOver && canDrop ? 'bg-green-100 border-green-400' : ''}`}
      style={style}
      onDragOver={dragOverHandler}
      onDragEnter={dragEnterHandler}
      onDragLeave={dragLeaveHandler}
      onDrop={dropHandler}
    >
      {children}
    </div>
  );
};

const SolitaireGame = () => {
  const [gameState, setGameState] = useState({
    stock: [],
    waste: [],
    foundations: [[], [], [], []], 
    tableau: [[], [], [], [], [], [], []], 
    gameWon: false,
    moves: 0,
    autoSolving: false,
    showWaterfall: false
  });

  const [gameHistory, setGameHistory] = useState([]);
  const [waterfallCards, setWaterfallCards] = useState([]);
  const autoSolveIntervalRef = useRef(null);
  const waterfallIntervalRef = useRef(null);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (autoSolveIntervalRef.current) {
        clearInterval(autoSolveIntervalRef.current);
      }
      if (waterfallIntervalRef.current) {
        clearInterval(waterfallIntervalRef.current);
      }
    };
  }, []);

  // Initialize game
  const initializeGame = useCallback(() => {
    // Clear any running intervals
    if (autoSolveIntervalRef.current) {
      clearInterval(autoSolveIntervalRef.current);
      autoSolveIntervalRef.current = null;
    }
    if (waterfallIntervalRef.current) {
      clearInterval(waterfallIntervalRef.current);
      waterfallIntervalRef.current = null;
    }

    // Clear waterfall animation
    setWaterfallCards([]);

    const deck = shuffle(createDeck());
    const newGameState = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
      gameWon: false,
      moves: 0,
      autoSolving: false,
      showWaterfall: false
    };

    let cardIndex = 0;

    // Deal cards to tableau
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = { ...deck[cardIndex] };
        card.faceUp = row === col;
        newGameState.tableau[col].push(card);
        cardIndex++;
      }
    }

    // Remaining cards go to stock
    newGameState.stock = deck.slice(cardIndex).map(card => ({ ...card, faceUp: false }));

    setGameState(newGameState);
    setGameHistory([cloneGameState(newGameState)]);
  }, []);

  // Initialize game on mount
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Get card value as number for comparison
  const getCardValue = (card) => {
    if (card.value === 'A') return 1;
    if (card.value === 'J') return 11;
    if (card.value === 'Q') return 12;
    if (card.value === 'K') return 13;
    return parseInt(card.value);
  };

  // Check if card can be placed on foundation
  const canPlaceOnFoundation = (card, foundation) => {
    if (foundation.length === 0) {
      return card.value === 'A';
    }
    const topCard = foundation[foundation.length - 1];
    return card.suit === topCard.suit && getCardValue(card) === getCardValue(topCard) + 1;
  };

  // Check if card can be placed on tableau column
  const canPlaceOnTableau = (card, column) => {
    if (column.length === 0) {
      return card.value === 'K';
    }
    const topCard = column[column.length - 1];
    return card.color !== topCard.color && getCardValue(card) === getCardValue(topCard) - 1;
  };

  // Find card location in game state
  const findCard = (cardId, state) => {
    // Check waste
    if (state.waste.length > 0 && state.waste[state.waste.length - 1].id === cardId) {
      return { location: 'waste', index: state.waste.length - 1 };
    }

    // Check tableau
    for (let col = 0; col < 7; col++) {
      const cardIndex = state.tableau[col].findIndex(card => card.id === cardId);
      if (cardIndex !== -1) {
        return { location: 'tableau', column: col, index: cardIndex };
      }
    }

    return null;
  };

  // Check if game is won
  const checkWin = (state) => {
    return state.foundations.every(foundation => foundation.length === 13);
  };

  // Save state to history with size limit
  const saveStateToHistory = (newState) => {
    setGameHistory(prev => {
      const newHistory = [...prev, cloneGameState(newState)];
      // Limit history to last 50 moves to prevent memory issues
      return newHistory.slice(-50);
    });
  };

  // Undo last move
  const handleUndo = () => {
    if (gameHistory.length > 1 && !gameState.autoSolving) {
      const newHistory = [...gameHistory];
      newHistory.pop();
      const previousState = newHistory[newHistory.length - 1];
      setGameState(cloneGameState(previousState));
      setGameHistory(newHistory);
    }
  };

  // Check if auto-solve is possible
  const canAutoSolve = (state) => {
    if (state.stock.length > 0 || state.waste.length > 0) return false;
    
    for (let col of state.tableau) {
      for (let card of col) {
        if (!card.faceUp) return false;
      }
    }
    
    return true;
  };

  // Advanced algorithm to check if current state is actually winnable
  const isGameWinnable = (state) => {
    if (!canAutoSolve(state)) return false;
    
    // Create a simulation of the game state
    const simulateState = cloneGameState(state);
    let foundMove = true;
    let maxIterations = 200; // Prevent infinite loops
    
    while (foundMove && maxIterations > 0) {
      foundMove = false;
      maxIterations--;
      
      // Try to move any tableau card to foundations
      for (let col = 0; col < 7; col++) {
        const column = simulateState.tableau[col];
        if (column.length > 0) {
          const card = column[column.length - 1];
          
          for (let foundIndex = 0; foundIndex < 4; foundIndex++) {
            if (canPlaceOnFoundation(card, simulateState.foundations[foundIndex])) {
              column.pop();
              simulateState.foundations[foundIndex].push(card);
              foundMove = true;
              break;
            }
          }
          
          if (foundMove) break;
        }
      }
      
      // Check if won
      if (checkWin(simulateState)) {
        return true;
      }
    }
    
    // If we can't make any more moves but haven't won, check if it's because 
    // we need to move cards between tableau columns first
    return false;
  };

  // Instantly solve the game behind the scenes
  const instantSolve = (state) => {
    const solvedState = cloneGameState(state);
    let maxIterations = 200;
    
    while (maxIterations > 0) {
      let foundMove = false;
      maxIterations--;
      
      // Try to move any tableau card to foundations
      for (let col = 0; col < 7; col++) {
        const column = solvedState.tableau[col];
        if (column.length > 0) {
          const card = column[column.length - 1];
          
          for (let foundIndex = 0; foundIndex < 4; foundIndex++) {
            if (canPlaceOnFoundation(card, solvedState.foundations[foundIndex])) {
              column.pop();
              solvedState.foundations[foundIndex].push(card);
              foundMove = true;
              break;
            }
          }
          
          if (foundMove) break;
        }
      }
      
      if (checkWin(solvedState)) {
        break;
      }
      
      if (!foundMove) break;
    }
    
    return solvedState;
  };

  // Waterfall animation - improved to match reference
  const startWaterfallAnimation = () => {
    const cards = [];
    const centerX = window.innerWidth / 2;
    const startY = 100;
    
    // Create multiple streams of cards cascading outward
    gameState.foundations.forEach((foundation, foundationIndex) => {
      foundation.forEach((card, cardIndex) => {
        const streamOffset = (foundationIndex - 1.5) * 150; // Spread streams out
        const delay = cardIndex * 50; // Stagger cards in each stream
        
        setTimeout(() => {
          setWaterfallCards(prev => [...prev, {
            ...card,
            id: `waterfall-${card.id}-${foundationIndex}-${cardIndex}`,
            x: centerX + streamOffset + (Math.random() - 0.5) * 50,
            y: startY,
            velX: streamOffset * 0.01 + (Math.random() - 0.5) * 3,
            velY: Math.random() * 2 + 1,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 8,
            opacity: 1
          }]);
        }, delay);
      });
    });
    
    const animateWaterfall = () => {
      setWaterfallCards(prevCards => {
        const newCards = prevCards.map(card => ({
          ...card,
          x: card.x + card.velX,
          y: card.y + card.velY,
          velY: card.velY + 0.4, // Stronger gravity
          rotation: card.rotation + card.rotationSpeed,
          opacity: card.y > window.innerHeight * 0.7 ? Math.max(0, card.opacity - 0.02) : card.opacity
        })).filter(card => card.y < window.innerHeight + 100); // Keep cards slightly longer
        
        if (newCards.length === 0) {
          // Animation finished
          if (waterfallIntervalRef.current) {
            clearInterval(waterfallIntervalRef.current);
            waterfallIntervalRef.current = null;
          }
          setGameState(prev => ({ ...prev, showWaterfall: false }));
        }
        
        return newCards;
      });
    };
    
    // Clear any existing waterfall animation
    if (waterfallIntervalRef.current) {
      clearInterval(waterfallIntervalRef.current);
    }
    
    waterfallIntervalRef.current = setInterval(animateWaterfall, 16); // 60fps
  };

  // New auto-solve function with instant solving
  const autoSolve = () => {
    if (!isGameWinnable(gameState) || gameState.autoSolving) return;
    
    // Instantly solve the game behind the scenes
    const solvedState = instantSolve(gameState);
    const finalMoves = gameState.moves; // Freeze move counter
    
    setGameState(prev => ({ 
      ...prev, 
      autoSolving: true,
      moves: finalMoves // Freeze moves
    }));
    
    // Visual animation - just move cards to foundations one by one
    let currentState = cloneGameState(gameState);
    const moveSequence = [];
    
    // Calculate the move sequence by comparing current state to solved state
    while (!checkWin(currentState)) {
      let foundMove = false;
      
      for (let col = 0; col < 7 && !foundMove; col++) {
        const column = currentState.tableau[col];
        if (column.length > 0) {
          const card = column[column.length - 1];
          
          for (let foundIndex = 0; foundIndex < 4; foundIndex++) {
            if (canPlaceOnFoundation(card, currentState.foundations[foundIndex])) {
              moveSequence.push({ from: 'tableau', col, to: 'foundation', foundIndex });
              column.pop();
              currentState.foundations[foundIndex].push(card);
              foundMove = true;
              break;
            }
          }
        }
      }
      
      if (!foundMove) break;
    }
    
    // Execute visual moves
    let moveIndex = 0;
    const executeVisualMove = () => {
      if (moveIndex >= moveSequence.length) {
        // All moves done - start waterfall
        setGameState(prev => ({ 
          ...prev, 
          autoSolving: false, 
          gameWon: true, 
          showWaterfall: true 
        }));
        startWaterfallAnimation();
        
        if (autoSolveIntervalRef.current) {
          clearInterval(autoSolveIntervalRef.current);
          autoSolveIntervalRef.current = null;
        }
        return;
      }
      
      const move = moveSequence[moveIndex];
      
      setGameState(prevState => {
        const newState = cloneGameState(prevState);
        
        if (move.from === 'tableau') {
          const card = newState.tableau[move.col].pop();
          newState.foundations[move.to === 'foundation' ? move.foundIndex : 0].push(card);
        }
        
        return newState;
      });
      
      moveIndex++;
    };
    
    // Clear any existing interval
    if (autoSolveIntervalRef.current) {
      clearInterval(autoSolveIntervalRef.current);
    }
    
    // Start visual solving
    autoSolveIntervalRef.current = setInterval(executeVisualMove, 200);
  };

  // Handle stock click
  const handleStockClick = () => {
    if (gameState.autoSolving) return;
    
    setGameState(prevState => {
      const newState = cloneGameState(prevState);
      
      if (newState.stock.length === 0) {
        newState.stock = [...newState.waste].reverse().map(card => ({ ...card, faceUp: false }));
        newState.waste = [];
      } else {
        const card = newState.stock.pop();
        card.faceUp = true;
        newState.waste.push(card);
      }
      
      saveStateToHistory(newState);
      return newState;
    });
  };

  // Handle foundation drop
  const handleFoundationDrop = (foundationIndex, cardId) => {
    if (gameState.autoSolving) return;
    
    setGameState(prevState => {
      const newState = cloneGameState(prevState);
      const cardLocation = findCard(cardId, newState);
      
      if (!cardLocation) return prevState;

      let cardToMove;

      if (cardLocation.location === 'waste') {
        cardToMove = newState.waste[cardLocation.index];
        if (canPlaceOnFoundation(cardToMove, newState.foundations[foundationIndex])) {
          newState.waste.pop();
          newState.foundations[foundationIndex].push(cardToMove);
          newState.moves++;
        } else {
          return prevState;
        }
      } else if (cardLocation.location === 'tableau') {
        const column = newState.tableau[cardLocation.column];
        cardToMove = column[cardLocation.index];
        
        if (cardLocation.index === column.length - 1 && canPlaceOnFoundation(cardToMove, newState.foundations[foundationIndex])) {
          column.pop();
          newState.foundations[foundationIndex].push(cardToMove);
          
          if (column.length > 0 && !column[column.length - 1].faceUp) {
            column[column.length - 1].faceUp = true;
          }
          
          newState.moves++;
        } else {
          return prevState;
        }
      }

      newState.gameWon = checkWin(newState);
      saveStateToHistory(newState);
      return newState;
    });
  };

  // Handle tableau drop
  const handleTableauDrop = (columnIndex, cardId) => {
    if (gameState.autoSolving) return;
    
    setGameState(prevState => {
      const newState = cloneGameState(prevState);
      const cardLocation = findCard(cardId, newState);
      
      if (!cardLocation) return prevState;

      const targetColumn = newState.tableau[columnIndex];

      if (cardLocation.location === 'waste') {
        const cardToMove = newState.waste[cardLocation.index];
        if (canPlaceOnTableau(cardToMove, targetColumn)) {
          newState.waste.pop();
          targetColumn.push(cardToMove);
          newState.moves++;
        } else {
          return prevState;
        }
      } else if (cardLocation.location === 'tableau') {
        const sourceColumn = newState.tableau[cardLocation.column];
        const cardToMove = sourceColumn[cardLocation.index];
        
        if (canPlaceOnTableau(cardToMove, targetColumn)) {
          const cardsToMove = sourceColumn.splice(cardLocation.index);
          targetColumn.push(...cardsToMove);
          
          if (sourceColumn.length > 0 && !sourceColumn[sourceColumn.length - 1].faceUp) {
            sourceColumn[sourceColumn.length - 1].faceUp = true;
          }
          
          newState.moves++;
        } else {
          return prevState;
        }
      }

      newState.gameWon = checkWin(newState);
      saveStateToHistory(newState);
      return newState;
    });
  };

  // Handle double click to auto-move to foundation
  const handleDoubleClick = (card) => {
    if (gameState.autoSolving) return;
    
    for (let i = 0; i < 4; i++) {
      if (canPlaceOnFoundation(card, gameState.foundations[i])) {
        handleFoundationDrop(i, card.id);
        break;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-800 to-green-900 p-4 flex flex-col">
      <div className="max-w-6xl mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="text-white text-center mb-6">
          <h1 className="text-4xl font-bold mb-2">Klondike Solitaire</h1>
          <div className="flex justify-center items-center gap-6 text-lg">
            <span>Moves: {gameState.moves}</span>
            <button
              onClick={initializeGame}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              New Game
            </button>
            <button
              onClick={handleUndo}
              disabled={gameHistory.length <= 1 || gameState.autoSolving}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              Undo
            </button>
            <button
              onClick={autoSolve}
              disabled={!isGameWinnable(gameState) || gameState.autoSolving}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              {gameState.autoSolving ? 'Solving...' : 'Auto Solve'}
            </button>
            {gameState.gameWon && (
              <span className="text-yellow-400 font-bold text-xl animate-pulse">🎉 You Won! 🎉</span>
            )}
          </div>
        </div>

        {/* Game Board */}
        <div className="flex-1 flex flex-col space-y-6">
          {/* Top Row: Stock, Waste, and Foundations */}
          <div className="flex justify-between items-start px-8">
            {/* Stock and Waste */}
            <div className="flex gap-4">
              <div
                className="w-16 h-24 border-2 border-dashed border-white border-opacity-50 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white hover:bg-opacity-10 transition-colors"
                onClick={handleStockClick}
              >
                {gameState.stock.length > 0 ? (
                  <Card 
                    card={gameState.stock[gameState.stock.length - 1]} 
                    onClick={() => {}} 
                    onDoubleClick={() => {}} 
                    isDraggable={false} 
                    style={{}} 
                  />
                ) : (
                  <span className="text-white opacity-50 text-xs select-none">↻</span>
                )}
              </div>
              <div className="w-16 h-24">
                {gameState.waste.length > 0 ? (
                  <Card
                    card={gameState.waste[gameState.waste.length - 1]}
                    isDraggable={!gameState.autoSolving}
                    onClick={() => {}}
                    onDoubleClick={() => handleDoubleClick(gameState.waste[gameState.waste.length - 1])}
                    style={{}}
                  />
                ) : (
                  <div className="w-16 h-24 border-2 border-dashed border-white border-opacity-30 rounded-lg"></div>
                )}
              </div>
            </div>

            {/* Foundations */}
            <div className="flex gap-4">
              {gameState.foundations.map((foundation, index) => (
                <DropZone
                  key={index}
                  onDrop={(cardId) => handleFoundationDrop(index, cardId)}
                  className="w-16 h-24 border-2 border-dashed border-white border-opacity-50 rounded-lg flex items-center justify-center"
                  canDrop={!gameState.autoSolving}
                >
                  {foundation.length > 0 ? (
                    <Card 
                      card={foundation[foundation.length - 1]} 
                      onClick={() => {}} 
                      onDoubleClick={() => {}} 
                      isDraggable={false} 
                      style={{}} 
                    />
                  ) : (
                    <span className="text-white opacity-30 text-2xl select-none">
                      {['♠', '♥', '♦', '♣'][index]}
                    </span>
                  )}
                </DropZone>
              ))}
            </div>
          </div>

          {/* Tableau */}
          <div className="flex justify-center gap-4 items-start flex-1">
            {gameState.tableau.map((column, colIndex) => (
              <DropZone
                key={colIndex}
                onDrop={(cardId) => handleTableauDrop(colIndex, cardId)}
                className="relative w-16"
                style={{ minHeight: `${Math.max(96, 96 + (column.length - 1) * 20)}px` }}
                canDrop={!gameState.autoSolving}
              >
                {column.length === 0 ? (
                  <div className="absolute top-0 left-0 w-16 h-24 border-2 border-dashed border-white border-opacity-30 rounded-lg flex items-center justify-center">
                    <span className="text-white opacity-30 text-lg select-none">K</span>
                  </div>
                ) : (
                  column.map((card, cardIndex) => (
                    <Card
                      key={card.id}
                      card={card}
                      isDraggable={card.faceUp && !gameState.autoSolving}
                      onClick={() => {}}
                      style={{
                        position: 'absolute',
                        top: `${cardIndex * 20}px`,
                        zIndex: cardIndex,
                        left: 0
                      }}
                      onDoubleClick={() => card.faceUp && !gameState.autoSolving && handleDoubleClick(card)}
                    />
                  ))
                )}
              </DropZone>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="text-white text-center py-8 text-sm opacity-80">
          <p>Click the deck to draw cards • Drag cards to move them • Double-click to auto-move to foundations</p>
          <p>Build foundations from Ace to King by suit • Build tableau columns in descending order, alternating colors</p>
        </div>
        
        {/* Waterfall Animation */}
        {gameState.showWaterfall && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {waterfallCards.map(card => (
              <div
                key={card.id}
                className="absolute w-16 h-24 bg-white border border-gray-400 rounded-lg shadow-lg"
                style={{
                  left: `${card.x}px`,
                  top: `${card.y}px`,
                  transform: `rotate(${card.rotation}deg)`,
                  opacity: card.opacity,
                  zIndex: 1000
                }}
              >
                <div className={`w-full h-full flex flex-col justify-between p-1 text-xs font-bold select-none pointer-events-none ${card.color === 'red' ? 'text-red-600' : 'text-black'}`}>
                  <div className="flex justify-between">
                    <span>{card.value}</span>
                    <span>{card.suit}</span>
                  </div>
                  <div className="text-center text-2xl">
                    {card.suit}
                  </div>
                  <div className="flex justify-between rotate-180">
                    <span>{card.value}</span>
                    <span>{card.suit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        

      </div>
    </div>
  );
};

export default SolitaireGame;