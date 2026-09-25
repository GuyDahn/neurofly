import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  assertLock,
  assetUrl,
  fetchLockedAssets,
  sha256Bytes,
  type DataLock,
} from "../scripts/data-lock.js";

const DIGEST = sha256Bytes(new TextEncoder().encode("neuron"));

describe("data lock", () => {
  it("builds a GitHub Release URL for the pinned tag", () => {
    const lock: DataLock = {
      version: "data-v1",
      repository: "GuyDahn/neurofly",
      files: [],
    };
    assert.equal(
      assetUrl(lock, "neurons.json"),
      "https://github.com/GuyDahn/neurofly/releases/download/data-v1/neurons.json",
    );
  });

  it("rejects path-like asset names and bad version tags", () => {
    assert.throws(() =>
      assertLock({
        version: "latest",
        repository: "GuyDahn/neurofly",
        files: [],
      }),
    );
    assert.throws(() =>
      assertLock({
        version: "data-v1",
        repository: "GuyDahn/neurofly",
        files: [{ name: "../neurons.json", sha256: DIGEST }],
      }),
    );
  });

  it("downloads a pinned file only when the sha256 matches", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "neurofly-data-"));
    try {
      const lock: DataLock = {
        version: "data-v2",
        repository: "GuyDahn/neurofly",
        files: [{ name: "neurons.json", sha256: DIGEST }],
      };
      const written = await fetchLockedAssets({
        lock,
        destination: directory,
        fetchImpl: async () =>
          new Response(new TextEncoder().encode("neuron"), { status: 200 }),
      });
      assert.equal(written.length, 1);
      assert.equal(await readFile(written[0]!, "utf8"), "neuron");

      await assert.rejects(
        fetchLockedAssets({
          lock,
          destination: directory,
          fetchImpl: async () => new Response("tampered", { status: 200 }),
        }),
        /sha256 mismatch/,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
