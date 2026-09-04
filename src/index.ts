/**
 * @openswitchboard/schema - conformance harness.
 *
 * `npm test` runs this suite against the reference Ajv validator. Third-party
 * implementations can import { runConformance } and pass their own validate
 * function to prove they accept/reject exactly what the protocol requires.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

export const SCHEMA_NAMES = [
  "common",
  "intent-card",
  "match.signal",
  "match.attributes",
  "match.mutual",
  "conversation.open",
  "conversation.message",
  "offer",
  "settlement",
  "error",
  "deny-list",
] as const;

export type SchemaName = (typeof SCHEMA_NAMES)[number];

export interface Fixture {
  /** Fixture file name. */
  file: string;
  /** Human description of what this fixture demonstrates. */
  description: string;
  /** Which schema the payload must be validated against. */
  schema: SchemaName;
  /** Whether the payload must validate. */
  valid: boolean;
  /**
   * For intent-card fixtures that also exercise the taxonomy gate: the status
   * the listing's category must resolve to. A listing can be perfectly well-formed
   * and still be refused because its category is reserved or unknown, so this
   * assertion is separate from schema validity.
   */
  taxonomy?: {
    status: CategoryStatus["status"];
    /** Substring that must appear in the status reason. */
    reason_contains?: string;
  };
  /**
   * For invalid fixtures: a substring that must appear in the validator's
   * reason output, pinning the failure to the *right* rule (e.g. the identity
   * field, not some incidental typo).
   */
  error_contains?: string;
  /** The payload under test. */
  data: unknown;
}

export interface ValidationResult {
  valid: boolean;
  /** Machine-checkable reasons; empty when valid. */
  reasons: string[];
}

export type ValidateFn = (schema: SchemaName, data: unknown) => ValidationResult;

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export interface TaxonomyNode {
  label: string;
  /** Absent means open. 'reserved' closes this node and everything under it. */
  status?: "reserved";
  /** Why the node is reserved: 'licensed-trade' or 'regulated-vertical'. */
  reserved_reason?: string;
  attributes?: Record<string, unknown>;
}

export interface Taxonomy {
  schema_version: string;
  notes: string;
  common_attributes: Record<string, unknown>;
  top_levels: Record<string, { status: "open" | "reserved"; reason?: string }>;
  nodes: Record<string, TaxonomyNode>;
}

export interface CategoryStatus {
  /** 'open' may be posted; 'reserved' and 'unknown' are refused. */
  status: "open" | "reserved" | "unknown";
  /** Plain reason, present whenever the status is not 'open'. */
  reason?: string;
}

let taxonomyCache: Taxonomy | undefined;

/** The taxonomy shipped with this package (data/taxonomy.v2.json). */
export function loadTaxonomy(): Taxonomy {
  if (!taxonomyCache) {
    taxonomyCache = JSON.parse(
      readFileSync(join(root, "data", "taxonomy.v2.json"), "utf8"),
    ) as Taxonomy;
  }
  return taxonomyCache;
}

/** Every category a listing may be posted under, in taxonomy order. */
export function openCategories(taxonomy: Taxonomy = loadTaxonomy()): string[] {
  return Object.keys(taxonomy.nodes).filter(
    (c) => categoryStatus(c, taxonomy).status === "open",
  );
}

/**
 * Resolve a category against the taxonomy. A category may be posted when its
 * top level is open, the node exists, and no node on its path — itself
 * included — is reserved. This is the whole rule; every deployment applies it
 * the same way.
 */
export function categoryStatus(
  category: string,
  taxonomy: Taxonomy = loadTaxonomy(),
): CategoryStatus {
  const parts = category.split(".");
  const top = parts[0];
  const topLevel = taxonomy.top_levels[top];
  if (!topLevel) {
    return { status: "unknown", reason: `top level '${top}' is not in the taxonomy` };
  }
  if (topLevel.status !== "open") {
    return { status: "reserved", reason: `top level '${top}' is reserved` };
  }
  if (!taxonomy.nodes[category]) {
    return { status: "unknown", reason: `category '${category}' is not in the taxonomy` };
  }
  for (let i = 1; i <= parts.length; i++) {
    const path = parts.slice(0, i).join(".");
    const node = taxonomy.nodes[path];
    if (node?.status === "reserved") {
      return {
        status: "reserved",
        reason: `'${path}' is reserved (${node.reserved_reason ?? "reserved"})`,
      };
    }
  }
  return { status: "open" };
}

