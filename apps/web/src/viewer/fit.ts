export type Point3 = { x: number; y: number; z: number };
export type Box = { min: Point3; max: Point3 };

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

const dot = (a: Point3, b: Point3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Point3, b: Point3): Point3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
function normalize(v: Point3): Point3 {
  const length = Math.sqrt(dot(v, v)) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/**
 * Distance that keeps a box inside a perspective view, looking from
 * `direction`. Unlike `frameSphere`, a box's own width and height (as seen
 * from that angle) drive the fit, so a shape that is long in one direction
 * and thin in the others (the escape circuit runs from the eyes down through
 * the nerve cord) doesn't back the camera off to a distance sized for its
 * longest axis in every direction, wasting most of a wide canvas.
 */
export function frameBox(
  box: Box,
  direction: Point3,
  fovDeg: number,
  aspect: number,
  padding = 1.08,
): Frame {
  const forward = normalize(direction);
  // Any vector not parallel to `forward`, to build a perpendicular basis from.
  const seed: Point3 =
    Math.abs(forward.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const right = normalize(cross(seed, forward));
  const up = normalize(cross(forward, right));
  const center: Point3 = {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2,
  };
  let minRight = Infinity;
  let maxRight = -Infinity;
  let minUp = Infinity;
  let maxUp = -Infinity;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const rel: Point3 = {
          x: x - center.x,
          y: y - center.y,
          z: z - center.z,
        };
        const r = dot(rel, right);
        const u = dot(rel, up);
        minRight = Math.min(minRight, r);
        maxRight = Math.max(maxRight, r);
        minUp = Math.min(minUp, u);
        maxUp = Math.max(maxUp, u);
      }
    }
  }
  const halfWidth = Math.max((maxRight - minRight) / 2, 1e-3);
  const halfHeight = Math.max((maxUp - minUp) / 2, 1e-3);
  const safeAspect = Math.max(aspect, 0.1);
  const vFov = (fovDeg * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * safeAspect);
  const distV = halfHeight / Math.sin(vFov / 2);
  const distH = halfWidth / Math.sin(hFov / 2);
  const distance = Math.max(distV, distH) * padding;
  const reach = Math.max(halfWidth, halfHeight);
  return {
    distance,
    near: Math.max(distance / 200, 0.05),
    far: distance + reach * 8,
  };
}
