# BetterPosters for Nuvio

An unofficial Nuvio addon that gives IMDb-backed titles artwork from [BetterPosters](https://btttr.cc/).

## Quick install: Cinemeta only

Use this option if you normally use Cinemeta and just want its catalogs with BetterPosters artwork.

**Copy this manifest URL:**

```text
https://nuvio-better-posters.onrender.com/eyJ2ZXJzaW9uIjoxLCJ1cHN0cmVhbXMiOlsiaHR0cHM6Ly92My1jaW5lbWV0YS5zdHJlbS5pby9tYW5pZmVzdC5qc29uIl19/manifest.json
```

1. In Nuvio, open **Settings → Addons**.
2. Add an addon using the manifest URL above.
3. Disable your original Cinemeta addon to avoid duplicate catalog rows.

This link wraps **Cinemeta only**. It does not change posters supplied by your other installed addons.

## Use it with another addon

Open the [BetterPosters configurator](https://nuvio-better-posters.onrender.com/configure), enter the manifest URL of the addon you want to wrap, and copy the generated manifest URL into Nuvio.

Do not enter private or secret addon URLs into the public configurator. Its generated configuration is encoded, not encrypted.

## What it does

- Replaces poster URLs in wrapped catalog and metadata responses with `https://btttr.cc/poster/imdb/poster-default/{imdb_id}.jpg?fallback=true`.
- Excludes streams and subtitles, serving catalog and metadata responses only.
- Keeps the original poster when a title has no IMDb ID.

Because of how the addon protocol works, one addon cannot modify every other installed addon's posters. Each catalog addon must be wrapped separately, and already cached or Nuvio-native artwork may remain unchanged.

This project is unofficial and is not affiliated with Nuvio, Cinemeta, Stremio, or BetterPosters.
