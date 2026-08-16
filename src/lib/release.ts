/**
 * Release metadata published by the PatchTray download service.
 *
 * The stable channel feed the evergreen installer follows is the source of
 * truth for the version the site advertises. Shape (only the fields the site
 * reads):
 *
 * ```json
 * { "schema_version": 1, "channel": "stable", "payload": { "version": "0.5.7" } }
 * ```
 *
 * The download link is deliberately not taken from `payload.url`. That field
 * points at the versioned offline bundle the launcher acquires and verifies;
 * the site publishes only the evergreen installer below.
 *
 * This module is shared by the browser bundle and the build-time fetch in
 * `vite.config.ts`, so it must stay free of `import.meta.env` and DOM access.
 * `api/release.js` cannot import it (Vercel's TS compile step breaks on
 * TypeScript 7), so it carries its own copy of the URL below.
 */
export const DOWNLOAD_ORIGIN = "https://download.patchtray.io";

/**
 * The evergreen online installer: a fixed URL that always serves the current
 * launcher, which then resolves the feed itself. It is the only installer link
 * the site publishes — versioned bundles are for the launcher, not for people.
 */
export const INSTALLER_DOWNLOAD_URL = `${DOWNLOAD_ORIGIN}/PatchTrayInstaller.exe`;

export const LATEST_MANIFEST_URL = `${DOWNLOAD_ORIGIN}/installer/v1/manifest.json`;

/**
 * The public repository: release notes, approved media, and issue tracking.
 * Installer artifacts are served from `DOWNLOAD_ORIGIN` instead. PatchTray's
 * source is closed and lives elsewhere — never link that repository from here.
 */
export const RELEASE_REPOSITORY = "PatchTray/PatchTray";

export const REPOSITORY_URL = `https://github.com/${RELEASE_REPOSITORY}`;

export type LatestRelease = {
  /** Stable version without a leading `v`, e.g. `0.5.7`. */
  version: string;
};

/** Canonical stable semver: no leading zeroes, no prerelease or build metadata. */
const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Reads a stable-channel feed manifest. Returns `null` for anything unusable —
 * a partial, off-channel, or unexpected manifest must leave the site on its
 * configured fallback rather than render a version that was never published.
 */
export function parseLatestRelease(raw: unknown): LatestRelease | null {
  if (!raw || typeof raw !== "object") return null;

  const feed = raw as { schema_version?: unknown; channel?: unknown; payload?: unknown };
  if (feed.schema_version !== 1 || feed.channel !== "stable") return null;
  if (!feed.payload || typeof feed.payload !== "object") return null;

  const version = (feed.payload as { version?: unknown }).version;
  if (typeof version !== "string" || !STABLE_VERSION.test(version)) return null;

  return { version };
}

/** Fetches and validates the published manifest. Rejects on network/parse failure. */
export async function fetchLatestManifest(timeoutMs = 8000): Promise<unknown> {
  const response = await fetch(LATEST_MANIFEST_URL, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`manifest request failed: HTTP ${response.status}`);

  const manifest: unknown = await response.json();
  if (!parseLatestRelease(manifest)) throw new Error("manifest is not a stable feed with a published version");
  return manifest;
}
