import test from "node:test";
import assert from "node:assert/strict";
import {
  findImdbId,
  rewriteCatalogResponse,
  rewriteMetaResponse,
} from "../src/posters.js";

test("finds common IMDb ID representations", () => {
  assert.equal(findImdbId({ id: "tt0111161" }), "tt0111161");
  assert.equal(findImdbId({ id: "tmdb:278", externalIds: { imdb: "TT0111161" } }), "tt0111161");
  assert.equal(findImdbId({ id: "custom", poster: "https://images.example/tt0111161/poster.jpg" }), "tt0111161");
  assert.equal(findImdbId({ id: "tmdb:278" }), null);
});

test("rewrites every IMDb-backed catalog poster without changing non-IMDb items", () => {
  const original = {
    metas: [
      { id: "tt0111161", type: "movie", name: "The Shawshank Redemption", poster: "old.jpg" },
      { id: "custom:1", imdbId: "tt0068646", type: "movie", name: "The Godfather" },
      { id: "tmdb:550", type: "movie", name: "Fight Club", poster: "keep.jpg" },
    ],
  };
  const rewritten = rewriteCatalogResponse(original);

  assert.equal(rewritten.metas[0].poster, "https://btttr.cc/poster/imdb/poster-default/tt0111161.jpg?fallback=true");
  assert.equal(rewritten.metas[0].posterShape, "poster");
  assert.equal(rewritten.metas[1].poster, "https://btttr.cc/poster/imdb/poster-default/tt0068646.jpg?fallback=true");
  assert.equal(rewritten.metas[2].poster, "keep.jpg");
  assert.equal(original.metas[0].poster, "old.jpg");
});

test("rewrites full metadata responses and binds episode IMDb IDs", () => {
  const response = rewriteMetaResponse({
    meta: {
      id: "tmdb:1396",
      type: "series",
      name: "Breaking Bad",
      externalIds: { imdb: "tt0903747" },
      poster: "old.jpg",
      videos: [
        { id: "tmdb:1396:1:1", season: 1, episode: 1, title: "Pilot" },
        { id: "tt0903747:1:2", season: 1, episode: 2, title: "Cat's in the Bag..." },
      ],
    },
  });

  assert.equal(response.meta.poster, "https://btttr.cc/poster/imdb/poster-default/tt0903747.jpg?fallback=true");
  assert.equal(response.meta.imdb_id, "tt0903747");
  assert.equal(response.meta.videos[0].id, "tmdb:1396:1:1");
  assert.equal(response.meta.videos[0].imdb_id, "tt0903747");
  assert.equal(response.meta.videos[0].imdbSeason, 1);
  assert.equal(response.meta.videos[0].imdbEpisode, 1);
  assert.equal(response.meta.videos[1].id, "tt0903747:1:2");
});
