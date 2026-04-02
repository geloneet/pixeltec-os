'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface OTPInputProps {
  value:    string;
  onChange: (val: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}

export default function OTPInput({ value, onChange, disabled, hasError }: OTPInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  const handleChange = (index: number, char: string) => {
    const clean = char.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    onChange(next.join('').replace(/\s/g, ''));
    if (clean && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        onChange(next.join('').trimEnd());
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      refs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          disabled={disabled}
          autoComplete="one-time-code"
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onClick={() => refs.current[i]?.select()}
          className={cn(
            'w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-xl border-2',
            'bg-white/5 text-white transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-cyan-500/50',
            hasError
              ? 'border-red-500/70 bg-red-500/10 text-red-300 animate-shake'
              : digits[i]
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-white/15 hover:border-white/30',
            disabled && 'opacity-40 cursor-not-allowed',
          )}
        />
      ))}
    </div>
  );
}
