# Iconos de alimentos (shared)

PNG únicos para web y mobile. Los keys están en `packages/shared/src/nutrition/foodIcons.ts`.

Al agregar un icono:
1. Copiá el PNG acá con el nombre de `FOOD_ICON_FILENAMES`.
2. Registrá la key en `foodIcons.ts`.
3. Agregá el `require` / import en `foodIconAssets.native.ts` y `foodIconAssets.web.ts`.
