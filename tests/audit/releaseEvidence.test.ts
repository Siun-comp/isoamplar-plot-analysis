import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryRoots: string[] = [];

afterEach(() => {
  temporaryRoots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe("GPT-5.6 audit remediation evidence", () => {
  it("rejects a dist tree that changes after the integrity baseline", () => {
    const root = mkdtempSync(join(tmpdir(), "isoamplar-dist-integrity-"));
    temporaryRoots.push(root);
    mkdirSync(join(root, "dist", "assets"), { recursive: true });
    writeFileSync(join(root, "dist", "index.html"), "<main>synthetic</main>");
    writeFileSync(join(root, "dist", "assets", "app.js"), "console.log('synthetic');");

    const script = join(projectRoot, "scripts", "dist-integrity.mjs");
    runIntegrity(root, script, "snapshot", "evidence/before.sha256", "evidence/before-tree.sha256");
    runIntegrity(root, script, "snapshot", "evidence/after.sha256", "evidence/after-tree.sha256");
    runIntegrity(root, script, "compare", "evidence/before.sha256", "evidence/after.sha256", "evidence/result.txt");
    expect(readFileSync(join(root, "evidence", "result.txt"), "utf8")).toContain("byte-identical");

    writeFileSync(join(root, "dist", "assets", "app.js"), "console.log('changed');");
    runIntegrity(root, script, "snapshot", "evidence/changed.sha256", "evidence/changed-tree.sha256");
    expect(() =>
      runIntegrity(root, script, "compare", "evidence/before.sha256", "evidence/changed.sha256", "evidence/failure.txt")
    ).toThrow();
    expect(readFileSync(join(root, "evidence", "failure.txt"), "utf8")).toContain("FAIL");
  });

  it("keeps CI and Pages promotion on fresh base-path-tested dist with least deployment permissions", () => {
    const playwright = readProjectText("playwright.config.ts");
    const appE2e = readProjectText("tests", "e2e", "app.spec.ts");
    const branchCi = readProjectText(".github", "workflows", "s1-ci.yml");
    const pages = readProjectText(".github", "workflows", "pages.yml");

    expect(playwright).toContain('"http://127.0.0.1:4174"');
    expect(playwright).toContain("--strictPort");
    expect(playwright).toContain("reuseExistingServer: false");
    expect(playwright).toContain('serviceWorkers: "block"');
    expect(playwright).toContain('trace: "retain-on-failure"');
    expect(appE2e).not.toContain('page.goto("/")');
    expect(appE2e).toContain('page.goto("./")');
    expect(appE2e).toContain("routeWebSocket");

    for (const workflow of [branchCi, pages]) {
      expect(workflow).toContain('E2E_BASE_URL: "http://127.0.0.1:4174/isoamplar-plot-analysis/"');
      expect(workflow).toContain('VITE_BASE_PATH: "/isoamplar-plot-analysis/"');
      expect(workflow).toContain("npm audit --omit=dev --audit-level=high");
      expect(workflow).toContain("npm run check:dist:before");
      expect(workflow).toContain("npm run check:dist:unchanged");
      expect(workflow).toContain("--fail-on-flaky-tests");
      expect(workflow).toContain("fetch-depth: 0");
      expect(workflow).toContain("git diff --check");
    }

    expect(pages.indexOf("npm run check:dist:unchanged")).toBeLessThan(pages.indexOf("actions/upload-pages-artifact@v3"));
    expect(pages).toContain("permissions:\n  contents: read");
    expect(pages).toContain("permissions:\n      pages: write\n      id-token: write");
  });
});

function readProjectText(...segments: string[]) {
  return readFileSync(join(projectRoot, ...segments), "utf8").replace(/\r\n?/gu, "\n");
}

function runIntegrity(root: string, script: string, ...args: string[]) {
  execFileSync(process.execPath, [script, ...args], { cwd: root, stdio: "pipe" });
}
