import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { normalizeManifestUrl } from "./config.js";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const MANIFEST_CACHE_MS = 5 * 60 * 1_000;
const MAX_REDIRECTS = 4;
const manifestCache = new Map();

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }
  return false;
}

export function isPrivateAddress(address) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertSafeRemoteUrl(input, env = process.env) {
  const url = new URL(input);
  const privateAllowed = env.ALLOW_PRIVATE_UPSTREAMS === "1";

  if (url.protocol !== "https:" && !(privateAllowed && url.protocol === "http:")) {
    throw new TypeError("Upstream addon URLs must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new TypeError("Upstream addon URLs cannot contain embedded credentials.");
  }
  if (privateAllowed) return;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new TypeError("Private or local upstream addon hosts are blocked.");
  }

  const literalVersion = isIP(hostname);
  if (literalVersion && isPrivateAddress(hostname)) {
    throw new TypeError("Private or local upstream addon hosts are blocked.");
  }

  if (!literalVersion) {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new TypeError("Private or local upstream addon hosts are blocked.");
    }
  }
}

export async function fetchJson(input, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const validateUrl = options.validateUrl ?? assertSafeRemoteUrl;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let currentUrl = new URL(input).toString();

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await validateUrl(currentUrl);
    const response = await fetchImpl(currentUrl, {
      headers: {
        accept: "application/json",
        "user-agent": "Nuvio-BetterPosters-Proxy/1.0",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      if (redirectCount === MAX_REDIRECTS) {
        throw new Error("Too many upstream redirects.");
      }
      currentUrl = new URL(response.headers.get("location"), currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Upstream returned HTTP ${response.status}.`);
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error("Upstream JSON response is too large.");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw new Error("Upstream JSON response is too large.");
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error("Upstream returned invalid JSON.");
    }
  }

  throw new Error("Unable to load upstream JSON.");
}

function validateManifest(manifest, manifestUrl) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new TypeError("Upstream manifest is not a JSON object.");
  }
  for (const field of ["id", "name", "version"]) {
    if (typeof manifest[field] !== "string" || manifest[field].trim() === "") {
      throw new TypeError(`Upstream manifest is missing ${field}.`);
    }
  }
  return { manifestUrl, manifest };
}

export async function loadManifest(manifestUrl, options = {}) {
  const normalizedUrl = normalizeManifestUrl(manifestUrl);
  const now = Date.now();
  const cached = manifestCache.get(normalizedUrl);
  if (!options.disableCache && cached?.value && cached.expiresAt > now) {
    return cached.value;
  }
  if (!options.disableCache && cached?.promise) {
    return cached.promise;
  }

  const promise = fetchJson(normalizedUrl, options)
    .then((manifest) => validateManifest(manifest, normalizedUrl))
    .then((value) => {
      manifestCache.set(normalizedUrl, { value, expiresAt: Date.now() + MANIFEST_CACHE_MS });
      return value;
    })
    .catch((error) => {
      manifestCache.delete(normalizedUrl);
      throw error;
    });

  if (!options.disableCache) {
    manifestCache.set(normalizedUrl, { promise, expiresAt: now + MANIFEST_CACHE_MS });
  }
  return promise;
}

export async function loadUpstreams(config, options = {}) {
  const results = await Promise.allSettled(
    config.upstreams.map((manifestUrl) => loadManifest(manifestUrl, options)),
  );
  const failures = results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => result.status === "rejected");
  if (failures.length > 0) {
    const summary = failures
      .map(({ result, index }) => `#${index + 1}: ${result.reason?.message ?? "failed"}`)
      .join("; ");
    throw new Error(`Could not load every upstream manifest (${summary}).`);
  }
  return results.map((result) => result.value);
}

export function normalizedResources(manifest) {
  const defaultTypes = Array.isArray(manifest.types) ? manifest.types.filter(Boolean) : [];
  const defaultPrefixes = Array.isArray(manifest.idPrefixes) ? manifest.idPrefixes.filter(Boolean) : [];
  const resources = Array.isArray(manifest.resources) ? manifest.resources : [];

  return resources.flatMap((resource) => {
    if (typeof resource === "string" && resource) {
      return [{ name: resource, types: defaultTypes, idPrefixes: defaultPrefixes }];
    }
    if (!resource || typeof resource !== "object" || typeof resource.name !== "string") {
      return [];
    }
    return [{
      name: resource.name,
      types: Array.isArray(resource.types) && resource.types.length > 0 ? resource.types : defaultTypes,
      idPrefixes: Array.isArray(resource.idPrefixes) && resource.idPrefixes.length > 0
        ? resource.idPrefixes
        : defaultPrefixes,
    }];
  });
}

export function supportsResource(manifest, resourceName, type, id) {
  return normalizedResources(manifest).some((resource) => {
    if (resource.name !== resourceName) return false;
    if (resource.types.length > 0 && !resource.types.includes(type)) return false;
    if (resource.idPrefixes.length > 0 && !resource.idPrefixes.some((prefix) => id.startsWith(prefix))) {
      return false;
    }
    return true;
  });
}

export function buildUpstreamResourceUrl(manifestUrl, resource, type, id, rawExtraSegment = null) {
  const manifest = new URL(manifestUrl);
  const query = manifest.search;
  manifest.search = "";
  manifest.hash = "";
  const basePath = manifest.pathname.replace(/\/manifest\.json\/?$/, "").replace(/\/$/, "");
  const encodedType = encodeURIComponent(type);
  const encodedId = encodeURIComponent(id);
  const extra = rawExtraSegment == null ? "" : `/${rawExtraSegment}`;
  manifest.pathname = `${basePath}/${resource}/${encodedType}/${encodedId}${extra}.json`;
  manifest.search = query;
  return manifest.toString();
}

export function clearManifestCache() {
  manifestCache.clear();
}
