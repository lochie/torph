// TextMorph's root is `white-space: nowrap`, so line breaks have to be explicit.
export const wrap = (text: string, maxChars: number) => {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);

  return lines.join("\n");
};
