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

A scan of visible text in `index.html` and common UI text sinks in `assets/js/app.js` found no remaining ordinary prose strings that stay untranslated across all target locales. The remaining untranslated values are intentional: product/feature names, font family names, Markdown/CSS syntax examples, code fragments, and demonstration values such as sample addresses or channel names.

This is a static audit, not a substitute for exercising every screen with live data. It does not certify every dynamically composed message or every visual layout.

## Important limitations

- Guarani (`gn`) and Latin (`la`) are beta translations and need competent human review.
- The Spanish Terms of Service remain the authoritative legal text. Other languages must not be treated as legally reviewed equivalents.
- A full manual visual pass on desktop and mobile has not been completed.

## Update package safety

The update package intentionally excludes `assets/js/config.js`. It contains no Supabase schema changes and requires no Supabase migration for localization.
