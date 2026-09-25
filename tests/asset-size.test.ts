import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { overLimitMessage, parseMaxSize } from "../scripts/asset-size.js";

describe("asset size guard", () => {
  it("treats 1M as one mebibyte", () => {
    assert.equal(parseMaxSize("1M"), 1024 * 1024);
  });

  it("flags a glb or bin that is over the attribute limit", () => {
    assert.equal(overLimitMessage("circuit.glb", 1024 * 1024, "1M"), undefined);
    assert.match(
      overLimitMessage("graph.bin", 1024 * 1024 + 1, "1M") ?? "",
      /graph\.bin/,
    );
  });
});
