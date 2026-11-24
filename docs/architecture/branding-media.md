# Marca e imágenes por empresa

En **Studio → Apariencia y marca**, el propietario elige **Studio** o **Storefront**. Cada ámbito admite un nombre visible, logo, banner y colores de fondo, superficie, texto y acento en claro y oscuro. La vista previa usa los productos de la empresa y permite cambiar entre escritorio, tableta y móvil. Guardar copia el formulario al borrador y publicar activa la versión de ese ámbito. El tema de Storefront se muestra cuando la tienda también está publicada.

Al publicar, la API comprueba el contraste del texto en ambos modos. Cada cambio al borrador o publicación requiere la revisión vigente. Si el tema cambió en otra pestaña, recarga esos datos antes de aplicar tus ajustes.

En la pestaña **Storefront**, el enlace **Vista del borrador guardado** abre una página Liquid de Atelier con la marca y los productos de la empresa autenticada. La página pública **Ver versión Liquid** usa la revisión publicada. Ambas usan el mismo renderer y sus imágenes se sirven desde el mismo origen que el monolito. [Decisión del motor de temas](modular-monolith.md#prueba-inicial-del-motor-de-temas)

## Importar y conservar imágenes

Pega una URL HTTPS pública que apunte directamente a una imagen PNG, JPEG o WebP de hasta 5 MB. La API valida los destinos de la descarga, comprueba el contenido, elimina metadatos y guarda una copia WebP de hasta 1600 × 1600 píxeles, manteniendo su proporción. Puedes elegir una imagen para el logo, el banner o un producto desde Studio.

La conexión de PostgreSQL guarda metadatos y referencias. Cada copia pertenece a la empresa que la importó. El enlace privado de Studio requiere sesión. El enlace público devuelve una imagen cuando la tienda está publicada y existe una referencia en su catálogo o tema público. Los cambios de marca que quedan en el borrador son visibles en la sesión de Studio.

## Elegir almacenamiento

La configuración predeterminada `MEDIA_STORAGE=local` guarda los WebP en `.vendelier-local/media/<empresa>/<imagen>.webp`. Puedes cambiar la ruta con `MEDIA_ROOT`. Tanto el directorio de datos como `.env` están excluidos de Git.

Para un servidor con un bucket privado, aplica `MEDIA_STORAGE=s3` y especifica `MEDIA_S3_BUCKET` y, si corresponde, `MEDIA_S3_REGION`. Para MinIO o un servicio compatible, indica también `MEDIA_S3_ENDPOINT` y configura `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` como secretos del servidor. La API necesita leer, escribir y borrar objetos del bucket. El servicio emite las mismas URLs de Studio y Storefront para ambos modos de almacenamiento.

Al migrar datos existentes de la PC a un bucket, copia los archivos conservando la ruta `<empresa>/<imagen>.webp` antes de cambiar `MEDIA_STORAGE`. Conserva la base de datos y los archivos juntos al hacer un respaldo.

Las imágenes de prueba de Casa Nopal provienen de Pexels. [Oziel Gómez](https://www.pexels.com/photo/closeup-photo-of-cactus-plant-in-a-pot-837267/), [Oleg Prachuk](https://www.pexels.com/photo/close-up-of-ceramic-mugs-standing-on-a-wooden-surface-15440831/) y [Pavel Danilyuk](https://www.pexels.com/photo/ceramic-cup-and-saucer-in-close-up-photography-7674536/).
