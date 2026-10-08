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

export function makeDistortionCurve(amount: number) {
  var k = amount,
    n_samples = typeof sampleRate === "number" ? sampleRate : 44100,
    curve = new Float32Array(n_samples),
    deg = Math.PI / 180,
    i = 0,
    x;
  for (; i < n_samples; ++i) {
    x = (i * 2) / n_samples - 1;
    curve[i] =
      ((3 + k) * Math.atan(Math.sinh(x * 0.25) * 5)) /
      (Math.PI + k * Math.abs(x));
  }
  return curve;
}
