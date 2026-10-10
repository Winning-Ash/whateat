import { Coordinates, LocationErrorCode } from '../types';

export class LocationError extends Error {
  constructor(public readonly code: LocationErrorCode, message: string) {
    super(message);
    this.name = 'LocationError';
  }
}

export function getCurrentLocation(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 60_000,
  },
): Promise<Coordinates> {
  if (!('geolocation' in navigator)) {
    return Promise.reject(
      new LocationError('unsupported', 'This browser does not support location services.'),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        });
      },
      (error) => reject(toLocationError(error)),
      options,
    );
  });
}

function toLocationError(error: GeolocationPositionError): LocationError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new LocationError('permission-denied', 'Location permission was denied.');
    case error.POSITION_UNAVAILABLE:
      return new LocationError('position-unavailable', 'The current location is unavailable.');
    case error.TIMEOUT:
      return new LocationError('timeout', 'Location lookup timed out.');
    default:
      return new LocationError('unknown', 'Unable to determine the current location.');
  }
}
