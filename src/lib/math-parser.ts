/**
 * Safe client-side mathematical expression parser.
 * Supports +, -, *, /, parenthesis (), decimals, and sign operators.
 * Avoids global eval() and Function() constructor for absolute security.
 */

export function evaluateMath(str: string): number | null {
  const expr = str.replace(/\s+/g, "");
  if (!expr) return null;
  
  // Safe validation: strictly allow only numbers, decimal points, operators, and parenthesis.
  if (!/^[0-9+\-*/().]+$/.test(expr)) {
    return null;
  }

  let index = 0;

  function parseExpression(): number {
    let result = parseTerm();
    while (index < expr.length) {
      const op = expr[index];
      if (op === "+" || op === "-") {
        index++;
        const term = parseTerm();
        if (op === "+") result += term;
        else result -= term;
      } else {
        break;
      }
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (index < expr.length) {
      const op = expr[index];
      if (op === "*" || op === "/") {
        index++;
        const factor = parseFactor();
        if (op === "*") {
          result *= factor;
        } else {
          if (factor === 0) throw new Error("Division by zero");
          result /= factor;
        }
      } else {
        break;
      }
    }
    return result;
  }

  function parseFactor(): number {
    if (index >= expr.length) return 0;

    if (expr[index] === "+") {
      index++;
      return parseFactor();
    }

    if (expr[index] === "-") {
      index++;
      return -parseFactor();
    }

    if (expr[index] === "(") {
      index++; // skip '('
      const result = parseExpression();
      if (index < expr.length && expr[index] === ")") {
        index++; // skip ')'
      }
      return result;
    }

    const start = index;
    while (index < expr.length && /[0-9.]/.test(expr[index])) {
      index++;
    }
    const numStr = expr.slice(start, index);
    const val = parseFloat(numStr);
    if (isNaN(val)) return 0;
    return val;
  }

  try {
    const res = parseExpression();
    if (index < expr.length) {
      return null; // Syntax error: expression was not fully parsed
    }
    return res;
  } catch (e) {
    return null;
  }
}

/**
 * Safely parse a mathematical expression, falling back to standard parseFloat.
 * Supports splitting display format: "expression = result".
 */
export function parseMath(val: string): number {
  let clean = val.trim();
  if (!clean) return 0;

  // Handle evaluated display format: "expression = result"
  if (clean.includes("=")) {
    const parts = clean.split("=");
    const resultPart = parts[parts.length - 1].trim();
    const parsedResult = parseFloat(resultPart);
    if (!isNaN(parsedResult)) {
      return parsedResult;
    }
    const exprPart = parts[0].trim();
    const evaluatedExpr = evaluateMath(exprPart);
    if (evaluatedExpr !== null) return evaluatedExpr;
  }
  
  const evaluated = evaluateMath(clean);
  if (evaluated !== null) {
    return evaluated;
  }

  const parsed = parseFloat(clean);
  if (!isNaN(parsed)) {
    return parsed;
  }
  
  return 0;
}

/**
 * Parses flat numeric value, mathematical expression, or percentage value
 * (e.g. "2%" or "1.5%") computed against a subtotal.
 * Supports evaluated displays.
 */
export function parsePercentageOrMath(val: string, subtotal: number): number {
  let clean = val.trim();
  if (!clean) return 0;

  // Handle format: "expression = result"
  if (clean.includes("=")) {
    const parts = clean.split("=");
    clean = parts[0].trim();
  }

  if (clean.endsWith("%")) {
    const expr = clean.slice(0, -1);
    const pctVal = parseMath(expr);
    return (pctVal / 100) * subtotal;
  }

  return parseMath(clean);
}

/**
 * Formats an expression to audit trail layout: "expression = result" on blur.
 */
export function formatOnBlur(val: string): string {
  const clean = val.trim();
  if (!clean) return "";

  if (clean.includes("=")) {
    return clean;
  }

  // Handle percentages
  if (clean.endsWith("%")) {
    return clean;
  }

  const evaluated = evaluateMath(clean);
  if (evaluated !== null) {
    // If it is just a plain number without math operators, return as-is
    if (/^[0-9.]+$/.test(clean)) {
      return clean;
    }
    return `${clean} = ${evaluated}`;
  }

  return clean;
}

/**
 * Restores the raw expression "expression" when focus enters the field.
 */
export function formatOnFocus(val: string): string {
  const clean = val.trim();
  if (clean.includes("=")) {
    const parts = clean.split("=");
    return parts[0].trim();
  }
  return clean;
}

/**
 * Extracts only the expression part (e.g. "200/2" from "200/2 = 100" or "2%").
 * Returns null if it is a plain flat number.
 */
export function getFormulaPart(val: string): string | null {
  const clean = val.trim();
  if (!clean) return null;

  if (clean.endsWith("%")) {
    return clean;
  }

  if (clean.includes("=")) {
    const expr = clean.split("=")[0].trim();
    if (expr.endsWith("%")) {
      return expr;
    }
    // Verify the expression actually contains operations
    if (/^[0-9.]+$/.test(expr)) {
      return null;
    }
    return expr;
  }

  // If it doesn't contain '=' but has operations (e.g., "100*2")
  const evaluated = evaluateMath(clean);
  if (evaluated !== null && !/^[0-9.]+$/.test(clean)) {
    return clean;
  }

  return null;
}