export type CheckCategoryFn = (category: string) => CategoryStatus;

/** Load all schema documents keyed by short name. */
export function loadSchemas(): Record<SchemaName, object> {
  const out = {} as Record<SchemaName, object>;
  for (const name of SCHEMA_NAMES) {
    out[name] = JSON.parse(
      readFileSync(join(root, "schemas", `${name}.json`), "utf8"),
    );
  }
  return out;
}

/** Reference validator backed by Ajv (draft 2020-12). */
export function createValidator(): ValidateFn {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats.default ? addFormats.default(ajv) : (addFormats as any)(ajv);
  const schemas = loadSchemas();
  for (const name of SCHEMA_NAMES) ajv.addSchema(schemas[name]);
  return (schema, data) => {
    const validate = ajv.getSchema(
      `https://schema.openswitchboard.ai/v0/${schema}.json`,
    );
    if (!validate) throw new Error(`unknown schema: ${schema}`);
    const valid = validate(data) as boolean;
    const reasons = (validate.errors ?? []).map(
      (e) => `${e.instancePath} ${e.keyword} ${e.message} ${JSON.stringify(e.params)}`,
    );
    return { valid, reasons };
  };
}

/** Load every fixture shipped with the package. */
export function loadFixtures(): Fixture[] {
  const dir = join(root, "fixtures");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      ...JSON.parse(readFileSync(join(dir, file), "utf8")),
    }));
}

export interface ConformanceFailure {
  fixture: string;
  description: string;
  problem: string;
}

export interface ConformanceReport {
  total: number;
  passed: number;
  failures: ConformanceFailure[];
}

/**
 * Run the full conformance suite. Pass your own `validate` to test a
 * third-party implementation; defaults to the reference Ajv validator.
 */
export function runConformance(
  validate: ValidateFn = createValidator(),
  checkCategory: CheckCategoryFn = (c) => categoryStatus(c),
): ConformanceReport {
  const fixtures = loadFixtures();
  const failures: ConformanceFailure[] = [];
  for (const f of fixtures) {
    if (f.taxonomy) {
      const category = (f.data as { category?: string }).category ?? "";
      const got = checkCategory(category);
      if (got.status !== f.taxonomy.status) {
        failures.push({
          fixture: f.file,
          description: f.description,
          problem: `category ${JSON.stringify(category)}: expected taxonomy status ${
            f.taxonomy.status
          } but got ${got.status}`,
        });
        continue;
      }
      if (f.taxonomy.reason_contains && !(got.reason ?? "").includes(f.taxonomy.reason_contains)) {
        failures.push({
          fixture: f.file,
          description: f.description,
          problem: `category ${JSON.stringify(category)}: reason ${JSON.stringify(
            got.reason ?? "",
          )} does not contain ${JSON.stringify(f.taxonomy.reason_contains)}`,
        });
        continue;
      }
    }
    const result = validate(f.schema, f.data);
    if (result.valid !== f.valid) {
      failures.push({
        fixture: f.file,
        description: f.description,
        problem: f.valid
          ? `expected VALID but got: ${result.reasons.join("; ")}`
          : "expected INVALID but the payload validated",
      });
      continue;
    }
    if (!f.valid && f.error_contains) {
      const blob = result.reasons.join("\n");
      if (!blob.includes(f.error_contains)) {
        failures.push({
          fixture: f.file,
          description: f.description,
          problem: `failed, but not for the asserted reason. wanted substring ${JSON.stringify(
            f.error_contains,
          )} in:\n${blob}`,
        });
      }
    }
  }
  return { total: fixtures.length, passed: fixtures.length - failures.length, failures };
}
