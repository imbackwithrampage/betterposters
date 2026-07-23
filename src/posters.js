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
    Array.isArray(meta.videos) ? meta.videos[0]?.id : null,
    Array.isArray(meta.videos) ? meta.videos[0]?.imdb_id : null,
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

  const rewritten = { ...meta };

  if (imdbId) {
    rewritten.poster = betterPosterUrl(imdbId);
    rewritten.posterShape = "poster";
    rewritten.imdb_id = meta.imdb_id || imdbId;
    rewritten.imdbId = meta.imdbId || imdbId;
  }

  if (Array.isArray(meta.videos)) {
    rewritten.videos = meta.videos.map((video) => {
      if (!video || typeof video !== "object" || Array.isArray(video)) return video;

      const videoImdbId = imdbIdFrom(video.id) || imdbIdFrom(video.imdb_id) || imdbId;
      const season = video.season ?? video.seasonNum;
      const episode = video.episode ?? video.episodeNum ?? video.number;

      if (!videoImdbId && season == null) return video;

      const updatedVideo = { ...video };

      if (videoImdbId) {
        updatedVideo.imdb_id = video.imdb_id || videoImdbId;
      }
      if (season != null) {
        updatedVideo.imdbSeason = video.imdbSeason ?? season;
      }
      if (episode != null) {
        updatedVideo.imdbEpisode = video.imdbEpisode ?? episode;
      }

      if (videoImdbId && season != null && episode != null) {
        const expectedImdbEpisodeId = `${videoImdbId}:${season}:${episode}`;
        if (typeof video.id === "string" && !video.id.toLowerCase().startsWith("tt")) {
          updatedVideo.originalId = video.id;
          updatedVideo.id = expectedImdbEpisodeId;
        }
      }

      return updatedVideo;
    });
  }

  return rewritten;
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
