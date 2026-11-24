import React, { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from 'react';

export interface AmountInputProps {
  value?: number | null | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  required?: boolean;
  id?: string;
  name?: string;
  allowDecimals?: boolean;
  prefix?: string;
  onBlur?: () => void;
  'aria-label'?: string;
}

/** Formats a numeric string with commas after every 3 digits. */
export function formatAmountWithCommas(raw: string, allowDecimals = true): string {
  if (!raw) return '';
  // Remove all non-digit and non-decimal characters
  let clean = raw.replace(/[^\d.]/g, '');
  if (!allowDecimals) {
    clean = clean.replace(/\./g, '');
  }

  // Handle multiple dots (keep only the first)
  const parts = clean.split('.');
  const integerPart = parts[0] || '';
  const decimalPart = parts.length > 1 ? '.' + parts.slice(1).join('') : '';

  // Format integer with commas
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return formattedInteger + decimalPart;
}

/** Strips commas and parses clean float. */
export function parseAmountToNumber(formatted: string): number | undefined {
  if (!formatted) return undefined;
  const clean = formatted.replace(/,/g, '').trim();
  if (!clean || clean === '.') return undefined;
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : undefined;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  placeholder = 'Enter amount',
  className = '',
  disabled = false,
  min,
  max,
  required = false,
  id,
  name,
  allowDecimals = true,
  prefix,
  onBlur,
  'aria-label': ariaLabel,
}) => {
  // Format initial display value. If value is 0 and was explicitly passed, display "0" only if not required to be empty initially.
  // Per requirement: Fields where users are expected to enter an amount must start empty with placeholder, not with prefilled zero.
  const formatInitial = (val: number | null | undefined): string => {
    if (val === undefined || val === null || Number.isNaN(val)) return '';
    // Format existing non-zero values with commas
    if (val === 0) return ''; // Start empty instead of prefilled zero
    return formatAmountWithCommas(val.toString(), allowDecimals);
  };

  const [displayValue, setDisplayValue] = useState<string>(() => formatInitial(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize when value changes externally (e.g. record loaded or reset)
  useEffect(() => {
    if (value === undefined || value === null || Number.isNaN(value) || value === 0) {
      if (displayValue && parseAmountToNumber(displayValue) !== value) {
        setDisplayValue('');
      }
    } else {
      const currentParsed = parseAmountToNumber(displayValue);
      if (currentParsed !== value) {
        setDisplayValue(formatAmountWithCommas(value.toString(), allowDecimals));
      }
    }
  }, [value, allowDecimals]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawVal = input.value;
    const cursor = input.selectionStart || 0;

    // Count how many non-comma characters are before the cursor
    const rawBeforeCursor = rawVal.slice(0, cursor);
    const nonCommasBefore = rawBeforeCursor.replace(/,/g, '').length;

    // Format new text
    const formatted = formatAmountWithCommas(rawVal, allowDecimals);
    setDisplayValue(formatted);

    // Emit raw number to parent
    const parsed = parseAmountToNumber(formatted);
    onChange(parsed);

    // Restore cursor position accurately
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      let newPos = 0;
      let nonCommasCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ',') {
          nonCommasCount++;
        }
        if (nonCommasCount === nonCommasBefore) {
          newPos = i + 1;
          break;
        }
      }
      if (nonCommasBefore === 0) newPos = 0;
      if (newPos > formatted.length) newPos = formatted.length;
      inputRef.current.setSelectionRange(newPos, newPos);
    });
  };

  const handleBlur = () => {
    if (onBlur) onBlur();
  };

  return (
    <div className="relative flex items-center w-full">
      {prefix && (
        <span className="absolute left-2.5 text-xs font-bold text-slate-400 select-none pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        id={id}
        name={name}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-[#00205B] focus:outline-none focus:ring-1 focus:ring-[#00205B] disabled:bg-slate-100 disabled:text-slate-500 transition-colors ${
          prefix ? 'pl-11' : ''
        } ${className}`}
      />
    </div>
  );
};

