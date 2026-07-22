# BetterPosters for Nuvio

A self-hosted Nuvio/Stremio addon proxy that wraps existing addons and replaces IMDb-backed poster fields with:

```text
https://btttr.cc/poster/imdb/poster-default/{imdb_id}.jpg
```

It rewrites both `catalog` previews and full `meta` responses, so the artwork appears on Nuvio home/catalog surfaces as well as detail screens. Wrapped `stream` and `subtitles` responses are aggregated without modification.

## Why this is a proxy addon

The addon protocol does not let one independently installed addon edit another addon's catalog response. Nuvio reads the `poster` URL directly from each catalog item. This service therefore republishes selected addons through one generated manifest and changes their poster fields in transit.

## Run locally

Requirements: Node.js 20 or newer.

```powershell
npm test
npm start
```

Open `http://127.0.0.1:7000/configure`, enter one upstream manifest URL per line, and generate the wrapper manifest.

On Windows, `start-windows.cmd` starts the service and opens the configuration page.

For use on a TV, deploy the service at a public HTTPS URL. A localhost URL on your PC will not normally be reachable or accepted by a TV client.

## Deploy

### Docker

```powershell
docker build -t nuvio-better-posters .
docker run --rm -p 7000:7000 nuvio-better-posters
```

### Render

This repository includes `render.yaml`. Push this folder to a Git repository and create a Render Blueprint. `PUBLIC_BASE_URL` is optional; set it only if a reverse proxy does not forward the original public host correctly.

## Install in Nuvio

1. Open the deployed `/configure` page.
2. Add the manifest URLs for the catalog/metadata addons you want decorated. Stream-only addons can also be added if you want the wrapper to aggregate them.
3. Copy the generated manifest URL.
4. In Nuvio on iOS and TV, open **Settings → Addons** and add the URL.
5. Disable original wrapped catalog addons to avoid duplicate rows. Leave any stream addons that were not wrapped installed normally.

You can alternatively set `UPSTREAM_ADDONS` to newline-separated URLs. That creates a fixed endpoint at `/manifest.json` without a configuration token.

## Limits and safety

- The BetterPosters URL requires an IMDb ID. Items whose `id`, IMDb fields, or poster URL contain no IMDb ID keep their original poster.
- An addon cannot change Nuvio-native sources or already cached library artwork that never passes through an addon catalog/meta response.
- Generated configuration tokens are encoded, not encrypted. Do not put secret addon URLs into a shared public deployment.
- Public deployments block private/LAN upstream hosts to reduce SSRF risk. Set `ALLOW_PRIVATE_UPSTREAMS=1` only on a trusted private deployment that intentionally wraps local addons.
- Poster images are loaded directly from `btttr.cc`; that service's availability and caching behavior apply.
