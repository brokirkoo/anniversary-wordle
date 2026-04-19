import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, set, update, get } from 'firebase/database';
import { db } from './firebase';
import { getTodayString } from './useWordOfDay';

function parseUser() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('user')?.toLowerCase();
  if (raw === 'james' || raw === 'emily') return raw;
  return null;
}

// Firebase may return arrays as objects with numeric keys — normalise either form.
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.values(val);
}

const INITIAL_STATE = {
  currentTurn:   1,
  status:        'typing',   // 'typing' | 'ready' | 'finished'
  guesses:       [],
  revealedTurns: 0,
};

function normalise(d) {
  return {
    currentTurn:   d.currentTurn   ?? 1,
    status:        d.status        ?? 'typing',
    guesses:       toArray(d.guesses),
    revealedTurns: d.revealedTurns ?? 0,
  };
}

export function useFirebaseSync() {
  const todayStr = getTodayString();
  const user     = parseUser();
  const partner  = user === 'james' ? 'emily' : user === 'emily' ? 'james' : null;

  // Track each subscription's first snapshot separately so the lobby only
  // appears after we've confirmed whether the partner node exists or not.
  const [meSynced,      setMeSynced]      = useState(false);
  const [partnerSynced, setPartnerSynced] = useState(!user); // true immediately in local mode

  const [myData,      setMyData]      = useState(INITIAL_STATE);
  const [partnerData, setPartnerData] = useState(null);

  // syncReady: true once we have the first snapshot from every subscription
  const syncReady = !user || (meSynced && partnerSynced);

  useEffect(() => {
    if (!user) return;

    const myRef = ref(db, `games/${todayStr}/${user}`);

    // Seed the node on first visit today
    get(myRef).then((snap) => {
      if (!snap.exists()) set(myRef, INITIAL_STATE);
    });

    const unsubMe = onValue(myRef, (snap) => {
      if (snap.exists()) setMyData(normalise(snap.val()));
      setMeSynced(true);
    });

    let unsubPartner = () => {};
    if (partner) {
      unsubPartner = onValue(ref(db, `games/${todayStr}/${partner}`), (snap) => {
        setPartnerData(snap.exists() ? normalise(snap.val()) : null);
        setPartnerSynced(true);
      });
    } else {
      setPartnerSynced(true);
    }

    return () => { unsubMe(); unsubPartner(); };
  }, [user, partner, todayStr]);

  /**
   * Called immediately when the player presses Enter on a valid word.
   * Commits the guess and marks this player as 'ready'.
   */
  const pushGuess = useCallback(
    (newGuesses) => {
      if (!user) return;
      update(ref(db, `games/${todayStr}/${user}`), {
        guesses:     newGuesses,
        currentTurn: Math.min(newGuesses.length + 1, 6),
        status:      'ready',
      });
    },
    [user, todayStr],
  );

  /**
   * Called by the reveal effect once both players are ready for this turn.
   * Advances revealedTurns and resets status to 'typing' (or 'finished').
   */
  const pushReveal = useCallback(
    (newRevealedTurns, isGameOver) => {
      if (!user) return;
      update(ref(db, `games/${todayStr}/${user}`), {
        revealedTurns: newRevealedTurns,
        status:        isGameOver ? 'finished' : 'typing',
      });
    },
    [user, todayStr],
  );

  return { user, partner, myData, partnerData, pushGuess, pushReveal, syncReady };
}