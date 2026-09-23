import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { docsParityCheck } from "./docs-parity";

const params = testParams();

test("pass when every numbered es doc has an en twin with the same heading count", () => {
  expect(docsParityCheck.run(snapshotFromDir("docs-parity/pass"), params).verdict).toBe("pass");
});

test("fail on missing twin or heading count mismatch (same evidence as forge614-ai)", () => {
  const r = docsParityCheck.run(snapshotFromDir("docs-parity/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual(expect.arrayContaining(["docs/es/01-x.md: 3 headings vs docs/en/01-x.md: 2", "docs/es/02-y.md: missing docs/en/02-*.md"]));
});

test("fail when STANDARD.md and STANDARD.en.md headings differ in order or numbering", () => {
  const s = snapshotFrom({
    "README.md": "x",
    "README.en.md": "x",
    "standard/STANDARD.md": "# E\n## 1. A\n## 2. B\n## Anexo A. C\n",
    "standard/STANDARD.en.md": "# E\n## 1. A\n## 3. B\n## Appendix A. C\n",
  });
  const r = docsParityCheck.run(s, params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence.some((e) => e.includes("heading numbering"))).toBe(true);
});

test("a '#' line inside a fenced code block is not a heading", () => {
  const fenced = "# T\n## 1. A\n\n```bash\n# comment\n## not a heading\n```\n";
  const s = snapshotFrom({ "README.md": "x", "README.en.md": "x", "CONTRACT.md": fenced, "CONTRACT.en.md": "# T\n## 1. A\n" });
  expect(docsParityCheck.run(s, params).verdict).toBe("pass");
});

test("a missing twin of a root pair is reported on either side", () => {
  expect(docsParityCheck.run(snapshotFrom({ "README.md": "x" }), params).evidence).toEqual(["README.md: missing README.en.md"]);
  expect(docsParityCheck.run(snapshotFrom({ "CONTRACT.en.md": "x" }), params).evidence).toEqual(["CONTRACT.en.md: missing CONTRACT.md"]);
});
