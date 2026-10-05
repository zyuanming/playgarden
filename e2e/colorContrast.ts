/** Flat CSS sRGB colors only; this helper is not a full accessibility audit. */
export type RGB = [number, number, number];
export function compositeBackground(
  layers: readonly string[],
  canvas: RGB = [255, 255, 255],
): RGB {
  let result: RGB = [...canvas];
  for (const css of [...layers].reverse()) {
    const parts = css.match(/[\d.]+/g)?.map(Number);
    if (!parts || parts.length < 3)
      throw new Error(`Unsupported computed color: ${css}`);
    const alpha = parts[3] ?? 1;
    result = result.map(
      (value, i) => parts[i] * alpha + value * (1 - alpha),
    ) as RGB;
  }
  return result;
}
export function contrastRatio(
  foreground: string,
  backgrounds: readonly string[],
): number {
  const bg = compositeBackground(backgrounds),
    fg = compositeBackground([foreground], bg);
  const luminance = (color: RGB) =>
    color
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const a = luminance(fg),
    b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
