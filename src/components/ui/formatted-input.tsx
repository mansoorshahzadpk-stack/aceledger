/**
 * FormattedInput
 * ──────────────
 * A controlled <Input> that automatically:
 *  • Inserts thousand-separator commas while the user types (e.g. 1000 → 1,000)
 *  • Enforces 2-decimal precision for "currency" mode (appends ".00" on blur)
 *  • Permits up to 2 decimals for "quantity" mode but never forces trailing zeros
 *  • Preserves the user's cursor position during formatting
 *  • Exposes a clean `rawValue` (e.g. "1000.5") via `onRawChange` for DB writes
 *
 * Props are a superset of normal <input> props so you can pass className,
 * placeholder, autoFocus, required, disabled, id, etc. unchanged.
 *
 * Usage – Currency:
 *   <FormattedInput
 *     mode="currency"
 *     rawValue={form.amount}
 *     onRawChange={(raw) => setForm({ ...form, amount: raw })}
 *     placeholder="0.00"
 *   />
 *
 * Usage – Quantity:
 *   <FormattedInput
 *     mode="quantity"
 *     rawValue={form.qty}
 *     onRawChange={(raw) => setForm({ ...form, qty: raw })}
 *     placeholder="0"
 *   />
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { useFormattedInput, type InputMode } from "@/lib/use-formatted-input";

export interface FormattedInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    // We replace these with our own controlled props
    "type" | "value" | "defaultValue" | "onChange" | "onBlur"
  > {
  /** "currency" – always 2dp, forces .00 on blur.  "quantity" – up to 2dp, no forced zeros. */
  mode: InputMode;
  /**
   * The raw, unformatted numeric string stored in parent state (e.g. "1000.5").
   * This is what you save to the database.
   */
  rawValue: string;
  /**
   * Called whenever the underlying number changes.
   * Receives the clean raw string ("1000.5"), not the formatted display string.
   */
  onRawChange: (raw: string) => void;
  /** Optional extra onBlur to run after formatting is applied. */
  onBlur?: () => void;
}

export const FormattedInput = React.forwardRef<HTMLInputElement, FormattedInputProps>(
  ({ mode, rawValue, onRawChange, onBlur: externalBlur, ...rest }, forwardedRef) => {
    // Derive display from rawValue via the hook.
    // We use an internal state for the display that stays in sync.
    const [internalDisplay, setInternalDisplay] = React.useState<string>(() =>
      rawValue ? applyInitialFormat(rawValue, mode) : ""
    );

    // Track previous rawValue to detect external programmatic changes.
    const prevRawRef = React.useRef<string>(rawValue);

    // When the parent changes rawValue from the outside (e.g. form reset or
    // pre-populating from DB), re-derive the display.
    React.useEffect(() => {
      if (rawValue !== prevRawRef.current) {
        prevRawRef.current = rawValue;
        setInternalDisplay(rawValue ? applyInitialFormat(rawValue, mode) : "");
      }
    }, [rawValue, mode]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const cursorPos = el.selectionStart ?? 0;
      const prevDisplay = internalDisplay;

      // Strip to digits + single decimal.
      let raw = el.value.replace(/[^0-9.]/g, "");
      const firstDot = raw.indexOf(".");
      if (firstDot !== -1) {
        raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
        // Limit to 2 decimal digits mid-edit.
        if (raw.length - firstDot - 1 > 2) {
          raw = raw.slice(0, firstDot + 3);
        }
      }

      const newDisplay = formatForDisplay(raw, mode, true);
      setInternalDisplay(newDisplay);

      // Notify parent with the clean raw value.
      prevRawRef.current = raw;
      onRawChange(raw);

      // Restore cursor position accounting for inserted/removed commas.
      requestAnimationFrame(() => {
        if (!el) return;
        const delta = newDisplay.length - prevDisplay.length;
        const next = Math.max(0, cursorPos + delta);
        el.setSelectionRange(next, next);
      });
    };

    const handleBlur = () => {
      if (!rawValue) {
        setInternalDisplay("");
      } else {
        setInternalDisplay(formatForDisplay(rawValue, mode, false));
      }
      externalBlur?.();
    };

    return (
      <Input
        {...rest}
        ref={forwardedRef}
        type="text"
        inputMode="decimal"
        value={internalDisplay}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    );
  }
);

FormattedInput.displayName = "FormattedInput";

// ── Internal formatting helpers (duplicated from hook for self-contained component) ──

function addCommas(intPart: string): string {
  let result = "";
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0) result += ",";
    result += intPart[i];
  }
  return result;
}

function formatForDisplay(raw: string, mode: InputMode, keepTrailing: boolean): string {
  if (!raw) return "";
  const parts = raw.split(".");
  const intRaw = parts[0] || "0";
  const decRaw = parts.length > 1 ? parts.slice(1).join("") : null;
  const intFormatted = addCommas(intRaw);

  if (decRaw === null) {
    if (keepTrailing) return intFormatted;
    return mode === "currency" ? `${intFormatted}.00` : intFormatted;
  }

  if (keepTrailing) {
    return `${intFormatted}.${decRaw.slice(0, 2)}`;
  }

  if (mode === "currency") {
    return `${intFormatted}.${decRaw.slice(0, 2).padEnd(2, "0")}`;
  }

  // Quantity: strip trailing zeros on blur.
  const trimmed = decRaw.slice(0, 2).replace(/0+$/, "");
  return trimmed.length > 0 ? `${intFormatted}.${trimmed}` : intFormatted;
}

/** Used only for deriving an initial display from a pre-existing raw value. */
function applyInitialFormat(raw: string, mode: InputMode): string {
  return formatForDisplay(raw, mode, false);
}
