#!/usr/bin/env node
/**
 * Verify a brief in BRIEFS_V2.md against the actual repo.
 *
 * Checks:
 *   1. Every "Files > Modified" path exists.
 *   2. Every "Files > Added" path does NOT exist yet.
 *   3. Every "Files > Deleted" path DOES exist yet.
 *   4. Every "Line references verified" claim matches the current file content.
 *
 * Usage:
 *   node scripts/verify-plan.mjs           # check every brief
 *   node scripts/verify-plan.mjs PR-A2     # check one brief
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(process.cwd());
// The brief's own listing pointed at the v1 filename here, which fails on first run —
// a nice demonstration of why this script exists.
const BRIEFS_PATH = resolve(REPO, "STRIDE_STUDIO_CLAUDE_CODE_BRIEFS_V2.md");
const brief = readFileSync(BRIEFS_PATH, "utf8");

const filter = process.argv[2];

/** Split the brief into PR sections. */
function splitPRs(content) {
  const sections = content.split(/^### (PR-[A-Z0-9.]+):/m);
  const prs = [];
  for (let i = 1; i < sections.length; i += 2) {
    prs.push({ id: `PR-${sections[i].split(":")[0].slice(3)}`, body: sections[i + 1] });
  }
  return prs;
}

function extractLineRefs(body) {
  const section = body.match(/#### Line references verified\s+([\s\S]*?)(?=\n####|\n---)/);
  if (!section) return [];
  const refs = [];
  const rx = /`([^`]+):(\d+)(?:-\d+)?`.*?—\s*`([^`]+)`/g;
  let m;
  while ((m = rx.exec(section[1]))) {
    refs.push({ file: m[1], line: parseInt(m[2], 10), expected: m[3] });
  }
  return refs;
}

function extractFileClaims(body) {
  const section = body.match(/#### Files\s+([\s\S]*?)(?=\n#### |\n---)/);
  if (!section) return { added: [], modified: [], deleted: [] };
  const added = [], modified = [], deleted = [];
  const modMatch = section[1].match(/\*\*Modified:\*\*([\s\S]*?)(?=\*\*|$)/);
  const addMatch = section[1].match(/\*\*Added:\*\*([\s\S]*?)(?=\*\*|$)/);
  const delMatch = section[1].match(/\*\*Deleted:\*\*([\s\S]*?)(?=\*\*|$)/);
  // A path has a directory separator and a real extension. Without this, backticked
  // identifiers in the prose ("session.athlete", "$font.display", "look.motion.entrance")
  // are read as files and reported missing.
  const pathRx = /`([^`*]+\/[^`*]+\.(?:ts|tsx|js|jsx|json|css|mjs|sql|html|md))`/g;
  if (modMatch) { let m; while ((m = pathRx.exec(modMatch[1]))) modified.push(m[1]); }
  if (addMatch) { let m; while ((m = pathRx.exec(addMatch[1]))) added.push(m[1]); }
  if (delMatch) { let m; while ((m = pathRx.exec(delMatch[1]))) deleted.push(m[1]); }
  return { added, modified, deleted };
}

function checkBrief(pr) {
  const errors = [];
  const { added, modified, deleted } = extractFileClaims(pr.body);
  const lineRefs = extractLineRefs(pr.body);

  for (const f of modified) {
    const p = resolve(REPO, f);
    if (!existsSync(p)) errors.push(`  ✗ Modified path missing: ${f}`);
  }
  for (const f of added) {
    const p = resolve(REPO, f);
    if (existsSync(p)) errors.push(`  ✗ Added path already exists: ${f}`);
  }
  for (const f of deleted) {
    const p = resolve(REPO, f);
    if (!existsSync(p)) errors.push(`  ✗ Deleted path already gone: ${f}`);
  }

  for (const ref of lineRefs) {
    const p = resolve(REPO, ref.file);
    if (!existsSync(p)) {
      errors.push(`  ✗ Line ref file missing: ${ref.file}`);
      continue;
    }
    const lines = readFileSync(p, "utf8").split("\n");
    const actual = lines[ref.line - 1] ?? "";
    // Normalise: strip whitespace, quotes, semicolons for loose match
    const norm = (s) => s.replace(/[\s;"'`]/g, "");
    if (!norm(actual).includes(norm(ref.expected))) {
      errors.push(`  ✗ ${ref.file}:${ref.line} expected ${JSON.stringify(ref.expected.slice(0, 40))}, got ${JSON.stringify(actual.trim().slice(0, 60))}`);
    }
  }

  return errors;
}

const prs = splitPRs(brief);
let totalErrors = 0;
for (const pr of prs) {
  if (filter && pr.id !== filter) continue;
  const errors = checkBrief(pr);
  if (errors.length === 0) {
    console.log(`✓ ${pr.id}`);
  } else {
    console.log(`✗ ${pr.id}`);
    for (const e of errors) console.log(e);
    totalErrors += errors.length;
  }
}

if (totalErrors > 0) {
  console.error(`\n${totalErrors} verification errors. Update briefs before executing.`);
  process.exit(1);
}
