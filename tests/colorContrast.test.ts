import { it, expect } from "vitest";
import { compositeBackground, contrastRatio } from "../e2e/colorContrast";
it("composites transparent button backgrounds over their parent, not black", () => {
  expect(
    compositeBackground(["rgba(0, 0, 0, 0)", "rgb(232, 213, 219)"]),
  ).toEqual([232, 213, 219]);
  expect(
    contrastRatio("rgb(87,67,78)", ["rgba(0,0,0,0)", "rgb(232,213,219)"]),
  ).toBeGreaterThan(4.5);
});
it("composites partially transitioned backgrounds in front-to-back order", () => {
  expect(
    compositeBackground(["rgba(238,229,232,0.5)", "rgb(232,213,219)"]),
  ).toEqual([235, 221, 225.5]);
});
it("opaque foreground backgrounds hide ancestors", () =>
  expect(compositeBackground(["rgb(238,229,232)", "rgb(0,0,0)"])).toEqual([
    238, 229, 232,
  ]));
it("computes opaque black-white reference contrast", () =>
  expect(contrastRatio("rgb(0,0,0)", ["rgb(255,255,255)"])).toBeCloseTo(21));
it("transparent foreground has no contrast", () =>
  expect(contrastRatio("rgba(0,0,0,0)", ["rgb(255,255,255)"])).toBe(1));
it("all disabled-state transition samples retain readable composited contrast", () => {
  for (const a of [0, 0.1, 0.5, 0.85, 1])
    expect(
      contrastRatio("rgb(87,67,78)", [
        `rgba(238,229,232,${a})`,
        "rgb(232,213,219)",
      ]),
    ).toBeGreaterThan(4.5);
});
