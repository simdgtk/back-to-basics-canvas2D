export function remap(
  value: number,
  x1: number,
  y1: number = 0,
  x2: number,
  y2: number = 1,
) {
  return ((value - x1) * (y2 - x2)) / (y1 - x1) + x2;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export function degreesToRadians(angle: number) {
  return angle * (180 / Math.PI);
}
