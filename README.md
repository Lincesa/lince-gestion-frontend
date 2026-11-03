# lince-web — Frontend de Lince gestión integral

Aplicación web (SPA) del sistema Lince. React 18 + Vite + TypeScript, con Redux Toolkit, React Router y Tailwind.

- Backend: `../lince-platform/` (API NestJS, repo separado).
- App mobile de choferes y dueños de transporte: `../lince_driver/`.
- Producción: https://gestion.lincesa.com.ar (Netlify).

---

## Módulos

El menú lateral sale de `src/modules/registry.ts` (`APP_MODULE_NAV`); las rutas, de `src/router/index.tsx`.

| Menú | Ruta | Contenido |
|------|------|-----------|
| Inicio | `/` | Dashboard |
| CRM | `/crm` | Clientes, analítica, satisfacción |
| Conciliaciones | `/conciliaciones` | Conciliaciones bancarias: corridas, detalle, categorías |
| OCR | `/ocr` | Remitos, facturas, retenciones, configuración |
| Mensajes y seguimiento | `/marketing` | Campañas, mensajes directos, seguimiento, panel YCloud |
| Soporte IT | `/soporte-it` | Equipos y soporte interno |
| RRHH | `/rrhh` | Asistencia (fichajes), calendario laboral |
| Logística | `/logistica` | Remitos, transportes, mapa, combustible, documentación, usuarios de campo, viajes |
| Admin | `/admin` | Panel SUPERADMIN |

---

## Requisitos

- Node 20 (es la versión que usa el build de Netlify).
- pnpm (el repo tiene `pnpm-lock.yaml`).

## Comandos

```sh
pnpm install

pnpm dev          # servidor de desarrollo de Vite
pnpm build        # tsc --noEmit + vite build (salida en dist/)
pnpm preview      # sirve el build local
pnpm check-types  # solo verificación de tipos
pnpm test         # vitest run
```

El alias `@` apunta a `src/` (configurado en `vite.config.ts` y `vitest.config.ts`).

## Variables de entorno

Hay un `.env.example` en la raíz como referencia. La app lee una sola variable:

| Variable | Uso |
|----------|-----|
| `VITE_API_URL` | URL base del backend. Si falta, usa `http://localhost:3001`. Si no termina en `/api`, se le agrega (`src/api/client.ts`). |

Todas las llamadas pasan por `apiFetch` en `src/api/client.ts`, que agrega el JWT y hace un único refresh compartido cuando el token vence.

Como es una variable `VITE_*`, se resuelve en tiempo de build: cambiarla en Netlify requiere un nuevo deploy.

---

## Tests

- Runner: **Vitest**. Incluye `src/**/*.test.{ts,tsx}` (`vitest.config.ts`).
- No hay jsdom ni Testing Library entre las dependencias: los tests corren en entorno Node.
- Los tests de componentes usan `renderToStaticMarkup` de `react-dom/server` o llaman a la función del componente directamente (ver `src/components/ui/Switch.test.tsx`).
- La lógica de decisión se separa en funciones puras para poder testearla sin Redux ni DOM (por ejemplo `src/router/fieldJail.ts`).

---

## Estructura

```
src/
  api/          clientes HTTP por módulo (client.ts = apiFetch + refresh de JWT)
  auth/         helpers de perfil de usuario (isFieldUser, isTransportUser)
  components/   layout, sidebar y componentes por módulo (ui/ = genéricos)
  config/       feature flags (features.ts)
  constants/    constantes de dominio
  hooks/        useCanPerform, adjuntos, geolocalización, comentarios de remitos
  modules/      registro del menú (registry.ts)
  pages/        páginas por módulo
  permissions/  reglas de permisos específicas (Soporte IT)
  router/       rutas y guards (PrivateRoute, RequireModule, RequireRole, fieldJail)
  store/        Redux Toolkit, un slice por módulo
  types/        tipos compartidos con el contrato de la API
  utils/        lógica pura reutilizable (con sus tests)
```

---

## Permisos

El frontend replica las reglas del backend para mostrar u ocultar; la API sigue siendo la que autoriza.

- **SUPERADMIN** (`globalRole`) ve y puede todo.
- **Acceso a un módulo**: `user.modules[moduleKey].enabled`. Lo aplican el menú (`isNavItemVisible`) y el guard de rutas `RequireModule`. Soporte IT queda abierto a todos los usuarios que no son de campo.
- **Nivel dentro del módulo**: `useCanPerform(moduleKey)` devuelve `canView`, `canEdit` y `canAdmin` según la jerarquía `VIEWER < EDITOR < ADMIN`.
- **Usuarios de campo** (perfil `TAG` o `TRANSPORTE`): `resolveFieldJailRedirect` (`src/router/fieldJail.ts`) los limita a `/ocr/remitos` y `/perfil`; los de `TRANSPORTE` además a Mi transporte (y Viajes, si está habilitado). Un rol `ADMIN` de Logística los libera de esa restricción. Si el usuario debe cambiar la contraseña, se lo redirige a `/change-password` antes que nada.

---

## Feature flags

En `src/config/features.ts`:

- `TRIPS_ENABLED` (hoy `false`): con el flag apagado se ocultan la pestaña y las rutas de Viajes en Logística, el link de Viajes para usuarios de campo (los de transporte entran a Mi transporte) y el selector de viaje al subir un remito. Las páginas, las llamadas a la API y el `tripId` guardado no se tocan: poner `true` lo restituye todo. La app de choferes tiene el mismo switch (`kTripsEnabled` en `lib/core/config.dart`).

---

## Deploy — Netlify

`netlify.toml`:

- Build: `pnpm install --frozen-lockfile && pnpm build`, publica `dist/`, Node 20.
- Redirect `/*` → `/index.html` (200) para el ruteo del lado del cliente.

Un push a `main` dispara el deploy de producción. El trabajo diario se hace en `develop`.

### Cómo verificar un deploy

Netlify **no** reporta el estado del deploy a GitHub: el commit status queda en `pending` para siempre, así que no sirve como señal. Para confirmar que el deploy salió:

1. Comprobar que cambió el bundle servido: el nombre `assets/index-*.js` que referencia https://gestion.lincesa.com.ar debe ser distinto al anterior.
2. Comprobar que el chunk lazy de la página modificada contiene el texto nuevo.
