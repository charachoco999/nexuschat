# Estado del cifrado de extremo a extremo (E2EE) — Nexus v0.11.1-alpha1

## Estado actual: NO IMPLEMENTADO

Los mensajes directos de Nexus **no están cifrados de extremo a extremo** en esta versión. El contenido viaja por HTTPS/TLS y se almacena usando la infraestructura y los permisos del proyecto Supabase, pero eso no impide que el operador del proyecto o una persona con acceso administrativo suficiente al backend pueda acceder técnicamente a esos datos.

No presentes Nexus v0.11.1 como un servicio E2EE y no introduzcas información cuya confidencialidad dependa de E2EE.

## Por qué no se ha añadido un cifrado casero

Un `AES-GCM` aislado en el navegador no basta para ofrecer un protocolo de mensajería E2EE completo. Harían falta, como mínimo:

- Identidad criptográfica por dispositivo y un proceso de verificación de claves entre personas.
- Intercambio seguro de claves, claves de un solo uso y rotación.
- Un protocolo de ratchet con secreto hacia adelante y recuperación tras compromiso de claves.
- Añadir y retirar dispositivos sin exponer el historial.
- Cifrado de adjuntos, imágenes, audio, vídeo y metadatos sensibles.
- Almacenamiento, copia de seguridad y recuperación de claves sin una puerta trasera del servidor.
- Pruebas de interoperabilidad, análisis del modelo de amenazas y revisión criptográfica independiente.
- Una integración explícita con reportes: al denunciar, la persona que reporta debe poder consentir la revelación del mensaje y del contexto al equipo de moderación. El backend no puede leer mensajes cifrados para crear ese contexto por su cuenta.

El JavaScript que sirve la propia web forma parte de la superficie de confianza: una actualización maliciosa o un XSS del mismo origen puede intentar capturar texto antes de cifrarlo o después de descifrarlo. Por eso E2EE en un cliente web también exige una cadena de publicación, protección contra XSS y revisión de dependencias muy estrictas.

## Siguiente fase recomendada

1. Seleccionar una implementación de protocolo mantenida y adecuada para navegador y multi-dispositivo. No escribir primitives criptográficas ni un ratchet propio.
2. Definir el modelo de amenazas y qué metadatos quedan visibles (miembros, hora, tamaño, presencia y notificaciones).
3. Diseñar el alta y verificación de dispositivos, rotación, revocación, recuperación y cambio de claves.
4. Diseñar cifrado de adjuntos con claves independientes y carga privada.
5. Diseñar reportes voluntarios: el cliente descifra el fragmento autorizado y lo sube como evidencia después de mostrar claramente qué se comparte.
6. Probar con varias cuentas y dispositivos, revisar el protocolo y el código con especialistas independientes y completar pruebas de seguridad antes de activar la función.

Referencias técnicas para evaluación, no una afirmación de que Nexus ya las integre:

- Signal Protocol: https://signal.org/docs/
- Open E2EE browser threat model: https://docs.open-e2ee.dev/start/browser
- Open E2EE SDK status: https://docs.open-e2ee.dev/

La disponibilidad de una biblioteca no equivale a una auditoría ni a una integración segura. La función deberá permanecer desactivada hasta superar las fases anteriores.
