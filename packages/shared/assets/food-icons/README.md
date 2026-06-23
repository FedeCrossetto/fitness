# Iconos de alimentos (shared)

PNG únicos para web y mobile. El catálogo vive en `packages/shared/src/nutrition/foodIconCatalog.json`.

Al agregar un icono:
1. Copiá el PNG en esta carpeta.
2. Agregá la entrada en `foodIconCatalog.json` (`key`, `label`, `file`).
3. Registrá el `require` / import en `foodIconAssets.native.ts` y `foodIconAssets.web.ts`.
4. (Opcional) `npm run seed:food-icons` en `apps/mobile` para subir a Supabase Storage.
