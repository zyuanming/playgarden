// SPDX-License-Identifier: GPL-3.0-only
import { expect, it } from "vitest";
import {
  correspondingSourceUrl,
  PROJECT_LICENSE,
  PROJECT_REPOSITORY,
} from "../src/lib/license";
it("links a production build to that exact source commit", () => {
  const sha = "a".repeat(40);
  const doc = {
    querySelector: () => ({ getAttribute: () => sha }),
  } as unknown as Pick<Document, "querySelector">;
  expect(correspondingSourceUrl(doc)).toBe(`${PROJECT_REPOSITORY}/tree/${sha}`);
  expect(PROJECT_LICENSE).toBe("GPL-3.0-only");
});
it("rejects untrusted revision text and keeps development fallback explicit", () => {
  for (const value of [null, "", '" onerror="bad', "abc", "a".repeat(41)]) {
    const doc = {
      querySelector: () => ({ getAttribute: () => value }),
    } as unknown as Pick<Document, "querySelector">;
    expect(correspondingSourceUrl(doc)).toBe(`${PROJECT_REPOSITORY}/tree/main`);
  }
  expect(correspondingSourceUrl(undefined)).toBe(
    `${PROJECT_REPOSITORY}/tree/main`,
  );
});
