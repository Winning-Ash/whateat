import { useEffect, useRef, useState } from 'react';
import { loadKakaoMapSdk } from '../../api';
import {
  KakaoCircleInstance,
  KakaoMapInstance,
  KakaoMapMouseEvent,
  KakaoMapsApi,
  KakaoMarkerInstance,
} from '../../types';
import styles from './KakaoMap.module.css';

export interface MapLocation {
  lat: number;
  lng: number;
}

interface KakaoMapProps {
  selectedLocation?: MapLocation;
  radius: number;
  locationFocusKey: number;
  onSelectLocation(location: MapLocation): void;
}

const DEFAULT_LOCATION = { lat: 37.5665, lng: 126.978 };

export default function KakaoMap({
  selectedLocation,
  radius,
  locationFocusKey,
  onSelectLocation,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const markerRef = useRef<KakaoMarkerInstance | null>(null);
  const circleRef = useRef<KakaoCircleInstance | null>(null);
  const mapsRef = useRef<KakaoMapsApi | null>(null);
  const selectedLocationRef = useRef(selectedLocation);
  const radiusRef = useRef(radius);
  const [errorMessage, setErrorMessage] = useState<string>();
  selectedLocationRef.current = selectedLocation;
  radiusRef.current = radius;

  function updateSelectionOverlay(
    maps: KakaoMapsApi,
    map: KakaoMapInstance,
    position: ReturnType<typeof createPosition>,
    nextRadius: number,
  ) {
    if (markerRef.current) markerRef.current.setPosition(position);
    else markerRef.current = new maps.Marker({ map, position });

    if (circleRef.current) {
      circleRef.current.setPosition(position);
      circleRef.current.setRadius(nextRadius);
      return;
    }

    circleRef.current = new maps.Circle({
      map,
      center: position,
      radius: nextRadius,
      strokeWeight: 3,
      strokeColor: '#e03131',
      strokeOpacity: 1,
      strokeStyle: 'solid',
      fillColor: '#ff6b6b',
      fillOpacity: 0.2,
      zIndex: 5,
    });
    circleRef.current.setMap(map);
    circleRef.current.setZIndex(5);
  }

  function createPosition(maps: KakaoMapsApi, location: MapLocation) {
    return new maps.LatLng(location.lat, location.lng);
  }

  useEffect(() => {
    const container = containerRef.current;
    let map: KakaoMapInstance | undefined;
    let maps: KakaoMapsApi | undefined;
    let clickHandler: ((event: KakaoMapMouseEvent) => void) | undefined;
    let cancelled = false;

    if (!container) return;

    async function initializeMap(mapContainer: HTMLDivElement) {
      try {
        maps = await loadKakaoMapSdk();
        if (cancelled) return;

        const initialLocation = selectedLocationRef.current ?? DEFAULT_LOCATION;
        map = new maps.Map(mapContainer, {
          center: new maps.LatLng(initialLocation.lat, initialLocation.lng),
          level: 4,
        });

        mapsRef.current = maps;
        mapRef.current = map;

        if (selectedLocationRef.current) {
          updateSelectionOverlay(
            maps,
            map,
            createPosition(maps, selectedLocationRef.current),
            radiusRef.current,
          );
        }

        clickHandler = (event) => {
          updateSelectionOverlay(maps!, map!, event.latLng, radiusRef.current);
          onSelectLocation({
            lat: event.latLng.getLat(),
            lng: event.latLng.getLng(),
          });
        };
        maps.event.addListener(map, 'click', clickHandler);
      } catch (error) {
        console.error('Failed to initialize Kakao Map.', error);
        if (!cancelled) {
          setErrorMessage('지도를 불러올 수 없습니다. 지도 API 설정을 확인해 주세요.');
        }
      }
    }

    function handleResize() {
      map?.relayout();
    }

    void initializeMap(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (maps && map && clickHandler) {
        maps.event.removeListener(map, 'click', clickHandler);
      }
      markerRef.current?.setMap(null);
      circleRef.current?.setMap(null);
      markerRef.current = null;
      circleRef.current = null;
      mapRef.current = null;
      mapsRef.current = null;
    };
  }, [onSelectLocation]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!selectedLocation || !maps || !map) return;

    updateSelectionOverlay(
      maps,
      map,
      createPosition(maps, selectedLocation),
      radius,
    );
  }, [radius, selectedLocation]);

  useEffect(() => {
    const location = selectedLocationRef.current;
    if (locationFocusKey === 0 || !location) return;

    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    map.setCenter(createPosition(maps, location));
  }, [locationFocusKey]);

  return (
    <section className={styles.map} aria-label="위치 선택 지도">
      <div ref={containerRef} className={styles.canvas} />
      {errorMessage && (
        <p className={styles.error} role="alert">{errorMessage}</p>
      )}
    </section>
  );
}
