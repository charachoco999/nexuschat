#!/usr/bin/env node
/**
 * Nexus localization audit.
 *
 * Usage:
 *   node scripts/check-i18n.mjs
 *   node scripts/check-i18n.mjs --require-complete
 *
 * The regular check guarantees that every existing catalog key is translated
 * in every configured locale. --require-complete additionally fails when
 * visible static copy in index.html is not represented in the catalog. That
 * stricter mode is intentionally reserved for the localization release while
 * the existing Spanish-first UI is being inventoried.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const i18nPath = path.join(root, 'assets/i18n/i18n.js');
const htmlPath = path.join(root, 'index.html');
const source = fs.readFileSync(i18nPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

const localeCodes = [...source.matchAll(/\{code:'([^']+)'/g)].map(match => match[1]);
const catalogMatch = source.match(/const CATALOG = (\{[\s\S]*?\});\s*const STORAGE_KEY/);
if (!catalogMatch) {
  console.error('ERROR: Could not locate the CATALOG object in assets/i18n/i18n.js.');
  process.exit(2);
}

let catalog;
try {
  catalog = JSON.parse(catalogMatch[1]);
} catch (error) {
  console.error('ERROR: CATALOG is not valid JSON:', error.message);
  process.exit(2);
}

const keys = Object.keys(catalog);
const locales = localeCodes.filter(code => code !== 'es');
const missing = [];
for (const key of keys) {
  for (const locale of locales) {
    const value = catalog[key]?.[locale];
    if (typeof value !== 'string' || !value.trim()) {
      missing.push({ key, locale });
    }
  }
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
function normalize(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

const visibleHtml = html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
const htmlStrings = new Set();
for (const match of visibleHtml.matchAll(/>([^<>]+)</g)) {
  const value = normalize(match[1]);
  if (value.length > 2 && !/^[\d\s.,:;!?/()\-+%#@·…]+$/.test(value)) htmlStrings.add(value);
}
for (const match of visibleHtml.matchAll(/\b(?:placeholder|title|aria-label|alt)=["']([^"']+)["']/gi)) {
  const value = normalize(match[1]);
  if (value.length > 2) htmlStrings.add(value);
}
const uncovered = [...htmlStrings].filter(value => !Object.hasOwn(catalog, value));

console.log(`Nexus i18n catalog: ${keys.length} source keys, ${locales.length} target locales, ${keys.length * locales.length} expected translations.`);
console.log(`Catalog gaps: ${missing.length}.`);
console.log(`Static index.html audit: ${htmlStrings.size} unique visible strings, ${uncovered.length} not yet in the catalog.`);

if (missing.length) {
  console.error('Missing catalog translations (first 40):');
  for (const item of missing.slice(0, 40)) console.error(`  [${item.locale}] ${item.key}`);
}
if (uncovered.length) {
  console.log('Uncatalogued static strings (first 40):');
  for (const value of uncovered.slice(0, 40)) console.log(`  ${value}`);
}

if (missing.length || (process.argv.includes('--require-complete') && uncovered.length)) {
  process.exitCode = 1;
}
