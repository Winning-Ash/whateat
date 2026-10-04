import { useEffect, useRef, useState } from 'react';
import { loadKakaoMapSdk } from '../../api';
import {
  KakaoCircleInstance,
  KakaoCustomOverlayInstance,
  KakaoMapInstance,
  KakaoMapMouseEvent,
  KakaoMapsApi,
  KakaoMarkerInstance,
  Restaurant,
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
  recommendation?: Restaurant;
  isSearching: boolean;
  onSelectLocation(location: MapLocation): void;
}

const DEFAULT_LOCATION = { lat: 37.5665, lng: 126.978 };

export default function KakaoMap({
  selectedLocation,
  radius,
  locationFocusKey,
  recommendation,
  isSearching,
  onSelectLocation,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const markerRef = useRef<KakaoMarkerInstance | null>(null);
  const circleRef = useRef<KakaoCircleInstance | null>(null);
  const resultMarkerRef = useRef<KakaoCustomOverlayInstance | null>(null);
  const resultLabelRef = useRef<KakaoCustomOverlayInstance | null>(null);
  const radarOverlayRef = useRef<KakaoCustomOverlayInstance | null>(null);
  const radarElementRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<KakaoMapsApi | null>(null);
  const selectedLocationRef = useRef(selectedLocation);
  const recommendationRef = useRef(recommendation);
  const radiusRef = useRef(radius);
  const isSearchingRef = useRef(isSearching);
  const [errorMessage, setErrorMessage] = useState<string>();
  selectedLocationRef.current = selectedLocation;
  recommendationRef.current = recommendation;
  radiusRef.current = radius;
  isSearchingRef.current = isSearching;

  function getRadarDiameter(
    maps: KakaoMapsApi,
    map: KakaoMapInstance,
    location: MapLocation,
    nextRadius: number,
  ) {
    const center = createPosition(maps, location);
    const north = createPosition(maps, {
      lat: location.lat + nextRadius / 111_320,
      lng: location.lng,
    });
    const projection = map.getProjection();
    const centerPoint = projection.pointFromCoords(center);
    const northPoint = projection.pointFromCoords(north);
    return Math.max(24, Math.abs(centerPoint.y - northPoint.y) * 2);
  }

  function updateRadarOverlay(
    maps: KakaoMapsApi,
    map: KakaoMapInstance,
    location: MapLocation,
    nextRadius: number,
  ) {
    const position = createPosition(maps, location);
    const diameter = getRadarDiameter(maps, map, location, nextRadius);

    if (!radarElementRef.current) {
      const element = document.createElement('div');
      element.className = styles.radar;
      element.setAttribute('aria-hidden', 'true');
      radarElementRef.current = element;
    }

    radarElementRef.current.style.width = `${diameter}px`;
    radarElementRef.current.style.height = `${diameter}px`;

    if (radarOverlayRef.current) {
      radarOverlayRef.current.setPosition(position);
      return;
    }

    radarOverlayRef.current = new maps.CustomOverlay({
      map,
      position,
      content: radarElementRef.current,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 6,
    });
  }

  function updateResultOverlay(
    maps: KakaoMapsApi,
    map: KakaoMapInstance,
    restaurant?: Restaurant,
  ) {
    resultMarkerRef.current?.setMap(null);
    resultLabelRef.current?.setMap(null);
    resultMarkerRef.current = null;
    resultLabelRef.current = null;

    if (!restaurant) return;

    const position = createPosition(maps, restaurant);
    const pin = document.createElement('div');
    const pinDot = document.createElement('span');
    const label = document.createElement('div');
    pin.className = styles.resultPin;
    pin.setAttribute('aria-hidden', 'true');
    pinDot.className = styles.resultPinDot;
    pin.appendChild(pinDot);
    label.className = styles.resultLabel;
    label.textContent = restaurant.name;

    resultMarkerRef.current = new maps.CustomOverlay({
      map,
      position,
      content: pin,
      xAnchor: 0.5,
      yAnchor: 1,
      zIndex: 10,
    });
    resultLabelRef.current = new maps.CustomOverlay({
      map,
      position,
      content: label,
      xAnchor: 0.5,
      yAnchor: 2.2,
      zIndex: 10,
    });
  }

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
      strokeColor: '#18b15c',
      strokeOpacity: 1,
      strokeStyle: 'solid',
      fillColor: '#5cff9e',
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
    let zoomHandler: (() => void) | undefined;
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

          if (isSearchingRef.current) {
            updateRadarOverlay(
              maps,
              map,
              selectedLocationRef.current,
              radiusRef.current,
            );
          }
        }

        updateResultOverlay(maps, map, recommendationRef.current);

        clickHandler = (event) => {
          if (isSearchingRef.current) return;
          updateSelectionOverlay(maps!, map!, event.latLng, radiusRef.current);
          onSelectLocation({
            lat: event.latLng.getLat(),
            lng: event.latLng.getLng(),
          });
        };
        maps.event.addListener(map, 'click', clickHandler);

        zoomHandler = () => {
          const location = selectedLocationRef.current;
          if (location && radarOverlayRef.current) {
            updateRadarOverlay(maps!, map!, location, radiusRef.current);
          }
        };
        maps.event.addListener(map, 'zoom_changed', zoomHandler);
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
      if (maps && map && zoomHandler) {
        maps.event.removeListener(map, 'zoom_changed', zoomHandler);
      }
      markerRef.current?.setMap(null);
      circleRef.current?.setMap(null);
      resultMarkerRef.current?.setMap(null);
      resultLabelRef.current?.setMap(null);
      radarOverlayRef.current?.setMap(null);
      markerRef.current = null;
      circleRef.current = null;
      resultMarkerRef.current = null;
      resultLabelRef.current = null;
      radarOverlayRef.current = null;
      radarElementRef.current = null;
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
    const maps = mapsRef.current;
    const map = mapRef.current;

    if (!isSearching || !selectedLocation || !maps || !map) {
      radarOverlayRef.current?.setMap(null);
      radarOverlayRef.current = null;
      radarElementRef.current = null;
      return;
    }

    updateRadarOverlay(maps, map, selectedLocation, radius);
  }, [isSearching, radius, selectedLocation]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    updateResultOverlay(maps, map, recommendation);
  }, [recommendation]);

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
