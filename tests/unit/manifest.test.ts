import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "public", "templates");
const manifest = JSON.parse(
  readFileSync(join(DIR, "template-manifest.json"), "utf8"),
) as Array<{
  id: string;
  name: string;
  file: string;
  supportsCumulative: boolean;
  supportsAutoTax: boolean;
}>;

describe("template manifest", () => {
  it("has 12 templates", () => {
    expect(manifest).toHaveLength(12);
  });

  it("every referenced file exists", () => {
    for (const t of manifest) {
      expect(existsSync(join(DIR, t.file)), t.file).toBe(true);
    }
  });

  it("datev-highcopy is single-month (no cumulative, no auto-tax)", () => {
    const hc = manifest.find((t) => t.id === "datev-highcopy")!;
    expect(hc.supportsCumulative).toBe(false);
    expect(hc.supportsAutoTax).toBe(false);
  });

  it("the other 11 support cumulative + auto-tax", () => {
    for (const t of manifest.filter((t) => t.id !== "datev-highcopy")) {
      expect(t.supportsCumulative, t.id).toBe(true);
      expect(t.supportsAutoTax, t.id).toBe(true);
    }
  });
});
