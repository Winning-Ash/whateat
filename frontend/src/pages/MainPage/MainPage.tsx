import { useCallback, useEffect, useState } from 'react';
import { ApiError, getRandomRestaurant } from '../../api';
import KakaoMap, { MapLocation } from '../../components/KakaoMap/KakaoMap';
import { getCurrentLocation, LocationError } from '../../hooks';
import { FOOD_CATEGORIES, FoodCategory, Restaurant } from '../../types';
import styles from './MainPage.module.css';

type PermissionDialog = 'request' | 'denied';
const RADAR_ROTATION_MS = 1600;

function waitForRadarRotation() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, RADAR_ROTATION_MS);
  });
}

export default function MainPage() {
  const [selectedLocation, setSelectedLocation] = useState<MapLocation>();
  const [radius, setRadius] = useState(300);
  const [category, setCategory] = useState<FoodCategory>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [permissionDialog, setPermissionDialog] = useState<PermissionDialog>();
  const [locating, setLocating] = useState(false);
  const [locationFocusKey, setLocationFocusKey] = useState(0);
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState<Restaurant>();
  const [notice, setNotice] = useState<string>();

  const selectLocation = useCallback((location: MapLocation) => {
    setSelectedLocation(location);
    setRecommendation(undefined);
    setNotice(undefined);
  }, []);

  const findCurrentLocation = useCallback(async () => {
    setLocating(true);
    setNotice(undefined);

    try {
      const location = await getCurrentLocation();
      selectLocation({ lat: location.lat, lng: location.lng });
      setLocationFocusKey((key) => key + 1);
      setPermissionDialog(undefined);
    } catch (error) {
      if (error instanceof LocationError && error.code === 'permission-denied') {
        setPermissionDialog('denied');
      } else {
        setNotice('현재 위치를 확인할 수 없습니다. 지도에서 위치를 선택해 주세요.');
      }
    } finally {
      setLocating(false);
    }
  }, [selectLocation]);

  useEffect(() => {
    let active = true;

    async function checkLocationPermission() {
      if (!('geolocation' in navigator)) {
        if (active) setNotice('이 브라우저는 위치 기능을 지원하지 않습니다.');
        return;
      }

      if (!navigator.permissions) {
        if (active) setPermissionDialog('request');
        return;
      }

      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (!active) return;
        if (permission.state === 'granted') void findCurrentLocation();
        else setPermissionDialog(permission.state === 'denied' ? 'denied' : 'request');
      } catch {
        if (active) setPermissionDialog('request');
      }
    }

    void checkLocationPermission();
    return () => { active = false; };
  }, [findCurrentLocation]);

  async function recommendRestaurant() {
    if (!selectedLocation) {
      setNotice('먼저 지도에서 위치를 선택해 주세요.');
      return;
    }

    setRecommending(true);
    setRecommendation(undefined);
    setNotice(undefined);

    try {
      const [result] = await Promise.all([
        getRandomRestaurant({
          ...selectedLocation,
          radius,
          category,
        }),
        waitForRadarRotation(),
      ]);
      setRecommendation(result.restaurant);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotice('선택한 조건에 맞는 음식점이 없습니다.');
      } else {
        setNotice('음식점을 추천하는 중 문제가 발생했습니다.');
      }
    } finally {
      setRecommending(false);
    }
  }

  return (
    <main className={styles.page}>
      <KakaoMap
        selectedLocation={selectedLocation}
        radius={radius}
        locationFocusKey={locationFocusKey}
        recommendation={recommendation}
        isSearching={recommending}
        onSelectLocation={selectLocation}
      />

      <button
        className={styles.menuButton}
        type="button"
        aria-label="검색 조건 열기"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span /><span /><span />
      </button>

      {menuOpen && (
        <aside className={styles.filterPanel} aria-label="음식점 검색 조건">
          <label className={styles.field}>
            <span>검색 반경</span>
            <select
              value={radius}
              disabled={recommending}
              onChange={(event) => setRadius(Number(event.target.value))}
            >
              {[100, 200, 300, 400, 500].map((value) => (
                <option key={value} value={value}>{value}m</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>메뉴 카테고리</span>
            <select
              value={category ?? ''}
              disabled={recommending}
              onChange={(event) => setCategory(event.target.value as FoodCategory || undefined)}
            >
              <option value="">전체</option>
              {FOOD_CATEGORIES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </aside>
      )}

      {recommendation && (
        <article className={styles.resultCard} aria-live="polite">
          <div>
            <strong>{recommendation.name}</strong>
            <p>{recommendation.roadAddress || recommendation.address}</p>
          </div>
          <a href={recommendation.placeUrl} target="_blank" rel="noreferrer">상세보기</a>
        </article>
      )}

      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <button
        className={styles.locationButton}
        type="button"
        aria-label="현재 위치 찾기"
        onClick={() => void findCurrentLocation()}
        disabled={locating || recommending}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>

      <button
        className={styles.rouletteButton}
        type="button"
        onClick={() => void recommendRestaurant()}
        disabled={recommending || locating}
      >
        {recommending ? '탐색 중...' : '룰렛'}
      </button>

      <nav className={styles.bottomBar} aria-label="하단 메뉴" />

      {permissionDialog && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.permissionDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-dialog-title"
          >
            <h2 id="location-dialog-title">위치 권한이 필요합니다</h2>
            <p>
              {permissionDialog === 'denied'
                ? '브라우저 설정에서 이 사이트의 위치 권한을 허용해 주세요.'
                : '현재 위치 기준으로 음식점을 추천하려면 위치 권한이 필요합니다.'}
            </p>
            <div className={styles.dialogActions}>
              <button type="button" onClick={() => setPermissionDialog(undefined)}>
                지도에서 선택
              </button>
              <button type="button" onClick={() => void findCurrentLocation()}>
                {permissionDialog === 'denied' ? '다시 시도' : '위치 허용'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
