# Nexus v0.11.1-alpha2

## Idiomas e interfaz
- Añadido sistema de localización offline-first con 15 variantes: Español, Inglés, Esloveno, Italiano, Francés, Japonés, Chino simplificado, Alemán, Portugués, Guaraní (beta), Catalán, Gallego, Euskera, Latín (beta) y Español (Julio Verne, Easter egg).
- Selector disponible antes de iniciar sesión, en Configuración y en la pantalla de aceptación legal.
- La elección previa al inicio de sesión tiene prioridad durante ese acceso; al guardar Configuración, el idioma se sincroniza también en `profiles.settings.language`.
- Localización de 101 cadenas de interfaz de uso frecuente y fechas mediante `Intl`. Los textos no traducidos usan el español como fallback; esta alpha todavía no cubre todas las cadenas estáticas ni todos los mensajes dinámicos.
- El texto de Julio Verne es original y lúdico; no cambia etiquetas de permisos, seguridad ni decisiones legales.

## ToS y popups
- Incorporado como documento canónico el texto de condiciones de uso y privacidad proporcionado para Nexus, versión `2026-11-06-v2`.
- Huella SHA-256 del documento: `f0f2322c78f8a4daf53335bf64017f60c74de4230f57d6df9b49a8184fccd8dd`.
- Actualizadas las RPC de aceptación y estado legal, además de `nexus_has_current_terms()`, para exigir la nueva versión y huella.
- Las cuentas que aceptaron la versión anterior reciben un diálogo que identifica la actualización; las cuentas sin aceptación reciben el diálogo de primer acceso.
- Ninguna aceptación se registra automáticamente. El popup de novedades se versiona como `0.11.1-alpha2`.
- El documento legal sigue en español como versión autoritativa. El selector cambia el idioma de la interfaz, no traduce jurídicamente el documento.

## E2EE: decisión de arquitectura
- Elegida la ruta B: investigar Signal Protocol en los clientes y mantener Supabase como transporte y almacenamiento de ciphertext/prekeys públicas, sin usar servidores Matrix.
- La viabilidad oficial de `libsignal` en un navegador está pendiente: el paquete publicado es un binding nativo Node, el proyecto declara que el uso externo a Signal no está soportado y utiliza AGPL-3.0-only.
- No se ha activado E2EE ni se ha implementado criptografía propia. Los MDs siguen sin cifrado de extremo a extremo. Ver `E2EE-SIGNAL-ROADMAP-v0.11.1-alpha2.md`.

## Pendiente conocido
- Completar traducciones de toda la interfaz, paneles administrativos, errores, ayuda y contenido dinámico; revisión humana de Guaraní y Latín.
- Revisión jurídica del ToS y de los datos de contacto antes de producción.
- Implementación y auditoría de E2EE real antes de anunciarlo como disponible.
