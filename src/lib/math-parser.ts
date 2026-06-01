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
 */
export function parseMath(val: string): number {
  const clean = val.trim();
  if (!clean) return 0;
  
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
 */
export function parsePercentageOrMath(val: string, subtotal: number): number {
  const clean = val.trim();
  if (!clean) return 0;

  if (clean.endsWith("%")) {
    const expr = clean.slice(0, -1);
    const pctVal = parseMath(expr);
    return (pctVal / 100) * subtotal;
  }

  return parseMath(clean);
}
