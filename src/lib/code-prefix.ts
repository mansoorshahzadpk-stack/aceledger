/**
 * Automatically extracts a 3-letter code from the first three characters of the business entity's name.
 * Ignores common prefixes like 'The', 'A', 'An', 'Shop', spaces, and non-alphanumeric characters, and capitalizes the result.
 */
export function generateCodePrefix(name: string): string {
  if (!name) return "";
  let clean = name.trim();
  // Remove common prefixes case-insensitively
  const prefixesToIgnore = [/^(the|a|an|shop)\s+/i];
  for (const regex of prefixesToIgnore) {
    clean = clean.replace(regex, "");
  }
  // Strip non-alphanumeric and spaces
  clean = clean.replace(/[^a-zA-Z0-9]/g, "");
  // Take first 3 characters, capitalize, pad if shorter than 3
  return clean.substring(0, 3).toUpperCase().padEnd(3, "X");
}
