import { describe, it, expect } from "vitest";
import {
  createValidator,
  loadFixtures,
  runConformance,
} from "../src/index.js";

const validate = createValidator();
const fixtures = loadFixtures();

describe("fixture inventory", () => {
  it("ships at least 25 fixtures with both valid and invalid cases", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(25);
    expect(fixtures.filter((f) => f.valid).length).toBeGreaterThan(0);
    expect(fixtures.filter((f) => !f.valid).length).toBeGreaterThan(0);
  });

  it("every invalid fixture pins its failure reason", () => {
    for (const f of fixtures.filter((f) => !f.valid)) {
      expect(f.error_contains, `${f.file} must assert error_contains`).toBeTruthy();
    }
  });
});

describe("conformance fixtures", () => {
  for (const f of fixtures) {
    it(`${f.file}: ${f.description}`, () => {
      const result = validate(f.schema, f.data);
      if (f.valid) {
        expect(result.reasons.join("; ")).toBe("");
        expect(result.valid).toBe(true);
      } else {
        expect(result.valid).toBe(false);
        expect(result.reasons.join("\n")).toContain(f.error_contains!);
      }
    });
  }
});

describe("runConformance (third-party entrypoint)", () => {
  it("reports all fixtures passing against the reference validator", () => {
    const report = runConformance();
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(report.total);
  });

  it("catches a broken implementation", () => {
    const report = runConformance(() => ({ valid: true, reasons: [] }));
    expect(report.failures.length).toBeGreaterThan(0);
  });
});

describe("shipped data files validate against their schemas", () => {
  it("deny-list seed conforms to deny-list schema", async () => {
    const { readFileSync } = await import("node:fs");
    const seed = JSON.parse(
      readFileSync(new URL("../data/deny-list.seed.json", import.meta.url), "utf8"),
    );
    const result = validate("deny-list", seed);
    expect(result.reasons.join("; ")).toBe("");
  });
});
