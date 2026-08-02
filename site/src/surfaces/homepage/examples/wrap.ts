/**
 * Greedy word wrap. TextMorph's root is `white-space: nowrap`, so line breaks
 * have to be explicit — this reflows a paragraph the way a real text container
 * would, which is what makes words migrate between lines as content changes.
 */
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
