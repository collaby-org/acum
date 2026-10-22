# Example files

Copy these into your project as needed. Path mapping:

| This file                | Copy to (in your project)                       |
| ------------------------ | ----------------------------------------------- |
| `config.ts`              | `src/config/map-config.ts` or similar           |
| `geo-utils.ts`           | `src/lib/geo-utils.ts`                          |
| `ECEFtoENU.tsx`          | `src/components/map/ECEFtoENU.tsx` or in scene  |
| `TilesScene.example.tsx` | `src/components/map/TilesScene.tsx` (rename)    |
| `page.example.tsx`       | `src/app/page.tsx` or your route (snippet only) |

- Use **one** `SCENE_ORIGIN` (or `TOKYO_CENTER` etc.) for both `createECEFtoENUMatrix` / `TilesTransformer` and all `latLngAltToENU` / `enuToLatLngAlt` calls.
- Adjust imports (e.g. `@/config/map-config`) to match your alias.
