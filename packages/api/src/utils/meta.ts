const SDK_SOURCE =
  'https://raw.githubusercontent.com/facebook/facebook-nodejs-business-sdk/main/src/api.js';
const REFRESH_MS = 24 * 60 * 60 * 1000;
let versions = ['v24.0', 'v25.0', 'v26.0', 'v27.0'];
let refreshAt = 0;
let pending: Promise<void> | undefined;

async function refreshVersions(): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(SDK_SOURCE, { signal: controller.signal });
    if (!response.ok) {
      return;
    }
    // The official SDK can lag a release; never remove known or configured versions.
    const source = await response.text();
    const match = source.match(/static get VERSION\(\): string\s*\{\s*return 'v(\d+)\.0';/);
    const latest = match ? Number(match[1]) : 0;
    if (latest > Number(versions[versions.length - 1].slice(1, -2)) && latest < 100) {
      versions = Array.from({ length: latest - 23 }, (_, index) => `v${index + 24}.0`);
    }
  } catch {
    // Keep the last known list when the public source is unavailable.
  } finally {
    clearTimeout(timeout);
    refreshAt = Date.now() + REFRESH_MS;
  }
}

export async function getAvailableMetaGraphVersions(): Promise<string[]> {
  if (Date.now() >= refreshAt) {
    if (!pending) {
      pending = refreshVersions().finally(() => {
        pending = undefined;
      });
    }
    await pending;
  }
  return [...versions];
}
