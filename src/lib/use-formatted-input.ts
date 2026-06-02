/**
 * useFormattedInput
 * ─────────────────
 * Two-mode formatted numeric input engine for React.
 *
 * Modes
 * ─────
 * "currency"  – always 2 decimal places; appends ".00" on blur for whole numbers.
 * "quantity"  – whole numbers by default; allows up to 2 decimals only when the
 *               user explicitly types a decimal point. No forced trailing zeros.
 *
 * Key guarantees
 * ──────────────
 * • Commas are injected as thousand-separators in real-time while typing.
 * • The cursor never jumps during formatting (managed via selectionStart delta).
 * • rawValue is always a clean unformatted number string ("1000.5") for DB writes.
 * • parseRaw() returns the numeric value ready for DB submission.
 */

import { useCallback, useRef, useState } from "react";

export type InputMode = "currency" | "quantity";

// ── Internal helpers ───────────────────────────────────────────────────────────

/** Strip every character that is not a digit or a decimal point. */
function stripFormatting(s: string): string {
  return s.replace(/[^0-9.]/g, "");
}

/**
 * Add thousand-separator commas to the integer part only, leaving the
 * decimal part untouched.
 */
function addCommas(intPart: string): string {
  // Walk right-to-left, insert a comma every 3 digits.
  let result = "";
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0) result += ",";
    result += intPart[i];
  }
  return result;
}

/**
 * Format a raw numeric string for display.
 *
 * @param raw        The clean string, e.g. "1000.50"
 * @param mode       "currency" | "quantity"
 * @param keepTrailing  Whether to preserve a trailing decimal / in-progress zeros.
 */
function formatDisplay(raw: string, mode: InputMode, keepTrailing = false): string {
  if (!raw && raw !== "0") return "";

  // Collapse multiple dots; keep only the first.
  const parts = raw.split(".");
  const intRaw = parts[0] || "0";
  const decRaw = parts.length > 1 ? parts.slice(1).join("") : null;

  const intFormatted = addCommas(intRaw);

  if (decRaw === null) {
    // No decimal point typed yet.
    if (keepTrailing) {
      // User is still typing; do not append decimals.
      return intFormatted;
    }
    // On blur for currency: force two decimals.
    return mode === "currency" ? `${intFormatted}.00` : intFormatted;
  }

  // Decimal point was typed.
  if (keepTrailing) {
    // Mid-edit: show whatever the user has typed so far (up to 2 digits).
    const trimmed = decRaw.slice(0, 2);
    return `${intFormatted}.${trimmed}`;
  }

  // On blur.
  if (mode === "currency") {
    const padded = decRaw.slice(0, 2).padEnd(2, "0");
    return `${intFormatted}.${padded}`;
  }

  // Quantity blur: keep up to 2 decimal digits, but strip trailing zeros only
  // when the user didn't type anything meaningful.
  const trimmed = decRaw.slice(0, 2).replace(/0+$/, "");
  return trimmed.length > 0
    ? `${intFormatted}.${trimmed}`
    : intFormatted;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface FormattedInputResult {
  /** The display value shown inside the <input>. Bind to `value`. */
  displayValue: string;
  /** The clean, unformatted numeric string (e.g. "1000.5"). Use for DB writes. */
  rawValue: string;
  /** Parses rawValue to a JS number. Returns 0 for empty / invalid values. */
  parseRaw: () => number;
  /** onChange handler — bind directly to `<input onChange={…}>`. */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** onBlur handler — bind directly to `<input onBlur={…}>`. */
  onBlur: () => void;
  /**
   * Programmatically set a new numeric value from outside (e.g. when selecting
   * a preset or populating from the database). Pass a number or numeric string.
   */
  setValue: (val: number | string) => void;
}

export function useFormattedInput(
  mode: InputMode,
  initialValue?: number | string
): FormattedInputResult {
  const normalizeInitial = (v: number | string | undefined): string => {
    if (v === undefined || v === null || v === "") return "";
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!isFinite(n)) return "";
    return String(n);
  };

  const [rawValue, setRawValue] = useState<string>(() => normalizeInitial(initialValue));
  const [displayValue, setDisplayValue] = useState<string>(() => {
    const r = normalizeInitial(initialValue);
    return r ? formatDisplay(r, mode) : "";
  });

  // Keep a ref to the underlying <input> element so we can restore cursor position.
  const inputRef = useRef<HTMLInputElement | null>(null);

  /**
   * onChange fires on every keystroke.
   * Strategy:
   * 1. Strip the new value down to digits + at-most-one decimal point.
   * 2. Re-insert commas.
   * 3. Calculate the cursor delta (new length − old length) and restore cursor.
   */
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const cursorPos = el.selectionStart ?? 0;
      const prevDisplay = displayValue;

      // Strip the raw typed value.
      let raw = stripFormatting(el.value);

      // Guard: only keep the first decimal point.
      const firstDot = raw.indexOf(".");
      if (firstDot !== -1) {
        raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
      }

      // Limit to 2 decimal digits while typing.
      const dotIdx = raw.indexOf(".");
      if (dotIdx !== -1 && raw.length - dotIdx - 1 > 2) {
        raw = raw.slice(0, dotIdx + 3);
      }

      setRawValue(raw);

      // Format for display — pass keepTrailing=true so we don't force .00 mid-edit.
      const newDisplay = formatDisplay(raw, mode, /* keepTrailing */ true);
      setDisplayValue(newDisplay);

      // Restore cursor: figure out how many characters were added/removed.
      requestAnimationFrame(() => {
        if (!el) return;
        const delta = newDisplay.length - prevDisplay.length;
        const newCursor = Math.max(0, cursorPos + delta);
        el.setSelectionRange(newCursor, newCursor);
      });
    },
    [displayValue, mode]
  );

  /** onBlur applies final formatting (e.g. ".00" for currency). */
  const onBlur = useCallback(() => {
    if (!rawValue) {
      setDisplayValue("");
      return;
    }
    setDisplayValue(formatDisplay(rawValue, mode, /* keepTrailing */ false));
  }, [rawValue, mode]);

  /** Programmatic setter — used when the parent wants to push a value in. */
  const setValue = useCallback(
    (val: number | string) => {
      const n = typeof val === "string" ? parseFloat(val) : val;
      const raw = isFinite(n) && n !== 0 ? String(n) : val === "" ? "" : "0";
      setRawValue(raw);
      setDisplayValue(raw ? formatDisplay(raw, mode) : "");
    },
    [mode]
  );

  /** Convert rawValue → JS number for the DB payload. */
  const parseRaw = useCallback((): number => {
    if (!rawValue) return 0;
    const n = parseFloat(rawValue);
    return isFinite(n) ? n : 0;
  }, [rawValue]);

  return { displayValue, rawValue, parseRaw, onChange, onBlur, setValue };
}
