# IG Search

Radar diario de leads locales y asistente de Instagram para **Aquí Hay Marketing**.

Cada noche rastrea negocios de la zona, audita su web, mide su Instagram y entrega
por la mañana una lista corta de acciones priorizadas. Las interacciones las ejecuta
una persona en 10-15 minutos.

## Por qué no automatiza likes ni seguimientos

Instagram no ofrece ninguna API para dar "me gusta" ni seguir cuentas. Hacerlo obliga
a simular un dispositivo, algo que Meta detecta y castiga limitando el alcance,
bloqueando acciones o cerrando la cuenta y el Business Manager asociado.

Esta herramienta hace el trabajo que sí se puede automatizar —la investigación, que es
lo que cuesta tiempo— y deja el clic final a una persona. El resultado es mejor: un
comentario con contexto real convierte; un like de bot, no.

## Qué hace

| Módulo | Qué resuelve |
|---|---|
| **Radar de leads** | Descubre negocios locales (Google Places), audita su web y localiza su Instagram. Los puntúa por oportunidad comercial. |
| **Tareas de hoy** | Lista diaria de a quién comentar, seguir o revisar, con el motivo de cada uno y enlace directo. |
| **Competencia** | Seguimiento de las agencias locales rivales: ritmo, engagement y qué posts les funcionan. |
| **Métricas** | Evolución de la cuenta propia cruzada con las acciones realizadas. |

## Puesta en marcha

### 1. Requisitos

- Node 20 o superior
- PostgreSQL (o `docker compose up -d` para levantarlo en local)
- Cuenta de Instagram **profesional** vinculada a una página de Facebook
- Una app en [Meta for Developers](https://developers.facebook.com/) con esa cuenta como propietaria
- Clave de [Google Places API (New)](https://console.cloud.google.com/) y de PageSpeed Insights

> Al usar solo tu propia cuenta de Instagram, la app de Meta puede quedarse en modo
> desarrollo: **no hace falta pasar App Review**.

### 2. Instalación

```bash
npm install
cp .env.example .env.local     # rellena los valores
docker compose up -d           # solo si quieres Postgres en local
npm run db:init
```

### 3. Obtener el ID de la cuenta de Instagram

Con `META_ACCESS_TOKEN` ya puesto en `.env.local`:

```bash
npm run radar -- --whoami
```

Copia el `META_IG_USER_ID` que imprime.

### 4. Configurar el radar

Edita `config/radar.json`:

- `ciudad` y `radioKm` — tu zona de acción
- `sectores` — nichos a rastrear
- `sectoresPrioritarios` — los que más te interesan (suman puntos)
- `competidores` — perfiles de Instagram de las agencias rivales (sin @)
- `limitesDiarios` — acciones por día, deliberadamente conservadoras

### 5. Ejecutar

```bash
npm run radar     # barrido completo (tarda varios minutos)
npm run dev       # panel en http://localhost:3000
```

## Producción (Coolify)

1. Despliega el repositorio como aplicación Node. `next build` genera salida `standalone`.
2. Añade las variables de `.env.example` en Coolify.
3. Crea una tarea programada diaria (por ejemplo a las 05:00):

```bash
curl -X POST https://TU-DOMINIO/api/radar -H "x-radar-secret: $RADAR_CRON_SECRET"
```

## Estructura

```
config/radar.json      Ciudad, sectores, competidores, límites y pesos del scoring
db/schema.sql          Esquema de PostgreSQL
scripts/               Inicialización de BD y ejecución del radar por consola
src/lib/places.ts      Google Places API — descubrimiento de negocios
src/lib/web-audit.ts   Auditoría de la web + detección del handle de Instagram
src/lib/meta.ts        Instagram Graph API — métricas propias y Business Discovery
src/lib/scoring.ts     Puntuación de oportunidad comercial
src/lib/radar.ts       Orquestación del barrido nocturno
src/app/               Panel web
```

## Límites conocidos

- La API oficial no permite listar seguidores ni comentaristas de cuentas ajenas.
  Para eso el panel te da el enlace directo al post y lo miras tú.
- Business Discovery solo funciona con cuentas profesionales públicas.
- Google Places cobra por consulta: los resultados se cachean y se refrescan por lotes.
- PageSpeed es lento (15-30 s por web), así que solo se aplica a los 20 mejores leads.
