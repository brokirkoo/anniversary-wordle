const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

export default function Keyboard({ keyStates, onKey }) {
  return (
    <div className="keyboard" aria-label="On-screen keyboard">
      {ROWS.map((row, rowIdx) => (
        <div key={rowIdx} className="keyboard-row">
          {row.map((key) => {
            const isWide = key === 'ENTER' || key === '⌫';
            const state = keyStates[key];
            return (
              <button
                key={key}
                className={['key', isWide ? 'key-wide' : '', state ?? ''].filter(Boolean).join(' ')}
                onClick={() => onKey(key)}
                aria-label={key === '⌫' ? 'Backspace' : key}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}