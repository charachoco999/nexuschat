#!/usr/bin/env node
/**
 * Nexus localization audit.
 *
 * Usage:
 *   node scripts/check-i18n.mjs
 *   node scripts/check-i18n.mjs --require-complete
 *
 * The check validates every catalogue value in every locale and simulates
 * the runtime's exact-key plus longest-fragment translation for visible
 * static strings. The baseline contains deliberate exceptions such as brand
 * names, feature identifiers, code examples and demonstration values.
 * --require-complete also fails while any such deliberate exception remains.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const i18nPath = path.join(root, 'assets/i18n/i18n.js');
const extraCatalogPath = path.join(root, 'assets/i18n/catalog-extra-v0.12.js');
const htmlPath = path.join(root, 'index.html');
const appPath = path.join(root, 'assets/js/app.js');
const baselinePath = path.join(root, 'scripts/i18n-alpha2-untranslated-baseline.json');
const source = fs.readFileSync(i18nPath, 'utf8');
const extraCatalogSource = fs.readFileSync(extraCatalogPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const appSource = fs.readFileSync(appPath, 'utf8');
const intentionalBaseline = new Set(JSON.parse(fs.readFileSync(baselinePath, 'utf8')));

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

const extraCatalogMatch = extraCatalogSource.match(/Object\.assign\(api\.catalog, ([\s\S]*?)\);/);
if (!extraCatalogMatch) {
  console.error('ERROR: Could not locate the extended catalogue in assets/i18n/catalog-extra-v0.12.js.');
  process.exit(2);
}
try {
  Object.assign(catalog, JSON.parse(extraCatalogMatch[1]));
} catch (error) {
  console.error('ERROR: Extended catalogue is not valid JSON:', error.message);
  process.exit(2);
}

const keys = Object.keys(catalog);
const locales = localeCodes.filter(code => code !== 'es');
const missing = [];
for (const key of keys) {
  for (const locale of locales) {
    const value = catalog[key]?.[locale];
    if (typeof value !== 'string' || !value.trim()) missing.push({ key, locale });
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
const appStrings = new Set();
const uiSinkPattern = /(?:textContent|innerHTML|placeholder|title|aria-label|toast|showError|ask|nexusConfirm|confirm|alert)\s*(?:=|,|\()\s*(['"`])([\s\S]*?)\1/g;
for (const match of appSource.matchAll(uiSinkPattern)) {
  const value = normalize(match[2]);
  if (value.length > 2) appStrings.add(value);
}
const candidates = new Set([...htmlStrings, ...appStrings]);

function translateForAudit(sourceText, locale) {
  const exact = catalog[sourceText]?.[locale];
  if (exact) return exact;
  let result = sourceText;
  const entries = Object.entries(catalog)
    .filter(([key, value]) => key.length > 3 && value?.[locale])
    .sort((a, b) => b[0].length - a[0].length);
  for (const [key, value] of entries) {
    if (result.includes(key)) result = result.split(key).join(value[locale]);
  }
  return result;
}

const unchanged = [...candidates].filter(value =>
  !value.startsWith('<') &&
  !value.includes('${') &&
  !/^https?:/.test(value) &&
  !/^\{.*\}$/.test(value) &&
  !/^(?:[#*\x60>|-]|\{\{)/.test(value) &&
  locales.every(locale => translateForAudit(value, locale) === value)
);
const newUnchanged = unchanged.filter(value => !intentionalBaseline.has(value));

console.log(`Nexus i18n catalog: ${keys.length} source keys, ${locales.length} target locales, ${keys.length * locales.length} expected translations.`);
console.log(`Catalog gaps: ${missing.length}.`);
console.log(`Static HTML + JavaScript UI-sink audit: ${candidates.size} unique strings, ${unchanged.length} intentionally untranslated values, ${newUnchanged.length} new untranslated values.`);

if (missing.length) {
  console.error('Missing catalog translations (first 40):');
  for (const item of missing.slice(0, 40)) console.error(`  [${item.locale}] ${item.key}`);
}
if (newUnchanged.length) {
  console.error('New untranslated UI strings (first 40):');
  for (const value of newUnchanged.slice(0, 40)) console.error(`  ${value}`);
}
if (process.argv.includes('--require-complete') && unchanged.length) {
  console.error('Intentional exceptions still remaining (first 40):');
  for (const value of unchanged.slice(0, 40)) console.error(`  ${value}`);
}

if (missing.length || newUnchanged.length || (process.argv.includes('--require-complete') && unchanged.length)) {
  process.exitCode = 1;
}
