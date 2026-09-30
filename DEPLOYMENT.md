# Arranque de producción

El `Dockerfile` de la raíz compila Astro y su CMD arranca Node directamente para evitar el proceso padre npm. Seleccionar ese Dockerfile en Railway u otro proveedor conserva el ajuste al clonar, sin depender de Config as Code legacy ni de copiar un override del dashboard. Las variables, dominios y credenciales deben configurarse en el proveedor; este archivo no las incorpora.

Desde un clon limpio: `npm ci`, `npm run build`, después `node dist/server/entry.mjs`.

El contenido administrativo existente requiere el volumen persistente del servicio. En Railway se monta en `/data`; conservar `PROMOTIONS_DATA_FILE` con su ruta actual (habitualmente `/data/promotions.json`) y las variables de acceso/Drive del servicio. Git no contiene ni reemplaza los datos del volumen. No copiar archivos de clientes o credenciales al repositorio.
