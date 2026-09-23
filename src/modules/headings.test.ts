import { expect, test } from "bun:test";
import { countHeadings, headingNumbering, tableRowsAfter } from "./headings";

test("counts headings outside fenced blocks only", () => {
  expect(countHeadings("# T\n## A\n```bash\n# not\n```\n## B\n")).toBe(3);
});

test("extracts numbering and appendix letters in order", () => {
  expect(headingNumbering("# T\n## 1. A\n## 2.1. B\n## Anexo A. C\n## Appendix b. D\n")).toEqual(["1", "2.1", "A", "B"]);
});

test("tableRowsAfter returns body rows of the first table under a heading", () => {
  const md = "## Códigos de error\nintro\n| Código | Significado |\n| --- | --- |\n| `A_B` | x |\n| `C_D` | y |\n\n## Otro\n| Q | R |\n| --- | --- |\n| 1 | 2 |\n";
  expect(tableRowsAfter(md, "## Códigos de error")).toEqual([["`A_B`", "x"], ["`C_D`", "y"]]);
  expect(tableRowsAfter(md, "## Nada")).toEqual([]);
});
