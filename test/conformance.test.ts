import { describe, it, expect } from "vitest";
import {
  categoryStatus,
  createValidator,
  loadFixtures,
  loadTaxonomy,
  openCategories,
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

  it("catches a category gate that waves everything through", () => {
    const report = runConformance(createValidator(), () => ({ status: "open" }));
    expect(report.failures.length).toBeGreaterThan(0);
  });
});

describe("taxonomy", () => {
  const taxonomy = loadTaxonomy();

  it("every node's parent exists and every path is lower-case dotted", () => {
    for (const path of Object.keys(taxonomy.nodes)) {
      expect(path, `${path} must be a lower-case dotted path`).toMatch(
        /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/,
      );
      const parent = path.split(".").slice(0, -1).join(".");
      if (parent) {
        expect(taxonomy.nodes[parent], `${path} has no parent node`).toBeTruthy();
      } else {
        expect(taxonomy.top_levels[path], `${path} has no top level`).toBeTruthy();
      }
    }
  });

  it("every node has a human label and every reserved node says why", () => {
    for (const [path, node] of Object.entries(taxonomy.nodes)) {
      expect(node.label, `${path} needs a label`).toBeTruthy();
      if (node.status === "reserved") {
        expect(
          node.reserved_reason,
          `${path} is reserved and must carry a reserved_reason`,
        ).toMatch(/^(licensed-trade|regulated-vertical)$/);
      }
    }
  });

  it("opens goods, services and social and holds back work and property", () => {
    expect(taxonomy.top_levels.goods.status).toBe("open");
    expect(taxonomy.top_levels.services.status).toBe("open");
    expect(taxonomy.top_levels.social.status).toBe("open");
    expect(taxonomy.top_levels.work.status).toBe("reserved");
    expect(taxonomy.top_levels.property.status).toBe("reserved");
  });

  it("ships a few hundred nodes, most of them open", () => {
    expect(Object.keys(taxonomy.nodes).length).toBeGreaterThanOrEqual(300);
    expect(openCategories(taxonomy).length).toBeGreaterThanOrEqual(300);
  });

  it("resolves categories the way the specification describes", () => {
    expect(categoryStatus("goods.electronics.laptop").status).toBe("open");
    expect(categoryStatus("services.repairs.bicycle").status).toBe("open");
    expect(categoryStatus("social.language-exchange").status).toBe("open");
    expect(categoryStatus("social.dating").status).toBe("reserved");
    expect(categoryStatus("social.dating.casual").status).toBe("reserved");
    expect(categoryStatus("services.trades.plumbing").reason).toContain("licensed-trade");
    expect(categoryStatus("work.freelance").status).toBe("reserved");
    expect(categoryStatus("property.rental").status).toBe("reserved");
    expect(categoryStatus("goods.laptop.macbook-air").status).toBe("unknown");
    expect(categoryStatus("nonsense.thing").status).toBe("unknown");
  });

  it("keeps language exchange in one place, with the language as an attribute", () => {
    expect(taxonomy.nodes["social.language-exchange"].attributes).toHaveProperty("language");
    expect(taxonomy.nodes["social.conversation.language-exchange"]).toBeUndefined();
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
