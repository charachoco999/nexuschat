# CSS de megagrupos — Nexus v0.8

El CSS personalizado se limita al megagrupo seleccionado. No se permite acceder a toda la página ni modificar la interfaz global de Nexus.

## Selectores admitidos

### Página y portada

- `#view-community`
- `.community-hero`, `.community-hero-copy`, `.community-hero .eyebrow`
- `.community-hero h1`, `.community-hero p`, `.community-hero .button`, `.community-hero .button:hover`
- `#community-name`, `#community-description`

### Paneles e información

- `.community-info-grid`, `.community-info-grid .surface`
- `.community-info-grid .surface h2`, `.community-info-grid .surface p`
- `.community-info-grid .eyebrow`, `.community-info-grid h2`
- `.settings-surface`, `.settings-surface .surface-heading`

### Chat de canales

Cuando abres un canal de un megagrupo, también puedes personalizar su chat sin afectar a MDs ni a otros megagrupos:

- `#conversation-panel`
- `.active-conversation`
- `.conversation-head`, `.conversation-head strong`, `.conversation-head small`
- `.messages`, `.message`, `.message-body`, `.message-author`, `.message-meta`
- `.message-reply-quote`, `.message-reactions`, `.message-attachment`
- `.composer-wrap`, `.composer`, `.composer textarea`, `.composer-send`
- `.pinned-messages`, `.poll-card`, `.poll-option`
- `.context-online-members`, `.presence-member-chip`

Estas reglas se aplican solamente cuando está abierto un canal de ese megagrupo. El contenedor recibe una clase de ámbito y el CSS no afecta a conversaciones privadas ni a otras comunidades.

### Roles y medallas

- `#community-roles-area`, `#community-badges-area`
- `.role-card`, `.role-card:hover`, `.role-card-head`, `.role-card-actions`
- `.permission-grid`, `.member-role-card`, `.member-role-card:hover`
- `.badge-create-form`, `.community-invite-result`, `.invite-tools`

### Barra lateral de canales

- `#sidebar-community`
- `.channel-row` (se aplica a la barra lateral de comunidades)
- `#sidebar-community .channel-item`, `.channel-item.active`, `.channel-item:hover`, `.channel-item:focus-visible`
- `#sidebar-community .channel-hash`, `.channel-item-name`, `.channel-type-mini`
- `#sidebar-community .channel-admin-actions`, `.section-label`

## Propiedades admitidas

`color`, `background`, `background-color`, `background-image` (solo gradientes sin URL), `background-position`, `background-size`, `background-repeat`, `border`, `border-color`, `border-radius`, `border-width`, `border-style`, `border-top`, `border-right`, `border-bottom`, `border-left`, `box-shadow`, `text-shadow`, `outline`, `outline-color`, `outline-width`, `outline-style`, `font-family`, `font-size`, `font-weight`, `letter-spacing`, `line-height`, `text-align`, `text-transform`, `text-decoration`, `padding`, `margin`, `opacity`, `width`, `max-width`, `min-width`, `height`, `min-height`, `gap`, `row-gap`, `column-gap`, `grid-template-columns`, `display`, `align-items`, `justify-content`, `flex-direction`, `flex-wrap`, `flex`, `flex-grow`, `flex-shrink`, `overflow`, `white-space`, `text-overflow`, `box-sizing`, `vertical-align`, `place-items`, `isolation`, `filter`, `backdrop-filter`, `transform`, `transition`, `cursor` y las variables `--community-accent`, `--community-accent-soft`, `--community-panel`, `--community-panel-alt`, `--community-text`, `--community-muted`, `--community-border`, `--community-glow` y `--community-radius`.

## Ejemplo: Nexus Official

```css
#view-community {
  --community-accent: #a78bfa;
  --community-panel: #15172a;
  --community-glow: rgba(139, 92, 246, .28);
}

.community-hero {
  background: linear-gradient(125deg, #211b42, #121a30);
  border: 1px solid #8b5cf6;
  border-radius: 22px;
  box-shadow: 0 18px 48px var(--community-glow);
  padding: 30px;
}

#community-name {
  color: #eee8ff;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -1px;
}

#community-description {
  color: #c5c9e2;
  font-size: 14px;
  line-height: 1.7;
}

.community-info-grid .surface {
  background: var(--community-panel);
  border: 1px solid #ffffff18;
  border-radius: 16px;
  box-shadow: 0 8px 28px #05071466;
  padding: 20px;
}

.community-info-grid h2 {
  color: var(--community-accent);
  font-size: 22px;
  font-weight: 800;
}

#sidebar-community .channel-item.active {
  background: #34285b;
  border: 1px solid #a78bfa;
  border-radius: 10px;
  box-shadow: 0 0 18px var(--community-glow);
}

.message {
  border-radius: 13px;
}

.composer-wrap {
  background: var(--community-panel);
  border: 1px solid var(--community-accent);
  border-radius: 15px;
}
```

## Reglas y límites de seguridad

- Máximo de 8.000 caracteres.
- Se aceptan reglas sencillas `selector { propiedad: valor; }`.
- No se aceptan bloques `:root`, `@media`, `@import`, `@font-face`, `url()`, selectores globales, comentarios ni scripts.
- Las fuentes no se pueden descargar desde CSS; usa la personalización de fuentes del perfil.
- Las propiedades se aplican con un prefijo de ámbito al megagrupo y, para el chat, solamente al panel del canal activo.
- Los nombres de fuentes pueden ir entre comillas. No se admiten llaves, punto y coma ni barras invertidas dentro de valores.
