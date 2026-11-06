# E2EE de MDs en Nexus: ruta B con Signal Protocol

## Decisión

Nexus mantendrá su propio cliente y su propia infraestructura Supabase. No se añadirá Matrix ni se dependerá de un homeserver Matrix. Supabase podrá transportar y almacenar ciphertext, bundles de claves públicas y metadatos mínimos; el cifrado y descifrado deben ocurrir en los dispositivos.

## Compatibilidad de Signal Protocol en navegador

El repositorio oficial `signalapp/libsignal` implementa componentes del Signal Protocol en Rust y expone bindings TypeScript, Java y Swift. Sin embargo, el propio proyecto indica que el uso fuera de Signal no está soportado y que sus APIs y bindings pueden cambiar. El paquete Node `@signalapp/libsignal-client` incluye prebuilds nativos `.node`, por lo que no se puede cargar directamente desde GitHub Pages como una biblioteca JavaScript de navegador. Su licencia declarada es `AGPL-3.0-only`; debe revisarse la compatibilidad con la licencia de Nexus antes de distribuir cualquier adaptación.

Referencias oficiales:
- https://github.com/signalapp/libsignal
- https://signal.org/docs/specifications/pqxdh/
- https://signal.org/docs/specifications/doubleratchet/

No portar PQXDH ni Double Ratchet a mano. No sustituir Signal por una colección improvisada de AES-GCM y claves compartidas.

## Arquitectura objetivo

1. **Identidad por dispositivo:** cada navegador/instalación genera una identidad criptográfica independiente. Supabase guarda claves públicas, bundles de prekeys y estado del dispositivo; nunca las claves privadas.
2. **Distribución de prekeys:** funciones RPC de Supabase publican y consumen prekeys atómicamente, aplicando autenticación, RLS y límites de frecuencia.
3. **Sesiones 1:1:** el cliente establece una sesión con PQXDH y usa Double Ratchet para los mensajes posteriores. Debe verificarse la identidad del otro dispositivo y avisar ante cambios de clave.
4. **Mensajes:** `public.messages` almacena ciphertext, cabecera de protocolo/versionado y metadatos mínimos. Texto, Markdown, menciones, previews y datos sensibles no deben quedar en claro.
5. **Adjuntos:** cifrado del lado del cliente con una clave por archivo. Storage solo recibe ciphertext; la clave se transmite dentro del mensaje cifrado. Miniaturas, previews y metadatos de medios también se cifran o se generan localmente.
6. **Multi-dispositivo:** cada dispositivo destinatario es un endpoint criptográfico separado. Altas, transferencias, revocación y pérdida de dispositivos requieren flujos explícitos.
7. **Recuperación:** decidir una copia de seguridad cifrada con secreto de recuperación del usuario o una alternativa equivalente. Restablecer la contraseña de Supabase no debe descifrar automáticamente las claves.
8. **Reportes:** la persona que denuncia elige revelar el mensaje y contexto; el dispositivo cifra la evidencia para las claves públicas de moderación. El servidor no puede leer silenciosamente mensajes denunciados.
9. **Notificaciones:** notificaciones genéricas, sin contenido del mensaje.

## Fase de viabilidad necesaria

Antes de implementar hay que resolver si se puede producir una build browser/WASM mantenible de una implementación compatible con Signal Protocol, revisar licencias, dependencias, almacenamiento seguro de claves en navegadores y soporte WebCrypto/IndexedDB. Si la biblioteca oficial no es portable sin cambios importantes, no debe publicarse una adaptación no auditada como si fuera Signal oficial.

## Bloqueo de lanzamiento

No habilitar ni anunciar E2EE hasta disponer de:
- binding WASM/browser mantenido y revisión de licencia;
- pruebas de interoperabilidad y vectores de prueba del protocolo;
- pruebas de mensajes perdidos, duplicados, reordenados y replay;
- verificación de identidades y avisos de cambio de claves;
- alta, transferencia, revocación y pérdida de dispositivos;
- cifrado completo de adjuntos, miniaturas y contenido auxiliar;
- flujos de reportes voluntarios cifrados para moderación;
- revisión criptográfica independiente y pruebas de seguridad.

**Estado de Nexus v0.11.1-alpha2:** diseño/viabilidad. Los MDs siguen sin E2EE activo. HTTPS/TLS y el cifrado en reposo de Supabase no equivalen a E2EE.
