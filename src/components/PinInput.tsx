import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

const LENGTH = 6;

export function PinInput({
  onComplete,
  autoFocus = true,
  disabled = false,
}: {
  onComplete: (pin: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function handleChange(i: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit && i < LENGTH - 1) {
      refs.current[i + 1]?.focus();
    }
    if (next.every((d) => d !== '')) {
      onComplete(next.join(''));
    }
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = Array(LENGTH).fill('');
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    refs.current[Math.min(text.length, LENGTH - 1)]?.focus();
    if (text.length === LENGTH) onComplete(text);
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={() => setFocusedIndex(i)}
          onBlur={() => setFocusedIndex((cur) => (cur === i ? null : cur))}
          className="w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-semibold rounded-lg outline-none transition-colors appearance-none"
          style={{
            border: `1px solid ${focusedIndex === i ? 'var(--text-primary)' : 'var(--border)'}`,
            background: 'var(--surface-2)',
            color: 'var(--text-primary)',
            WebkitAppearance: 'none',
          }}
        />
      ))}
    </div>
  );
}
