const IMDB_ID_PATTERN = /(?:^|[^a-z0-9])(tt\d{5,12})(?=$|[^0-9])/i;
const BETTER_POSTERS_BASE = "https://btttr.cc/poster/imdb/poster-default";

function imdbIdFrom(value) {
  if (typeof value !== "string") return null;
  return value.match(IMDB_ID_PATTERN)?.[1]?.toLowerCase() ?? null;
}

export function findImdbId(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;

  const candidates = [
    meta.id,
    meta.imdb_id,
    meta.imdbId,
    meta.imdb,
    meta.externalIds?.imdb,
    meta.externalIds?.imdbId,
    meta.external_ids?.imdb,
    meta.external_ids?.imdb_id,
    meta.behaviorHints?.imdbId,
    meta.poster,
  ];
  for (const candidate of candidates) {
    const id = imdbIdFrom(candidate);
    if (id) return id;
  }
  return null;
}

export function betterPosterUrl(imdbId) {
  const normalized = imdbIdFrom(imdbId);
  return normalized ? `${BETTER_POSTERS_BASE}/${normalized}.jpg?fallback=true` : null;
}

export function rewriteMetaObject(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return meta;
  const imdbId = findImdbId(meta);
  if (!imdbId) return meta;

  return {
    ...meta,
    poster: betterPosterUrl(imdbId),
    posterShape: "poster",
  };
}

export function rewriteCatalogResponse(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (!Array.isArray(payload.metas)) return payload;
  return {
    ...payload,
    metas: payload.metas.map(rewriteMetaObject),
  };
}

export function rewriteMetaResponse(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload.meta)) {
    return { ...payload, meta: payload.meta.map(rewriteMetaObject) };
  }
  return { ...payload, meta: rewriteMetaObject(payload.meta) };
}
