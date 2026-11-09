# Nexus i18n verification · v0.12.0

Audit date: 2026-11-09

## Catalogue coverage

| Metric | Result |
|---|---:|
| Unique source keys | 893 |
| Target locales | 14 |
| Expected translated values | 12,502 |
| Missing translated values | 0 |

Target locales: `en`, `sl`, `it`, `fr`, `ja`, `zh-CN`, `de`, `pt-PT`, `gn`, `ca`, `gl`, `eu`, `la`, `es-jv`.

## Static UI audit

The static checker scans the HTML and common UI text sinks in `assets/js/app.js`. It recognizes 23 deliberate exceptions: product/brand names, feature identifiers, font names, code or Markdown examples, and demonstration values. The check passes only when there are no new untranslated candidates.

This is a static audit, not a substitute for exercising every screen with live data. A full visual pass on desktop and mobile has not been completed. Guarani (`gn`) and Latin (`la`) are beta translations and need competent human review.

## Legal text

The Spanish Terms of Service remain the authoritative legal text. Other language versions of the interface do not change the legal document or the content accepted by users.

## Update package safety

The update package intentionally excludes `assets/js/config.js`. No Supabase schema changes or SQL migrations are required.
