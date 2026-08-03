import ts from "typescript";

// Read from the file rather than `verify.toString()`, which returns transpiled
// output in dev and minified output in production.

export function extractCaseSources(source: string): Record<string, string> {
  const file = ts.createSourceFile(
    "cases.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );

  const cases = file.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((declaration) => declaration.name.getText() === "CASES");

  if (!cases?.initializer || !ts.isArrayLiteralExpression(cases.initializer)) {
    throw new Error("No `CASES` array literal in cases.ts");
  }

  const sources: Record<string, string> = {};
  for (const element of cases.initializer.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    const label = labelOf(element);
    if (label) sources[label] = dedent(element.getText());
  }
  return sources;
}

function labelOf(testCase: ts.ObjectLiteralExpression): string | undefined {
  const label = testCase.properties
    .filter(ts.isPropertyAssignment)
    .find((property) => property.name.getText() === "label");

  if (!label) return undefined;
  return ts.isStringLiteralLike(label.initializer)
    ? label.initializer.text
    : undefined;
}

// The first line starts at the `{`; the rest carry their indentation in the file.
function dedent(block: string): string {
  const [first, ...rest] = block.split("\n");
  const indents = rest
    .filter((line) => line.trim())
    .map((line) => line.length - line.trimStart().length);
  if (indents.length === 0) return block;
  const indent = Math.min(...indents);

  return [
    first,
    ...rest.map((line) => (line.trim() ? line.slice(indent) : line)),
  ].join("\n");
}
