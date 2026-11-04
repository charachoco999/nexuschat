# Nexus v0.11.0-alpha1-hotfix1 — MegaCompact layout fix

## Corrección

- La megacompactación ya no añade una fila de botones encima del menú antiguo.
- En escritorio, la barra Chats / Amigos / Workshop / Stickers y la lista de MDs comparten una única columna lateral. La conversación permanece en el panel principal.
- El menú personal y el menú de canales dejan de duplicarse durante la navegación personal compactada.
- Al cambiar a una sección personal, la lista de conversaciones vuelve a su contenedor original; al entrar en un canal de megagrupo, se restaura la navegación normal de comunidad.
- En pantallas estrechas, el diseño conserva una sola columna y muestra la barra encima de la lista de chats o de la sección activa.
- Los cambios de tamaño/orientación y la desactivación de la opción restauran los nodos a sus contenedores originales.

## Base de datos

- No requiere migraciones SQL.
- No modifica datos, permisos ni políticas RLS.

## Validación

- Comprobación de sintaxis JavaScript.
- Comprobación estática de estructura HTML/CSS y de los paquetes ZIP.
- La prueba visual final debe realizarse en el navegador del proyecto desplegado.
