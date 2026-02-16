import { highlight } from "sugar-high";

export const HighlightedCode = ({ code }: { code: string }) => {
  const html = highlight(code);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};
