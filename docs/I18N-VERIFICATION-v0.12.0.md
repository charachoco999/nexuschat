# Nexus i18n verification · v0.12.0

Audit date: 2026-11-09

## Catalogue coverage

| Metric | Result |
|---|---:|
| Unique source keys | 885 |
| Target locales | 14 |
| Expected translated values | 12,390 |
| Missing translated values | 0 |

Target locales: `en`, `sl`, `it`, `fr`, `ja`, `zh-CN`, `de`, `pt-PT`, `gn`, `ca`, `gl`, `eu`, `la`, `es-jv`.

## Static UI audit

A scan of visible text in `index.html` and common UI text sinks in `assets/js/app.js` found 23 values that intentionally remain unchanged in all target locales. They are brand/product or feature identifiers, font family names, Markdown/CSS syntax examples, code fragments, and demonstration values such as sample email addresses or channel names. No ordinary UI prose remains untranslated in this static scan.

The checker now simulates the runtime's exact-key and longest-fragment translation. It fails on any new visible string left untranslated across all locales. Its optional `--require-complete` mode also fails until the 23 deliberate exceptions are removed. This is a static audit, not a substitute for exercising every screen with live data; it does not certify every dynamically composed message or visual layout.

## Important limitations

- Guarani (`gn`) and Latin (`la`) are beta translations and need competent human review.
- The Spanish Terms of Service remain the authoritative legal text. Other languages must not be treated as legally reviewed equivalents.
- A full manual visual pass on desktop and mobile has not been completed.

## Update package safety

The update package intentionally excludes `assets/js/config.js`. It contains no Supabase schema changes and requires no Supabase migration for localization.
