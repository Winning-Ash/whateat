import { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, Crosshair, Ellipsis, House, Menu, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import {
  addExclusion,
  addLike,
  ApiError,
  getCurrentUser,
  getExclusions,
  getLikes,
  getRandomRestaurant,
  removeExclusion,
  removeLike,
} from '../../api';
import KakaoMap, { MapLocation } from '../../components/KakaoMap/KakaoMap';
import { getCurrentLocation, LocationError } from '../../hooks';
import {
  addLocalRestaurant,
  clearLocalRestaurantLists,
  getLocalRestaurantList,
  removeLocalRestaurant,
} from '../../storage/restaurant-lists';
import {
  AuthUser,
  FOOD_CATEGORIES,
  FoodCategory,
  Restaurant,
  SavedRestaurant,
} from '../../types';
import BookmarkTab from './tabs/BookmarkTab/BookmarkTab';
import MoreTab from './tabs/MoreTab/MoreTab';
import styles from './MainPage.module.css';

type PermissionDialog = 'request' | 'denied';
type NavigationItem = 'home' | 'bookmark' | 'more';
type SheetPosition = 'closed' | 'middle' | 'full';

const NAVIGATION_ITEMS = [
  { id: 'home', label: '홈', Icon: House },
  { id: 'bookmark', label: '북마크', Icon: Bookmark },
  { id: 'more', label: '더 보기', Icon: Ellipsis },
] as const;

const DRAG_THRESHOLD = 48;
const RADAR_ROTATION_MS = 1600;

function waitForRadarRotation() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, RADAR_ROTATION_MS);
  });
}

function formatRestaurantCategory(value: string): string {
  const categories = value
    .split('>')
    .map((category) => category.trim())
    .filter(Boolean);
  return categories.find((category) => category !== '음식점') ?? '기타';
}

