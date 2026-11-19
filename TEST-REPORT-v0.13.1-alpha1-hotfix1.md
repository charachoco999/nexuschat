# Nexus v0.13.1-alpha1-hotfix1 — informe de comprobaciones

## Ejecutado

- Parche del cliente: se envía `File.size` en la solicitud de subida.
- Parche del Worker: se valida el tamaño y se usa `FixedLengthStream` para R2.
- Se mantienen los límites por bucket y la comprobación del número de bytes recibidos.

## No ejecutado

- No se ha probado una subida real de imagen/audio/documento desde el navegador.
- No se ha probado la descarga posterior ni el flujo en móvil.
- No se ha desplegado el Worker en la cuenta real de Cloudflare desde este cambio.

La verificación final requiere desplegar ambos componentes y realizar las pruebas de subida descritas en el upgrade.
