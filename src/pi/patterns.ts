//  We only need “don’t leak raw values” for configGen output.

export function maskSample(s: string): string {
  if (!s) return s;

  //  show first 2 + last 2, mask middle
  if (s.length <= 6) return "***";
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}
