import { expect, test } from "bun:test";
import { unzipSync } from "fflate";
import { extractTarGz } from "./archive";
import { packTarGz, packZip } from "./packaging";

const bytes = new TextEncoder().encode("#!/bin/sh\necho sentinel\n");

test("packTarGz yields a tar.gz with the binary at the root and mode 0755", () => {
  const members = extractTarGz(packTarGz([{ path: "forge614-sentinel", mode: 0o755, content: bytes }]));
  expect(members).toHaveLength(1);
  expect(members[0]).toMatchObject({ path: "forge614-sentinel", mode: 0o755 });
  expect(members[0]?.content).toEqual(bytes);
});

test("packZip yields a zip readable by fflate with the .exe at the root", () => {
  const files = unzipSync(packZip({ "forge614-sentinel.exe": bytes }));
  expect(Object.keys(files)).toEqual(["forge614-sentinel.exe"]);
  expect(files["forge614-sentinel.exe"]).toEqual(bytes);
});
