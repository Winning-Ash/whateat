export interface Point { lat: number; lng: number }
export type Rect = [number, number, number, number];
const R = 6371000;
const rad = Math.PI / 180;
export function distance(a: Point, b: Point): number {
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function bounds(center: Point, radius: number): Rect {
  const dy = radius / R / rad;
  const dx = Math.asin(Math.min(1, Math.sin(radius / R) / Math.cos(center.lat * rad))) / rad;
  return [center.lng - dx, center.lat - dy, center.lng + dx, center.lat + dy];
}

export function split([west, south, east, north]: Rect): Rect[] {
  const x = (west + east) / 2, y = (south + north) / 2;
  return [[west, south, x, y], [x, south, east, y], [west, y, x, north], [x, y, east, north]];
}

export function grid(point: Point, meters: number) {
  const latStep = meters / R / rad;
  const row = Math.round(point.lat / latStep);
  const lat = row * latStep;
  const lngStep = meters / (R * Math.cos(lat * rad)) / rad;
  const column = Math.round(point.lng / lngStep);
  return { key: `${meters}:${row}:${column}`, center: { lat, lng: column * lngStep } };
}
