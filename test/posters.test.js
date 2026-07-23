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

test("rewrites full metadata responses", () => {
  const response = rewriteMetaResponse({
    meta: { id: "tt0903747", type: "series", name: "Breaking Bad", poster: "old.jpg" },
  });
  assert.equal(response.meta.poster, "https://btttr.cc/poster/imdb/poster-default/tt0903747.jpg?fallback=true");
});
