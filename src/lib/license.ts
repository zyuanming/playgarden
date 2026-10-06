// SPDX-License-Identifier: GPL-3.0-only
export const PROJECT_LICENSE = "GPL-3.0-only";
export const PROJECT_REPOSITORY = "https://github.com/zyuanming/playgarden";
/** Production pages carry the exact build revision, independent of future main changes. */
export function correspondingSourceUrl(
  doc: Pick<Document, "querySelector"> | undefined = typeof document ===
  "undefined"
    ? undefined
    : document,
) {
  const revision = doc
    ?.querySelector('meta[name="playgarden-commit"]')
    ?.getAttribute("content");
  return `${PROJECT_REPOSITORY}/tree/${revision && /^[a-f0-9]{40}$/.test(revision) ? revision : "main"}`;
}
