export function appendChunk(prev: string, chunk: string): string {
  if (!prev) return chunk.trimStart();
  if (!chunk) return prev;

  const pTrailingWhitespace = prev.match(/\s+$/)?.[0] || '';
  const cLeadingWhitespace = chunk.match(/^\s+/)?.[0] || '';

  const baseP = pTrailingWhitespace ? prev.slice(0, -pTrailingWhitespace.length) : prev;
  const baseC = cLeadingWhitespace ? chunk.slice(cLeadingWhitespace.length) : chunk;

  let combinedWhitespace = pTrailingWhitespace + cLeadingWhitespace;
  if (combinedWhitespace.length > 0) {
    if (combinedWhitespace.includes('\n')) {
      combinedWhitespace = '\n';
    } else {
      combinedWhitespace = ' ';
    }
  }

  // If chunk is entirely whitespace
  if (!baseC) {
    return baseP + combinedWhitespace;
  }

  const lastChar = baseP.slice(-1);
  const firstChar = baseC.charAt(0);

  // Avoid double spaces before punctuation, and snap punctuation to the left word
  if (/^[.,?!:;]/.test(baseC)) {
    return baseP + baseC;
  }

  const isEndAlphanum = /[a-zA-Z0-9]/.test(lastChar);
  const isStartAlphanum = /[a-zA-Z0-9]/.test(firstChar);

  if (combinedWhitespace) {
    return baseP + combinedWhitespace + baseC;
  } else {
    // Insert one space when needed between alphanumeric boundaries
    if (isEndAlphanum && isStartAlphanum) {
      return baseP + ' ' + baseC;
    }
    return baseP + baseC;
  }
}