export default function MainPage() {
  const [selectedLocation, setSelectedLocation] = useState<MapLocation>();
  const [permissionDialog, setPermissionDialog] = useState<PermissionDialog>();
  const [locating, setLocating] = useState(false);
  const [locationFocusKey, setLocationFocusKey] = useState(0);
  const [notice, setNotice] = useState<string>();
  const [radius, setRadius] = useState(300);
  const [category, setCategory] = useState<FoodCategory>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState<Restaurant>();
  const [savingList, setSavingList] = useState<'like' | 'exclusion'>();
  const [resultMessage, setResultMessage] = useState<string>();
  const [listStorage, setListStorage] = useState<'server' | 'local'>();
  const [likes, setLikes] = useState<SavedRestaurant[]>([]);
  const [exclusions, setExclusions] = useState<SavedRestaurant[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string>();
  const [user, setUser] = useState<AuthUser>();
  const [authChecking, setAuthChecking] = useState(true);
  const [activeItem, setActiveItem] = useState<NavigationItem>('home');
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>('closed');
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | undefined>(undefined);

  const selectLocation = useCallback((location: MapLocation) => {
    setSelectedLocation(location);
    setRecommendation(undefined);
    setResultMessage(undefined);
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
        setNotice('현재 위치를 확인할 수 없습니다.');
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

  useEffect(() => {
    let active = true;

    async function checkListStorage() {
      try {
        const response = await getCurrentUser();
        if (active) {
          setUser(response.user);
          setListStorage('server');
        }
      } catch (error) {
        if (active && error instanceof ApiError && error.status === 401) {
          setUser(undefined);
          setListStorage('local');
        }
      } finally {
        if (active) setAuthChecking(false);
      }
    }

    void checkListStorage();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!listStorage) return;

    let active = true;

    async function loadLists() {
      setListsLoading(true);
      setListsError(undefined);

      try {
        if (listStorage === 'local') {
          setLikes(getLocalRestaurantList('likes'));
          setExclusions(getLocalRestaurantList('exclusions'));
          return;
        }

        const [likesResponse, exclusionsResponse] = await Promise.all([
          getLikes(),
          getExclusions(),
        ]);
        if (!active) return;
        setLikes(likesResponse.likes);
        setExclusions(exclusionsResponse.exclusions);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(undefined);
          setListStorage('local');
        } else {
          setListsError('가게 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (active) setListsLoading(false);
      }
    }

    void loadLists();
    return () => { active = false; };
  }, [listStorage]);

  function selectNavigationItem(item: NavigationItem) {
    if (activeItem === item && sheetPosition !== 'closed') {
      setSheetPosition('closed');
      return;
    }

    setActiveItem(item);
    setSheetPosition('middle');
  }

  async function recommendRestaurant() {
    if (!selectedLocation) {
      setNotice('먼저 지도에서 위치를 선택해 주세요.');
      return;
    }

    setRecommending(true);
    setRecommendation(undefined);
    setResultMessage(undefined);
    setNotice(undefined);

    try {
      const [result] = await Promise.all([
        getRandomRestaurant({
          ...selectedLocation,
          radius,
          category,
          excludeIds: listStorage === 'local'
            ? getLocalRestaurantList('exclusions').map((item) => item.restaurantId)
            : undefined,
        }),
        waitForRadarRotation(),
      ]);
      setRecommendation(result.restaurant);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotice('선택한 반경 안에 음식점이 없습니다.');
      } else {
        setNotice('음식점을 추천하는 중 문제가 발생했습니다.');
      }
    } finally {
      setRecommending(false);
    }
  }

  const savedLists = {
    like: recommendation
      ? likes.some((item) => item.restaurantId === recommendation.id)
      : false,
    exclusion: recommendation
      ? exclusions.some((item) => item.restaurantId === recommendation.id)
      : false,
  };

  function updateListState(
    target: 'like' | 'exclusion',
    saved: boolean,
    restaurant: Restaurant,
  ) {
    const update = (items: SavedRestaurant[]) => saved
      ? [{
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        createdAt: new Date().toISOString(),
      }, ...items.filter((item) => item.restaurantId !== restaurant.id)]
      : items.filter((item) => item.restaurantId !== restaurant.id);

    if (target === 'like') setLikes(update);
    else setExclusions(update);
  }

  async function saveRecommendation(target: 'like' | 'exclusion') {
    if (!recommendation) return;

    setSavingList(target);
    setResultMessage(undefined);

    try {
      const saved = savedLists[target];
      const localType = target === 'like' ? 'likes' : 'exclusions';

      if (listStorage === 'local') {
        if (saved) removeLocalRestaurant(localType, recommendation.id);
        else addLocalRestaurant(localType, recommendation);
      } else {
        if (target === 'like') {
          if (saved) await removeLike(recommendation.id);
          else await addLike(recommendation);
        } else if (saved) {
          await removeExclusion(recommendation.id);
        } else {
          await addExclusion(recommendation);
        }
      }

      updateListState(target, !saved, recommendation);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        try {
          const saved = savedLists[target];
          const localType = target === 'like' ? 'likes' : 'exclusions';
          if (saved) removeLocalRestaurant(localType, recommendation.id);
          else addLocalRestaurant(localType, recommendation);
          setUser(undefined);
          setListStorage('local');
          updateListState(target, !saved, recommendation);
        } catch {
          setResultMessage('브라우저에 가게를 저장하지 못했습니다.');
        }
      } else {
        setResultMessage('가게를 저장하지 못했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setSavingList(undefined);
    }
  }

  function closeRecommendation() {
    setRecommendation(undefined);
    setResultMessage(undefined);
  }

  async function removeSavedRestaurant(type: 'likes' | 'exclusions', restaurantId: string) {
    try {
      if (listStorage === 'local') {
        removeLocalRestaurant(type, restaurantId);
      } else if (type === 'likes') {
        await removeLike(restaurantId);
      } else {
        await removeExclusion(restaurantId);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(undefined);
        setListStorage('local');
      }
      throw error;
    }

    if (type === 'likes') {
      setLikes((items) => items.filter((item) => item.restaurantId !== restaurantId));
    } else {
      setExclusions((items) => items.filter((item) => item.restaurantId !== restaurantId));
    }
  }

  function handleLoggedOut() {
    setUser(undefined);
    setListStorage('local');
  }

  function handleWithdrawn() {
    clearLocalRestaurantLists();
    setUser(undefined);
    setLikes([]);
    setExclusions([]);
    setListStorage('local');
  }

  function startSheetDrag(event: React.PointerEvent<HTMLDivElement>) {
    dragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSheet(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStartY.current === undefined) return;
    const offset = event.clientY - dragStartY.current;
    setDragOffset(sheetPosition === 'full' ? Math.max(0, offset) : offset);
  }

  function endSheetDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStartY.current === undefined) return;

    const distance = event.clientY - dragStartY.current;
    dragStartY.current = undefined;
    setDragOffset(0);

    if (distance <= -DRAG_THRESHOLD && sheetPosition === 'middle') {
      setSheetPosition('full');
    } else if (distance >= DRAG_THRESHOLD) {
      setSheetPosition(sheetPosition === 'full' ? 'middle' : 'closed');
    }
  }

  function blockInteractionDuringRecommendation(event: React.SyntheticEvent) {
    if (!recommending) return;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <main
      className={styles.page}
      aria-busy={recommending}
      onClickCapture={blockInteractionDuringRecommendation}
      onKeyDownCapture={blockInteractionDuringRecommendation}
      onPointerDownCapture={blockInteractionDuringRecommendation}
    >
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
        aria-label={filterOpen ? '검색 조건 닫기' : '검색 조건 열기'}
        aria-expanded={filterOpen}
        aria-controls="map-filter-panel"
        onClick={() => setFilterOpen((open) => !open)}
      >
        {filterOpen
          ? <X aria-hidden="true" strokeWidth={2.2} />
          : <Menu aria-hidden="true" strokeWidth={2.2} />}
      </button>

      <aside
        id="map-filter-panel"
        className={`${styles.filterPanel} ${filterOpen ? styles.filterPanelOpen : ''}`}
        aria-hidden={!filterOpen}
      >
        <div className={styles.radiusControl}>
          <div className={styles.filterHeading}>
            <span>거리</span>
            <strong>{radius}m</strong>
          </div>
          <input
            type="range"
            min="100"
            max="500"
            step="100"
            value={radius}
            aria-label="검색 반경"
            disabled={recommending}
            onChange={(event) => setRadius(Number(event.target.value))}
          />
        </div>

        <div className={styles.categoryControl}>
          <span className={styles.categoryLabel}>카테고리</span>
          <div className={styles.categoryList}>
            <button
              className={category === undefined ? styles.selectedCategory : ''}
              type="button"
              aria-pressed={category === undefined}
              disabled={recommending}
              onClick={() => setCategory(undefined)}
            >
              전체
            </button>
            {FOOD_CATEGORIES.map((value) => (
              <button
                key={value}
                className={category === value ? styles.selectedCategory : ''}
                type="button"
                aria-pressed={category === value}
                disabled={recommending}
                onClick={() => setCategory(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {recommendation && (
        <article className={styles.resultCard} aria-live="polite">
          <button
            className={styles.resultCloseButton}
            type="button"
            aria-label="추천 결과 닫기"
            onClick={closeRecommendation}
          >
            <X aria-hidden="true" />
          </button>
          <div className={styles.resultInformation}>
            <span className={styles.resultCategory}>
              {formatRestaurantCategory(recommendation.category)}
            </span>
            <h2>{recommendation.name}</h2>
            <p>{recommendation.roadAddress || recommendation.address}</p>
          </div>
          <div className={styles.resultActions}>
            <button
              type="button"
              className={savedLists.like ? styles.savedAction : ''}
              aria-pressed={savedLists.like}
              disabled={savingList !== undefined}
              onClick={() => void saveRecommendation('like')}
            >
              <ThumbsUp aria-hidden="true" fill={savedLists.like ? 'currentColor' : 'none'} />
              {savingList === 'like'
                ? (savedLists.like ? '삭제 중...' : '저장 중...')
                : '좋아요'}
            </button>
            <button
              type="button"
              className={savedLists.exclusion ? styles.savedAction : ''}
              aria-pressed={savedLists.exclusion}
              disabled={savingList !== undefined}
              onClick={() => void saveRecommendation('exclusion')}
            >
              <ThumbsDown aria-hidden="true" fill={savedLists.exclusion ? 'currentColor' : 'none'} />
              {savingList === 'exclusion'
                ? (savedLists.exclusion ? '삭제 중...' : '저장 중...')
                : '싫어요'}
            </button>
            <a href={recommendation.placeUrl} target="_blank" rel="noreferrer">
              카카오맵에서 보기
            </a>
          </div>
          {resultMessage && <p className={styles.resultMessage} role="status">{resultMessage}</p>}
        </article>
      )}

      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <button
        className={styles.locationButton}
        type="button"
        aria-label="현재 위치로 이동"
        onClick={() => void findCurrentLocation()}
        disabled={locating || recommending}
      >
        <Crosshair aria-hidden="true" strokeWidth={2.2} />
      </button>

      {!recommendation && (
        <button
          className={styles.rouletteButton}
          type="button"
          onClick={() => void recommendRestaurant()}
          disabled={recommending || locating}
        >
          {recommending ? '탐색 중...' : '룰렛'}
        </button>
      )}

      {recommending && (
        <div className={styles.interactionLock} role="status" aria-live="polite">
          <span className={styles.visuallyHidden}>추천 결과를 찾는 중입니다.</span>
        </div>
      )}

      {sheetPosition !== 'closed' && (
        <button
          className={styles.sheetBackdrop}
          type="button"
          aria-label="하단 화면 닫기"
          onClick={() => setSheetPosition('closed')}
        />
      )}

      <section
        className={`${styles.bottomSheet} ${styles[sheetPosition]}`}
        style={{ '--drag-offset': `${dragOffset}px` } as React.CSSProperties}
        aria-hidden={sheetPosition === 'closed'}
      >
        <div
          className={styles.sheetHandleArea}
          onPointerDown={startSheetDrag}
          onPointerMove={moveSheet}
          onPointerUp={endSheetDrag}
          onPointerCancel={endSheetDrag}
        >
          <span className={styles.sheetHandle} />
        </div>
        <div className={styles.sheetContent}>
          {sheetPosition !== 'closed' && activeItem === 'bookmark' && listStorage && (
            <BookmarkTab
              likes={likes}
              exclusions={exclusions}
              loading={listsLoading}
              errorMessage={listsError}
              onRemove={removeSavedRestaurant}
            />
          )}
          {sheetPosition !== 'closed' && activeItem === 'more' && (
            <MoreTab
              user={user}
              checkingSession={authChecking}
              onLoggedOut={handleLoggedOut}
              onWithdrawn={handleWithdrawn}
            />
          )}
        </div>
      </section>

      <nav className={styles.bottomBar} aria-label="주요 메뉴">
        {NAVIGATION_ITEMS.map(({ id, label, Icon }) => {
          const selected = activeItem === id;
          return (
            <button
              key={id}
              className={selected ? styles.activeNavigationItem : styles.navigationItem}
              type="button"
              aria-label={label}
              aria-pressed={selected && sheetPosition !== 'closed'}
              onClick={() => selectNavigationItem(id)}
            >
              <Icon aria-hidden="true" fill="none" strokeWidth={2.1} />
            </button>
          );
        })}
      </nav>

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
                : '현재 위치를 확인하려면 위치 권한이 필요합니다.'}
            </p>
            <div className={styles.dialogActions}>
              <button type="button" onClick={() => setPermissionDialog(undefined)}>
                나중에
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
