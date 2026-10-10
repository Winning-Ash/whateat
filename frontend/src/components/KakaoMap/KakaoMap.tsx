import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { loadKakaoMapSdk } from '../../api';
import { type ThemeId } from '../../styles/theme';
import {
  KakaoCircleInstance,
  KakaoCustomOverlayInstance,
  KakaoMapInstance,
  KakaoMapMouseEvent,
  KakaoMapsApi,
  KakaoMarkerInstance,
  KakaoPlaceSearchResult,
  Restaurant,
} from '../../types';
import styles from './KakaoMap.module.css';

export interface MapLocation {
  lat: number;
  lng: number;
}

interface KakaoMapProps {
  theme: ThemeId;
  selectedLocation?: MapLocation;
  radius: number;
  locationFocusKey: number;
  recommendation?: Restaurant;
  isSearching: boolean;
  onCloseRecommendation(): void;
  onSelectLocation(location: MapLocation): void;
  onSelectRestaurant(restaurant: Restaurant): void;
}

const DEFAULT_LOCATION = { lat: 37.5665, lng: 126.978 };

export default function KakaoMap({
  theme,
  selectedLocation,
  radius,
  locationFocusKey,
  recommendation,
  isSearching,
  onCloseRecommendation,
  onSelectLocation,
  onSelectRestaurant,
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
  const [mapQuery, setMapQuery] = useState('');
  const [mapSearchResults, setMapSearchResults] = useState<KakaoPlaceSearchResult[]>([]);
  const [mapSearchMessage, setMapSearchMessage] = useState<string>();
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
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

    const selectionColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent')
      .trim();

    if (circleRef.current) {
      circleRef.current.setPosition(position);
      circleRef.current.setRadius(nextRadius);
      circleRef.current.setOptions({
        strokeColor: selectionColor,
        fillColor: selectionColor,
      });
      return;
    }

    circleRef.current = new maps.Circle({
      map,
      center: position,
      radius: nextRadius,
      strokeWeight: 3,
      strokeColor: selectionColor,
      strokeOpacity: 1,
      strokeStyle: 'solid',
      fillColor: selectionColor,
      fillOpacity: 0.12,
      zIndex: 5,
    });
    circleRef.current.setMap(map);
    circleRef.current.setZIndex(5);
  }

  function createPosition(maps: KakaoMapsApi, location: MapLocation) {
    return new maps.LatLng(location.lat, location.lng);
  }

  function searchMap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = mapQuery.trim();
    const maps = mapsRef.current;
    const map = mapRef.current;

    if (!keyword || !maps || !map) return;

    setMapSearchLoading(true);
    setMapSearchMessage(undefined);

    const places = new maps.services.Places();
    places.keywordSearch(keyword, (results, status) => {
      setMapSearchLoading(false);

      if (status === maps.services.Status.OK) {
        setMapSearchResults(results);
        return;
      }

      setMapSearchResults([]);
      setMapSearchMessage(status === maps.services.Status.ZERO_RESULT
        ? '검색 결과가 없습니다.'
        : '장소를 검색하지 못했습니다.');
    }, {
      category_group_code: 'FD6',
      location: map.getCenter(),
      size: 15,
    });
  }

  function selectSearchResult(result: KakaoPlaceSearchResult) {
    const maps = mapsRef.current;
    const map = mapRef.current;
    const location = { lat: Number(result.y), lng: Number(result.x) };
    if (!maps || !map || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
      setMapSearchMessage('검색한 장소의 위치를 확인할 수 없습니다.');
      return;
    }

    const position = createPosition(maps, location);
    map.setCenter(position);
    onSelectRestaurant({
      id: result.id,
      name: result.place_name,
      address: result.address_name,
      roadAddress: result.road_address_name,
      lat: location.lat,
      lng: location.lng,
      category: result.category_name,
      placeUrl: result.place_url,
    });
    setMapQuery(result.place_name || result.address_name);
    setMapSearchResults([]);
    setMapSearchMessage(undefined);
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
          draggable: !isSearchingRef.current,
          scrollwheel: !isSearchingRef.current,
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
          if (recommendationRef.current) {
            onCloseRecommendation();
            return;
          }
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
  }, [onCloseRecommendation, onSelectLocation]);

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
  }, [radius, selectedLocation, theme]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;

    map?.setDraggable(!isSearching);
    map?.setZoomable(!isSearching);

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
      <div className={styles.mapSearch}>
        <form className={styles.mapSearchForm} role="search" onSubmit={searchMap}>
          <Search aria-hidden="true" />
          <input
            type="text"
            value={mapQuery}
            placeholder="장소 또는 주소 검색"
            aria-label="지도 장소 검색"
            disabled={isSearching}
            onChange={(event) => {
              setMapQuery(event.target.value);
              if (!event.target.value) {
                setMapSearchResults([]);
                setMapSearchMessage(undefined);
              }
            }}
          />
          {mapQuery && (
            <button
              className={styles.mapSearchClear}
              type="button"
              aria-label="지도 검색어 지우기"
              onClick={() => {
                setMapQuery('');
                setMapSearchResults([]);
                setMapSearchMessage(undefined);
              }}
            >
              <X aria-hidden="true" />
            </button>
          )}
          <button
            className={styles.mapSearchSubmit}
            type="submit"
            disabled={isSearching || mapSearchLoading || !mapQuery.trim()}
          >
            {mapSearchLoading ? '검색 중' : '검색'}
          </button>
        </form>
        {mapSearchResults.length > 0 && (
          <ul className={styles.mapSearchResults}>
            {mapSearchResults.map((result) => (
              <li key={`${result.id}:${result.x}:${result.y}`}>
                <button type="button" onClick={() => selectSearchResult(result)}>
                  <strong>{result.place_name || result.address_name}</strong>
                  <span>{result.road_address_name || result.address_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {mapSearchMessage && (
          <p className={styles.mapSearchMessage} role="status">{mapSearchMessage}</p>
        )}
      </div>
      {errorMessage && (
        <p className={styles.error} role="alert">{errorMessage}</p>
      )}
    </section>
  );
}
