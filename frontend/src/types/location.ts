export interface Coordinates {
  lat: number;
  lng: number;
  accuracy: number;
}

export type LocationErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'position-unavailable'
  | 'timeout'
  | 'unknown';
