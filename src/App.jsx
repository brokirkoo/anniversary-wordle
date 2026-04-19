import { useState, useEffect, useCallback, useMemo } from 'react';
import { getWordOfDay, getTodayString } from './useWordOfDay';
import { useFirebaseSync } from './useFirebaseSync';
import { isValidWord } from './wordList';
import Keyboard from './Keyboard';
import './App.css';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

// Only colour keys for rows that have already been revealed.
function getKeyStates(guesses, revealedTurns, answer) {
  const states = {};
  if (!answer) return states;
  const revealed = guesses.slice(0, revealedTurns);
  for (const guess of revealed) {
    for (let i = 0; i < guess.length; i++) {
      const letter  = guess[i];
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

function getTileClass(answer, rowState, letter, colIdx) {
  if (rowState !== 'submitted' || !letter) return '';
  if (answer[colIdx] === letter) return 'correct';
  if (answer.includes(letter))   return 'present';
  return 'absent';
}

/**
 * Builds the 6-row descriptor array for the grid.
 *
 * Row states:
 *   'submitted' — revealed, colours shown
 *   'pending'   — submitted to Firebase but waiting for partner, no colours yet
 *   'active'    — the row the player is currently typing into
 *   'empty'     — future row, blank
 */
function buildRows(guesses, revealedTurns, currentGuess, isWaiting, gameOver) {
  return Array.from({ length: MAX_GUESSES }, (_, rowIdx) => {
    if (rowIdx < guesses.length) {
      return {
        letters: guesses[rowIdx].split(''),
        state:   rowIdx < revealedTurns ? 'submitted' : 'pending',
      };
    }
    if (rowIdx === guesses.length && !gameOver && !isWaiting) {
      const letters = currentGuess.split('');
      while (letters.length < WORD_LENGTH) letters.push('');
      return { letters, state: 'active' };
    }
    return { letters: Array(WORD_LENGTH).fill(''), state: 'empty' };
  });
}

// Compact coloured-dot grid shown for the partner
function PartnerBoard({ name, data, answer }) {
  if (!data) {
    return (
      <div className="partner-board">
        <p className="partner-name">{name} hasn't started yet</p>
      </div>
    );
  }

  const { guesses, revealedTurns, status } = data;
  const lastGuess = guesses[guesses.length - 1];

  return (
    <div className="partner-board">
      <p className="partner-name">
        {name}
        {status === 'finished' && (lastGuess === answer ? ' ✓' : ' ✗')}
        {status === 'ready'    && ' ⏳'}
      </p>
      <div className="partner-grid">
        {Array.from({ length: MAX_GUESSES }, (_, rowIdx) => {
          const submitted = rowIdx < guesses.length;
          const revealed  = rowIdx < revealedTurns;
          const letters   = submitted ? guesses[rowIdx].split('') : Array(WORD_LENGTH).fill('');
          return (
            <div key={rowIdx} className="partner-row">
              {letters.map((letter, colIdx) => (
                <div
                  key={colIdx}
                  className={[
                    'partner-tile',
                    submitted && revealed  ? getTileClass(answer, 'submitted', letter, colIdx) : '',
                    submitted && !revealed ? 'pending' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// "X/6" if won, "X/6" with X=guesses.length if lost too (Wordle convention)
function resultStr(data, answer) {
  if (!data || data.guesses.length === 0) return '?';
  const won = data.guesses[data.guesses.length - 1] === answer;
  return won ? `${data.guesses.length}/6` : 'X/6';
}

export default function App() {
  const answer   = getWordOfDay();
  const todayStr = getTodayString();

  const { user, partner, myData, partnerData, pushGuess, pushReveal, syncReady } =
    useFirebaseSync();

  // currentGuess is purely local — only this player types it
  const [currentGuess,  setCurrentGuess]  = useState('');
  const [copied,        setCopied]        = useState(false);
  const [invalidGuess,  setInvalidGuess]  = useState(false);

  // Fallback state for the no-?user= local-only mode
  const [localGuesses,  setLocalGuesses]  = useState([]);
  const [localGameOver, setLocalGameOver] = useState(false);

  // ── Derived state ────────────────────────────────────────────────────────────
  const guesses       = user ? myData.guesses       : localGuesses;
  const revealedTurns = user ? myData.revealedTurns : localGuesses.length;

  const isWaiting = user ? myData.status === 'ready' : false;

  const gameOver = user
    ? myData.status === 'finished' && myData.revealedTurns >= myData.guesses.length
    : localGameOver;

  const inputBlocked = isWaiting || gameOver || invalidGuess;

  const partnerName = partner
    ? partner.charAt(0).toUpperCase() + partner.slice(1)
    : '';

  // Show lobby only in Firebase mode, after sync, while partner hasn't joined today
  const showLobby = !!user && syncReady && partnerData === null;

  // Share button: only once both players are done
  const bothFinished = gameOver && partnerData?.status === 'finished';

  // ── Reveal effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !syncReady) return;

    const mySubmitted     = myData.guesses.length;
    const partnerFinished = partnerData?.status === 'finished';
    const partnerCaughtUp = (partnerData?.guesses.length ?? 0) >= mySubmitted;

    const shouldReveal =
      mySubmitted > myData.revealedTurns
      && myData.status === 'ready'
      && (partnerFinished || partnerCaughtUp);

    if (!shouldReveal) return;

    const lastGuess = myData.guesses[mySubmitted - 1];
    const isOver    = lastGuess === answer || mySubmitted === MAX_GUESSES;
    pushReveal(mySubmitted, isOver);
  }, [myData, partnerData, user, syncReady, answer, pushReveal]);

  // ── Guess submission ─────────────────────────────────────────────────────────
  const submitGuess = useCallback(() => {
    if (currentGuess.length !== WORD_LENGTH || inputBlocked) return;

    if (!isValidWord(currentGuess)) {
      setInvalidGuess(true);
      setTimeout(() => {
        setInvalidGuess(false);
        setCurrentGuess('');
      }, 600);
      return;
    }

    const newGuesses = [...guesses, currentGuess];

    if (user) {
      pushGuess(newGuesses);
    } else {
      const isOver = currentGuess === answer || newGuesses.length === MAX_GUESSES;
      setLocalGuesses(newGuesses);
      if (isOver) setLocalGameOver(true);
    }
    setCurrentGuess('');
  }, [currentGuess, guesses, answer, inputBlocked, user, pushGuess]);

  const handleKey = useCallback(
    (key) => {
      if (inputBlocked) return;
      if (key === 'ENTER') {
        submitGuess();
      } else if (key === '⌫' || key === 'BACKSPACE') {
        setCurrentGuess((g) => g.slice(0, -1));
      } else if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((g) => g + key);
      }
    },
    [inputBlocked, currentGuess, submitGuess],
  );

  useEffect(() => {
    const onKeyDown = (e) => handleKey(e.key.toUpperCase());
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  // ── Share ────────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    const jamesData = user === 'james' ? myData : partnerData;
    const emilyData = user === 'emily' ? myData : partnerData;
    const text =
      `James & Emily Wordle ${todayStr}\n` +
      `James: ${resultStr(jamesData, answer)} · Emily: ${resultStr(emilyData, answer)} ❤️`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — fall back to prompt
      window.prompt('Copy this:', text);
    }
  }, [user, myData, partnerData, todayStr, answer]);

  // ── Rendering ────────────────────────────────────────────────────────────────
  const keyStates = useMemo(
    () => getKeyStates(guesses, revealedTurns, answer),
    [guesses, revealedTurns, answer],
  );

  const rows = buildRows(guesses, revealedTurns, currentGuess, isWaiting, gameOver);
  const won  = guesses[guesses.length - 1] === answer;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!syncReady) {
    return (
      <div className="app">
        <header className="app-header"><h1>Wordle</h1></header>
        <p className="message">Loading…</p>
      </div>
    );
  }

  // ── Lobby ────────────────────────────────────────────────────────────────────
  if (showLobby) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Wordle</h1>
          <p className="subtitle">{todayStr}</p>
        </header>
        <div className="lobby">
          <div className="lobby-dots">
            <span /><span /><span />
          </div>
          <p className="lobby-message">
            Waiting for {partnerName} to join the game…
          </p>
          <p className="lobby-hint">
            Send them their link to get started!
          </p>
        </div>
      </div>
    );
  }

  // ── Game ─────────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <h1>Wordle</h1>
        <p className="subtitle">
          {todayStr}
          {user && ` · ${user.charAt(0).toUpperCase() + user.slice(1)}`}
        </p>
      </header>

      {!answer && (
        <p className="message error">
          No word found for {todayStr}. Add it to words.json!
        </p>
      )}

      <div className="board-area">
        {invalidGuess && <p className="message invalid">Not in word list.</p>}

        {gameOver && (
          <p className="message">
            {won
              ? `Nice! The word was ${answer}.`
              : `Game over — the word was ${answer}.`}
          </p>
        )}

        <div className="grid-wrapper">
          <div className="grid">
            {rows.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className={[
                  'row',
                  row.state === 'active' && invalidGuess ? 'shake' : '',
                ].filter(Boolean).join(' ')}
              >
                {row.letters.map((letter, colIdx) => (
                  <div
                    key={colIdx}
                    className={[
                      'tile',
                      getTileClass(answer, row.state, letter, colIdx),
                      row.state === 'active'  && letter ? 'filled'  : '',
                      row.state === 'pending'            ? 'pending' : '',
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

          {isWaiting && (
            <div className="waiting-overlay">
              <p>Waiting for {partnerName}…</p>
            </div>
          )}
        </div>

        {user && partner && (
          <PartnerBoard
            name={partnerName}
            data={partnerData}
            answer={answer}
          />
        )}

        {bothFinished && (
          <button className="share-btn" onClick={handleShare}>
            {copied ? 'Copied!' : 'Share result'}
          </button>
        )}
      </div>

      <Keyboard keyStates={keyStates} onKey={handleKey} />
    </div>
  );
}