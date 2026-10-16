import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The bilingual integration pages document the release target and uninstall confirmation contract. */
test("integration docs explain target-release gatekeepers and uninstall cancellation", () => {
  const es = readFileSync(resolve(import.meta.dir, "../docs/es/03-integracion.md"), "utf8");
  const en = readFileSync(resolve(import.meta.dir, "../docs/en/03-integration.md"), "utf8");

  expect(es).toContain("portero de la release destino");
  expect(es).toContain("--version");
  expect(es).toContain("¿Desinstalar forge614-sentinel? [s/N]");
  expect(es).toContain("130");
  expect(es).toContain("--json");

  expect(en).toContain("gatekeeper from the target release");
  expect(en).toContain("--version");
  expect(en).toContain("¿Desinstalar forge614-sentinel? [s/N]");
  expect(en).toContain("130");
  expect(en).toContain("--json");
});
