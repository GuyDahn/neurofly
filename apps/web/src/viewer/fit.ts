export type Frame = {
  distance: number;
  near: number;
  far: number;
};

/** Distance that keeps a sphere inside a perspective view, with a little margin. */
export function frameSphere(
  radius: number,
  fovDeg: number,
  aspect: number,
  padding = 1.22,
): Frame {
  const safeRadius = Math.max(radius, 1e-3);
  const safeAspect = Math.max(aspect, 0.1);
  const vFov = (fovDeg * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * safeAspect);
  const distV = safeRadius / Math.sin(vFov / 2);
  const distH = safeRadius / Math.sin(hFov / 2);
  const distance = Math.max(distV, distH) * padding;
  return {
    distance,
    near: Math.max(distance / 200, 0.05),
    far: distance + safeRadius * 8,
  };
}
