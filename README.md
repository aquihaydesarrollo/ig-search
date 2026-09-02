# IG Search

Radar diario de leads locales y asistente de Instagram para **Aquí Hay Marketing** (Murcia).

Cada noche rastrea negocios de la zona, audita su web, mide su Instagram y entrega
por la mañana una lista corta de acciones priorizadas. Las interacciones las ejecuta
una persona en 10-15 minutos.

## Por qué no automatiza likes ni seguimientos

Instagram no ofrece ninguna API para dar "me gusta" ni seguir cuentas. Hacerlo obliga
a simular un dispositivo, algo que Meta detecta y castiga limitando el alcance,
bloqueando acciones o cerrando la cuenta y el Business Manager asociado.

Esta herramienta automatiza la investigación, que es lo que consume tiempo, y deja el
clic final a una persona. El resultado es mejor: un comentario con contexto real
convierte; un like de bot, no.

## Dependencias externas

| Servicio | Para qué | ¿Obligatorio? | Coste |
|---|---|---|---|
| OpenStreetMap (Overpass) | Descubrir negocios locales | Sí | Gratis, sin cuenta |
| Meta Graph API | Datos de Instagram | No | Gratis, requiere token |

Sin Google. Sin base de datos externa: SQLite en un fichero.
Sin el token de Meta el radar funciona igual, pero se queda sin ningún dato de Instagram.

## Qué hace

| Módulo | Qué resuelve |
|---|---|
| **Radar de leads** | Descubre negocios en OpenStreetMap, audita su web y localiza su Instagram. Los puntúa por oportunidad comercial. |
| **Tareas de hoy** | Lista diaria de a quién comentar, seguir o revisar, con el motivo y enlace directo. |
| **Competencia** | Ritmo, engagement y mejores publicaciones de las agencias rivales. |
| **Métricas** | Evolución de la cuenta propia cruzada con las acciones realizadas. |

### Qué detecta la auditoría de web

Sin servicios externos: web caída o inexistente, sin HTTPS, sin versión móvil, lenta,
HTML pesado, hecha con Wix/Jimdo/GoDaddy y similares, copyright de hace años (web
abandonada), sin título ni meta descripción, HTML anticuado y restos de Flash.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local     # opcional: solo si vas a usar Instagram
npm run db:init
npm run radar                  # primer barrido, tarda 15-25 minutos
npm run dev                    # panel en http://localhost:3000
```

### Configurar el radar

Edita `config/radar.json`:

- `ciudad`, `coordenadas` y `radioKm` — la zona de acción
- `sectores` — claves del catálogo de `src/lib/osm.ts`
- `sectoresPrioritarios` — los que más interesan (suman puntos)
- `competidores` — perfiles de Instagram de las agencias rivales, sin @
- `limitesDiarios` — acciones por día, deliberadamente conservadoras
- `scoring` — cuánto pesa cada señal

### Conectar Instagram (opcional)

1. La cuenta debe ser **profesional** y estar vinculada a una página de Facebook.
2. En [Meta for Developers](https://developers.facebook.com/): crear una app de tipo Empresa.
3. En el [Explorador de la API](https://developers.facebook.com/tools/explorer/): seleccionar
   la app, generar un token con estos permisos:
   `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`.
4. Poner `META_APP_ID`, `META_APP_SECRET` y ese token en `.env.local`.
5. Ejecutar `npm run token`: convierte el token temporal en uno de página permanente
   e imprime también el `META_IG_USER_ID`.
6. Pegar ambos valores en `.env.local`.

Usando solo tu propia cuenta, la app de Meta puede quedarse en modo desarrollo:
**no hace falta pasar App Review**.

## Producción

`next build` genera salida `standalone`. Variables mínimas:

```
DATABASE_FILE=/ruta/persistente/fuera/del/despliegue/igsearch.db
RADAR_CRON_SECRET=<cadena aleatoria>
```

`DATABASE_FILE` debe apuntar **fuera de la carpeta de la aplicación** para que la base
de datos sobreviva a las actualizaciones.

Tarea programada diaria:

```bash
curl -X POST https://TU-DOMINIO/api/radar -H "x-radar-secret: $RADAR_CRON_SECRET"
```

## Estructura

```
config/radar.json      Ciudad, sectores, competidores, límites y pesos del scoring
db/schema.sql          Esquema SQLite
scripts/db-init.mjs    Crea la base de datos
scripts/run-radar.mjs  Ejecuta el barrido (--whoami para ver la cuenta de IG)
scripts/meta-token.mjs Convierte el token temporal de Meta en permanente
src/lib/osm.ts         OpenStreetMap: catálogo de sectores y consultas Overpass
src/lib/web-audit.ts   Auditoría de la web y detección del handle de Instagram
src/lib/meta.ts        Instagram Graph API: métricas propias y Business Discovery
src/lib/scoring.ts     Puntuación de oportunidad comercial
src/lib/radar.ts       Orquestación del barrido nocturno
src/app/               Panel web
```

## Límites conocidos

- **Cobertura de OpenStreetMap.** Es colaborativo: no están todos los negocios, y los
  que están pueden tener datos incompletos. A cambio es gratis y sin ataduras. Al no
  tener reseñas, la señal de "negocio próspero" sale del teléfono, el horario publicado
  y los seguidores de Instagram.
- **Overpass es un servicio público gratuito** con límite de consultas. El radar espera
  su turno consultando `/api/status`; por eso un barrido completo tarda 15-25 minutos.
  Usar solo instancias mundiales: las regionales devuelven 200 con cero resultados.
- **La API de Meta no permite** listar seguidores ni comentaristas de cuentas ajenas.
  El panel te da el enlace al post y lo miras tú.
- **Business Discovery** solo funciona con cuentas profesionales públicas.
