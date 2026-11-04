# Migración SQL Nexus v0.11.0-alpha1-hotfix2

Ejecuta una sola vez `supabase/migrations/20261104_nexus_v0110_hotfix2_global_notice_reads_multi_delivery.sql` después de la migración principal de 0.11. No requiere ejecutar otra migración intermedia de hotfix.

Crea la tabla privada `nexus_important_announcement_reads` para registrar por cuenta los avisos globales descartados y reitera la RPC `publish_nexus_community_announcement`, que admite uno, varios o todos los megagrupos. El aviso se inserta como mensaje real de Nexus (App) en los canales suscritos. No reenvía registros históricos.
