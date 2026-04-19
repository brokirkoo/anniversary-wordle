import { useState, useEffect, useCallback, useMemo } from 'react';
import { getWordOfDay, getTodayString } from './useWordOfDay';
import Keyboard from './Keyboard';
import './App.css';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

function getKeyStates(guesses, answer) {
  const states = {};
  if (!answer) return states;
  for (const guess of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const current = states[letter];
      if (answer[i] === letter) {
        states[letter] = 'correct';
      } else if (answer.includes(letter) && current !== 'correct') {
        states[letter] = 'present';
      } else if (!current) {
        states[letter] = 'absent';
      }
    }
  }
  return states;
}

export default function App() {
  const answer = getWordOfDay();
  const todayStr = getTodayString();

  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameOver, setGameOver] = useState(false);

  const submitGuess = useCallback(() => {
    if (currentGuess.length !== WORD_LENGTH) return;

    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);
    setCurrentGuess('');

    if (currentGuess === answer || newGuesses.length === MAX_GUESSES) {
      setGameOver(true);
    }
  }, [currentGuess, guesses, answer]);

  const handleKey = useCallback((key) => {
    if (gameOver) return;
    if (key === 'ENTER') {
      submitGuess();
    } else if (key === '⌫' || key === 'BACKSPACE') {
      setCurrentGuess((g) => g.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
      setCurrentGuess((g) => g + key);
    }
  }, [gameOver, currentGuess, submitGuess]);

  useEffect(() => {
    const handleKeyDown = (e) => handleKey(e.key.toUpperCase());
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKey]);

  const keyStates = useMemo(() => getKeyStates(guesses, answer), [guesses, answer]);

  const rows = Array.from({ length: MAX_GUESSES }, (_, rowIdx) => {
    if (rowIdx < guesses.length) {
      return { letters: guesses[rowIdx].split(''), state: 'submitted' };
    }
    if (rowIdx === guesses.length && !gameOver) {
      const letters = currentGuess.split('');
      while (letters.length < WORD_LENGTH) letters.push('');
      return { letters, state: 'active' };
    }
    return { letters: Array(WORD_LENGTH).fill(''), state: 'empty' };
  });

  function getTileClass(rowState, letter, colIdx) {
    if (rowState !== 'submitted' || !letter) return '';
    if (answer[colIdx] === letter) return 'correct';
    if (answer.includes(letter)) return 'present';
    return 'absent';
  }

  const won = guesses[guesses.length - 1] === answer;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Wordle</h1>
        <p className="subtitle">{todayStr}</p>
      </header>

      {!answer && (
        <p className="message error">
          No word found for {todayStr}. Add it to words.json!
        </p>
      )}

      <div className="board-area">
        {gameOver && (
          <p className="message">
            {won
              ? `Nice! The word was ${answer}.`
              : `Game over — the word was ${answer}.`}
          </p>
        )}

        <div className="grid">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="row">
              {row.letters.map((letter, colIdx) => (
                <div
                  key={colIdx}
                  className={[
                    'tile',
                    getTileClass(row.state, letter, colIdx),
                    row.state === 'active' && letter ? 'filled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {letter}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Keyboard keyStates={keyStates} onKey={handleKey} />
    </div>
  );
}