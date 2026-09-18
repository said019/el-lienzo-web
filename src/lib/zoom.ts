import { getImage } from "astro:assets";

/*
  Genera, para cada foto que se puede ampliar, una variante grande y los atributos
  data-* que el visor lee en el cliente. La miniatura de la página sigue siendo
  pequeña: la versión grande sólo se descarga cuando alguien abre el visor.
*/

export interface ZoomPhoto {
  src: ImageMetadata;
  alt: string;
  /** Rótulo corto que acompaña a la foto dentro del visor. */
  caption?: string;
}

export type ZoomAttributes = Record<string, string>;

export interface ZoomedPhoto<T extends ZoomPhoto> {
  photo: T;
  zoom: ZoomAttributes;
}

/** Más allá de este ancho la foto ya no aporta detalle en pantalla y sólo pesa. */
const MAX_ZOOM_WIDTH = 1800;

export async function buildZoomAttributes(
  photo: ZoomPhoto,
  group: string,
): Promise<ZoomAttributes> {
  const width = Math.min(photo.src.width, MAX_ZOOM_WIDTH);
  const height = Math.round((width * photo.src.height) / photo.src.width);
  const full = await getImage({
    src: photo.src,
    width,
    format: "webp",
    quality: 82,
  });

  const attributes: ZoomAttributes = {
    "data-zoom": "",
    "data-zoom-group": group,
    "data-zoom-src": full.src,
    "data-zoom-width": String(width),
    "data-zoom-height": String(height),
    "data-zoom-alt": photo.alt,
  };

  if (photo.caption) {
    attributes["data-zoom-caption"] = photo.caption;
  }

  return attributes;
}

export async function buildZoomGroup<T extends ZoomPhoto>(
  photos: readonly T[],
  group: string,
): Promise<ZoomedPhoto<T>[]> {
  return Promise.all(
    photos.map(async (photo) => ({
      photo,
      zoom: await buildZoomAttributes(photo, group),
    })),
  );
}
