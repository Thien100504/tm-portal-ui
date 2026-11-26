#!/usr/bin/env node
// Checks that every API call made by the UI (method + path) exists in the
// portal-api OpenAPI spec. Usage:
//   node scripts/check-api-contract.mjs --openapi openapi.json [--src src]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, all) => {
    if (arg.startsWith('--'))
      acc.push([arg.slice(2), all[i + 1]?.startsWith('--') ? true : (all[i + 1] ?? true)]);
    return acc;
  }, [])
);
if (!args.openapi) {
  console.error('usage: check-api-contract.mjs --openapi <openapi.json> [--src <dir>]');
  process.exit(2);
}

const API_PREFIX = '/api/v1';
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const HOLE = '\u0000';

const spec = JSON.parse(readFileSync(args.openapi, 'utf8'));
const endpoints = Object.entries(spec.paths).flatMap(([path, ops]) =>
  Object.keys(ops)
    .filter((m) => METHODS.includes(m))
    .map((method) => ({ method: method.toUpperCase(), path, segments: split(path) }))
);

function split(path) {
  return path.replace(/\/+$/, '').split('/').filter(Boolean);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(js|jsx|ts|tsx)$/.test(name) ? [full] : [];
  });
}

// Turn a JS string/template literal into a normalized API path, or null when
// the path is fully dynamic and cannot be checked statically.
function normalize(literal) {
  let path = literal.slice(1, -1);
  path = path.replace(/^\$\{(API_BASE_URL|API_BASE)\}/, '');
  if (path.startsWith('${')) return null;
  path = path.replace(/\$\{[^}]*\}/g, HOLE).split('?')[0];
  if (!path.startsWith(API_PREFIX)) path = API_PREFIX + (path.startsWith('/') ? '' : '/') + path;
  // a template glued to the last literal segment is a query string (`/tasks${qs}`)
  return path.replace(new RegExp(`(?<=[^/])${HOLE}$`), '');
}

function matches(callSegments, endpoint) {
  if (callSegments.length !== endpoint.segments.length) return false;
  return callSegments.every((seg, i) => {
    const spec = endpoint.segments[i];
    return seg.includes(HOLE) || /^\{.+\}$/.test(spec) || seg === spec;
  });
}

const CALL = /\b(?:api|axios)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
const FETCH = /\bfetch\s*\(\s*(`[^`]*`|'[^']*'|"[^"]*")([\s\S]{0,400}?)\)/g;

const srcDir = args.src && args.src !== true ? args.src : 'src';
const calls = [];
for (const file of walk(srcDir)) {
  const code = readFileSync(file, 'utf8');
  const line = (index) => code.slice(0, index).split('\n').length;
  for (const m of code.matchAll(CALL)) {
    calls.push({ file, line: line(m.index), method: m[1].toUpperCase(), literal: m[2] });
  }
  for (const m of code.matchAll(FETCH)) {
    if (!/API_BASE|\/api\//.test(m[1])) continue;
    const method = (m[2].match(/method:\s*['"](\w+)['"]/) || [])[1] || 'GET';
    calls.push({ file, line: line(m.index), method: method.toUpperCase(), literal: m[1] });
  }
}

const missing = [];
let checked = 0;
let skipped = 0;
for (const call of calls) {
  const path = normalize(call.literal);
  if (path === null) {
    skipped++;
    continue;
  }
  checked++;
  const segments = split(path);
  const samePath = endpoints.filter((e) => matches(segments, e));
  if (!samePath.some((e) => e.method === call.method)) {
    const where = `${relative(process.cwd(), call.file)}:${call.line}`;
    const hint = samePath.length
      ? `path exists for ${[...new Set(samePath.map((e) => e.method))].join(', ')}`
      : 'no such path';
    missing.push(`  ${call.method.padEnd(6)} ${path.replaceAll(HOLE, '{…}')}  (${where}; ${hint})`);
  }
}

console.log(
  `API contract: ${checked} calls checked against ${endpoints.length} endpoints, ${skipped} dynamic calls skipped.`
);
if (missing.length) {
  console.log(
    `\n${missing.length} call(s) do not match any endpoint in the API spec:\n${missing.join('\n')}`
  );
  process.exit(args['report-only'] ? 0 : 1);
}
console.log('All UI calls match the API spec.');
