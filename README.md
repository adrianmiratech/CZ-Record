# Bot de Tickets

## Configuracion previa (obligatoria)

1. Abre `config.json` y sustituye:
   - `supportRoleIds`: ID(s) del rol de staff que debe ver los tickets.
   - `categoryId` de cada categoria en `categories`: el ID de la categoria de Discord donde se creara ese tipo de ticket.
   - Puedes anadir, quitar o editar categorias libremente (cada una necesita `id`, `label`, `description`, `emoji`, `categoryId`).
2. En `.env`, rellena `GUILD_ID` con el ID de tu servidor para que los comandos se registren al instante (si lo dejas vacio, tardan hasta 1 hora en aparecer).

## Instalacion y arranque

```
npm install
npm run deploy-commands
npm start
```

## Uso

1. Ejecuta `/enviar-panel` (requiere permiso de Gestionar Canales) en cualquier canal: el panel se enviara automaticamente al canal configurado en `panelChannelId` (por defecto `1501974311693717524`).
2. Los usuarios eligen una categoria en el menu desplegable y se les crea un canal de ticket privado dentro de la categoria de Discord correspondiente, nombrado `ticket-<categoria>-<usuario>`.
3. Dentro del ticket, cualquier miembro del staff (o el propio autor) puede pulsar "Cerrar Ticket" o usar `/cerrar-ticket`, confirmar, y el canal se elimina a los 5 segundos.

## Notas de seguridad

- El token del bot vive en `.env`, que esta en `.gitignore` y nunca debe subirse a un repositorio ni compartirse.
- Como el token se comparto en texto plano durante la creacion de este bot, se recomienda regenerarlo desde el Discord Developer Portal (Bot > Reset Token) y actualizar `.env` con el nuevo valor.
