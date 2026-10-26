import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  Crosshair,
  Dices,
  Ellipsis,
  LoaderCircle,
  MapPin,
  Menu,
  Settings,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import {
  addExclusion,
  ApiError,
  getCurrentUser,
  getExclusions,
  getRandomRestaurant,
  removeExclusion,
} from '../../api';
import KakaoMap, { MapLocation } from '../../components/KakaoMap/KakaoMap';
import { getCurrentLocation, LocationError } from '../../hooks';
import { useLikeLists } from '../../hooks/like-lists';
import {
  addLocalRestaurant,
  addTemporaryExclusion,
  clearLocalRestaurantLists,
  getLocalRestaurantList,
  getTemporaryExclusionList,
  removeLocalRestaurant,
  removeTemporaryExclusion,
  type TemporarySavedRestaurant,
} from '../../storage/restaurant-lists';
import { type PinColorId, type ThemeId } from '../../styles/theme';
import {
  AuthUser,
  FOOD_CATEGORIES,
  FoodCategory,
  Restaurant,
  SavedRestaurant,
} from '../../types';
import AccountManagement from './tabs/MoreTab/AccountManagement/AccountManagement';
import MoreTab from './tabs/MoreTab/MoreTab';
import Policies from './tabs/MoreTab/Policies/Policies';
import ThemeSettings from './tabs/MoreTab/ThemeSettings/ThemeSettings';
import SavedListTab from './tabs/SavedListTab/SavedListTab';
import TodayRecordTab, {
  type RouletteLogEntry,
} from './tabs/TodayRecordTab/TodayRecordTab';
import LikeSaveDialog from './LikeSaveDialog';
import styles from './MainPage.module.css';

type PermissionDialog = 'request' | 'denied';
type NavigationItem = 'home' | 'likes' | 'exclusions' | 'more';

const NAVIGATION_ITEMS = [
  { id: 'home', label: '오늘 기록', Icon: Clock3 },
  { id: 'likes', label: '좋아요', Icon: ThumbsUp },
  { id: 'exclusions', label: '싫어요', Icon: ThumbsDown },
  { id: 'more', label: '더 보기', Icon: Ellipsis },
] as const;

const RADAR_ROTATION_MS = 1600;
const MAX_SAVED_LIKES = 100;
const MAX_ROULETTE_LOGS = 20;
const MORE_PAGE_TITLES = {
  main: '더 보기',
  account: '계정관리',
  theme: '테마 설정',
  policies: '약관 및 정책',
  terms: '이용 약관',
  privacy: '개인 정보 처리 방침',
} as const;

type MorePage = keyof typeof MORE_PAGE_TITLES;

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

function formatRestaurantDistance(center: MapLocation, restaurant: MapLocation): string | undefined {
  if (![center.lat, center.lng, restaurant.lat, restaurant.lng].every(Number.isFinite)) {
    return undefined;
  }

  const radians = Math.PI / 180;
  const latitudeDifference = (restaurant.lat - center.lat) * radians;
  const longitudeDifference = (restaurant.lng - center.lng) * radians;
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(center.lat * radians) * Math.cos(restaurant.lat * radians)
    * Math.sin(longitudeDifference / 2) ** 2;
  const distanceMeters = 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
  const roundedMeters = Math.round(distanceMeters);

  return roundedMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(1)}km`
    : `${roundedMeters}m`;
}

interface MainPageProps {
  theme: ThemeId;
  pinColor: PinColorId;
  onThemeChange(theme: ThemeId): void;
  onPinColorChange(pinColor: PinColorId): void;
}

export default function MainPage({ theme, pinColor, onThemeChange, onPinColorChange }: MainPageProps) {
  const [morePage, setMorePage] = useState<MorePage>('main');
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
  const [likeDialogOpen, setLikeDialogOpen] = useState(false);
  const [savingList, setSavingList] = useState<'like' | 'exclusion'>();
  const savingListInProgress = useRef(false);
  const [resultMessage, setResultMessage] = useState<string>();
  const [listStorage, setListStorage] = useState<'server' | 'local'>();
  const [exclusions, setExclusions] = useState<SavedRestaurant[]>([]);
  const [temporaryExclusions, setTemporaryExclusions] = useState<TemporarySavedRestaurant[]>(
    () => getTemporaryExclusionList(),
  );
  const [rouletteLogs, setRouletteLogs] = useState<RouletteLogEntry[]>([]);
  const rouletteLogSequence = useRef(0);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string>();
  const [user, setUser] = useState<AuthUser>();
  const [authChecking, setAuthChecking] = useState(true);
  const [activeItem, setActiveItem] = useState<NavigationItem>('home');
  const [panelOpen, setPanelOpen] = useState(false);
  const navigationToggleRef = useRef<HTMLButtonElement>(null);

  const handleLoggedOut = useCallback(() => {
    setUser(undefined);
    setListStorage('local');
    setLikeDialogOpen(false);
  }, []);
  const likeLists = useLikeLists(listStorage, handleLoggedOut);

  const selectLocation = useCallback((location: MapLocation) => {
    setLikeDialogOpen(false);
    setSelectedLocation(location);
    setRecommendation(undefined);
    setResultMessage(undefined);
    setNotice(undefined);
  }, []);

  const selectSearchedRestaurant = useCallback((restaurant: Restaurant) => {
    setLikeDialogOpen(false);
    setRecommendation(restaurant);
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
          setExclusions(getLocalRestaurantList('exclusions'));
          return;
        }

        const exclusionsResponse = await getExclusions();
        if (!active) return;
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

  useEffect(() => {
    if (temporaryExclusions.length === 0) return;

    const nextExpiry = Math.min(...temporaryExclusions.map((item) => item.expiresAt));
    const timeoutId = window.setTimeout(() => {
      setTemporaryExclusions(getTemporaryExclusionList());
    }, Math.max(0, nextExpiry - Date.now() + 50));

    return () => window.clearTimeout(timeoutId);
  }, [temporaryExclusions]);

  function selectNavigationItem(item: NavigationItem) {
    setMorePage('main');
    setActiveItem(item);
    setPanelOpen(true);
  }

  function closeNavigationMenu() {
    setPanelOpen(false);
    window.requestAnimationFrame(() => navigationToggleRef.current?.focus());
  }

  function openNavigationMenu() {
    setFilterOpen(false);
    setPanelOpen(true);
  }

  async function recommendRestaurant() {
    if (!selectedLocation) {
      setNotice('먼저 지도에서 위치를 선택해 주세요.');
      return;
    }

    setRecommending(true);
    setLikeDialogOpen(false);
    setRecommendation(undefined);
    setResultMessage(undefined);
    setNotice(undefined);

    try {
      const activeTemporaryExclusions = getTemporaryExclusionList();
      const activeTemporaryExclusionIds = activeTemporaryExclusions
        .map((item) => item.restaurantId);
      const persistentExclusionIds = listStorage === 'local'
        ? getLocalRestaurantList('exclusions').map((item) => item.restaurantId)
        : [];
      const excludeIds = [...new Set([
        ...persistentExclusionIds,
        ...activeTemporaryExclusionIds,
      ])];

      setTemporaryExclusions(activeTemporaryExclusions);

      const [result] = await Promise.all([
        getRandomRestaurant({
          ...selectedLocation,
          radius,
          category,
          excludeIds,
        }),
        waitForRadarRotation(),
      ]);
      setRecommendation(result.restaurant);
      rouletteLogSequence.current += 1;
      setRouletteLogs((logs) => [{
        logId: rouletteLogSequence.current,
        restaurantId: result.restaurant.id,
        restaurantName: result.restaurant.name,
        placeUrl: result.restaurant.placeUrl,
        createdAt: new Date().toISOString(),
      }, ...logs].slice(0, MAX_ROULETTE_LOGS));
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

  const recommendationDistance = selectedLocation && recommendation
    ? formatRestaurantDistance(selectedLocation, recommendation)
    : undefined;
  const savedLists = {
    like: recommendation
      ? likeLists.allLikedIds.has(recommendation.id)
      : false,
    exclusion: recommendation
      ? exclusions.some((item) => item.restaurantId === recommendation.id)
      : false,
  };
  const temporarilyExcluded = recommendation
    ? temporaryExclusions.some((item) => item.restaurantId === recommendation.id)
    : false;
  const savedListsUnavailable = !listStorage || listsLoading || Boolean(listsError)
    || likeLists.loading || likeLists.saving || Boolean(likeLists.error);
  const likedInAnyList = recommendation ? likeLists.allLikedIds.has(recommendation.id) : false;
  const blockedListActions = {
    like: !savedLists.like && (savedLists.exclusion || savedListsUnavailable),
    exclusion: !savedLists.exclusion && (likedInAnyList || savedListsUnavailable),
  };

  function updateExclusionState(saved: boolean, restaurant: Restaurant) {
    const update = (items: SavedRestaurant[]) => saved
      ? [{
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        createdAt: new Date().toISOString(),
      }, ...items.filter((item) => item.restaurantId !== restaurant.id)]
      : items.filter((item) => item.restaurantId !== restaurant.id);

    setExclusions(update);
  }

  async function saveRecommendation(target: 'like' | 'exclusion') {
    if (!recommendation || savingListInProgress.current) return;

    if (savedListsUnavailable) {
      setResultMessage('저장한 목록을 확인한 뒤 다시 시도해 주세요.');
      return;
    }

    if (blockedListActions[target]) {
      const oppositeSaved = target === 'like' ? savedLists.exclusion : likedInAnyList;
      setResultMessage(oppositeSaved
        ? (target === 'like'
          ? '먼저 싫어요 선택을 해제해 주세요.'
          : '먼저 모든 좋아요 목록에서 이 가게를 제거해 주세요.')
        : '저장한 목록을 확인한 뒤 다시 시도해 주세요.');
      return;
    }

    if (target === 'like') {
      setResultMessage(undefined);
      setLikeDialogOpen(true);
      return;
    }

    savingListInProgress.current = true;
    setSavingList(target);
    setResultMessage(undefined);

    try {
      const saved = savedLists[target];
      if (listStorage === 'local') {
        if (saved) removeLocalRestaurant('exclusions', recommendation.id);
        else addLocalRestaurant('exclusions', recommendation);
      } else if (saved) {
        await removeExclusion(recommendation.id);
      } else {
        await addExclusion(recommendation);
      }

      updateExclusionState(!saved, recommendation);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        try {
          const saved = savedLists[target];
          if (saved) removeLocalRestaurant('exclusions', recommendation.id);
          else addLocalRestaurant('exclusions', recommendation);
          setUser(undefined);
          setListStorage('local');
          updateExclusionState(!saved, recommendation);
        } catch {
          setResultMessage('브라우저에 가게를 저장하지 못했습니다.');
        }
      } else {
        setResultMessage('가게를 저장하지 못했습니다. 다시 시도해 주세요.');
      }
    } finally {
      savingListInProgress.current = false;
      setSavingList(undefined);
    }
  }

  async function saveLikedRecommendation(listIds: string[]) {
    if (!recommendation || savingListInProgress.current || savedListsUnavailable) {
      throw new Error('저장한 목록을 확인한 뒤 다시 시도해 주세요.');
    }
    const addingToList = likeLists.lists.some((list) => listIds.includes(list.id)
      && !list.likes.some((item) => item.restaurantId === recommendation.id));
    if (addingToList && savedLists.exclusion) {
      throw new Error('먼저 싫어요 선택을 해제해 주세요.');
    }
    if (listIds.length > 0 && !likedInAnyList && likeLists.allLikedIds.size >= MAX_SAVED_LIKES) {
      throw new Error(`좋아요는 최대 ${MAX_SAVED_LIKES}개까지 저장할 수 있습니다.`);
    }

    savingListInProgress.current = true;
    setSavingList('like');
    try {
      await likeLists.saveRestaurant(recommendation, listIds);
      setResultMessage(undefined);
    } catch (error) {
      setResultMessage(error instanceof Error ? error.message : '좋아요를 저장하지 못했습니다.');
      throw error;
    } finally {
      savingListInProgress.current = false;
      setSavingList(undefined);
    }
  }

  function temporarilyExcludeRecommendation() {
    if (!recommendation) return;

    setResultMessage(undefined);

    try {
      if (temporarilyExcluded) removeTemporaryExclusion(recommendation.id);
      else addTemporaryExclusion(recommendation);
      setTemporaryExclusions(getTemporaryExclusionList());
    } catch {
      setResultMessage('브라우저에 임시 제외 목록을 저장하지 못했습니다.');
    }
  }

  const closeRecommendation = useCallback(() => {
    setLikeDialogOpen(false);
    setRecommendation(undefined);
    setResultMessage(undefined);
  }, []);

  async function removeSavedRestaurant(
    type: 'exclusions' | 'temporaryExclusions',
    restaurantId: string,
  ) {
    try {
      if (type === 'temporaryExclusions') {
        removeTemporaryExclusion(restaurantId);
      } else if (listStorage === 'local') {
        removeLocalRestaurant('exclusions', restaurantId);
      } else {
        await removeExclusion(restaurantId);
      }
    } catch (error) {
      if (type !== 'temporaryExclusions' && error instanceof ApiError && error.status === 401) {
        setUser(undefined);
        setListStorage('local');
      }
      throw error;
    }

    if (type === 'temporaryExclusions') {
      setTemporaryExclusions(getTemporaryExclusionList());
    } else if (type === 'exclusions') {
      setExclusions((items) => items.filter((item) => item.restaurantId !== restaurantId));
    }
  }

  function handleWithdrawn() {
    clearLocalRestaurantLists();
    setMorePage('main');
    setUser(undefined);
    setExclusions([]);
    setTemporaryExclusions([]);
    setListStorage('local');
  }

  function blockInteractionDuringRecommendation(event: React.SyntheticEvent) {
    if (!recommending) return;
    event.preventDefault();
    event.stopPropagation();
  }

  const policyDocumentOpen = morePage === 'terms' || morePage === 'privacy';
  const panelTitle = activeItem === 'more'
    ? MORE_PAGE_TITLES[morePage]
    : activeItem === 'home'
      ? '오늘 기록'
      : NAVIGATION_ITEMS.find((item) => item.id === activeItem)?.label;

  return (
    <main
      className={styles.page}
      aria-busy={recommending}
      onClickCapture={blockInteractionDuringRecommendation}
      onKeyDownCapture={blockInteractionDuringRecommendation}
      onPointerDownCapture={blockInteractionDuringRecommendation}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && panelOpen) {
          event.preventDefault();
          closeNavigationMenu();
        }
      }}
    >
      <KakaoMap
        theme={theme}
        selectedLocation={selectedLocation}
        radius={radius}
        locationFocusKey={locationFocusKey}
        recommendation={recommendation}
        isSearching={recommending}
        onCloseRecommendation={closeRecommendation}
        onSelectLocation={selectLocation}
        onSelectRestaurant={selectSearchedRestaurant}
      />

      <aside
        id="map-filter-panel"
        className={`${styles.filterPanel} ${filterOpen ? styles.filterPanelOpen : ''}`}
        aria-hidden={!filterOpen}
      >
        <div className={styles.radiusControl}>
          <div className={styles.filterHeading}>
            <span className={styles.categoryLabel}>거리</span>
            <strong>{radius}m</strong>
          </div>
          <input
            type="range"
            min="100"
            max="500"
            step="100"
            value={radius}
            style={{ '--range-progress': `${((radius - 100) / 400) * 100}%` } as React.CSSProperties}
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
        <>
          <article className={styles.resultCard} aria-live="polite">
            <header className={styles.resultHeader}>
              <span className={styles.resultCategory}>
                {formatRestaurantCategory(recommendation.category)}
              </span>
              <button
                className={styles.resultCloseButton}
                type="button"
                aria-label="추천 결과 닫기"
                onClick={closeRecommendation}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className={styles.resultInformation}>
              <h2>{recommendation.name}</h2>
              <p>
                <MapPin aria-hidden="true" />
                <span>{recommendation.roadAddress || recommendation.address}</span>
              </p>
              {recommendationDistance !== undefined && (
                <p>
                  <Crosshair aria-hidden="true" />
                  <span>{recommendationDistance}</span>
                </p>
              )}
            </div>
            <div className={styles.resultActions}>
              <button
                type="button"
                className={savedLists.like ? styles.savedAction : ''}
                aria-haspopup="dialog"
                aria-expanded={likeDialogOpen}
                aria-busy={savingList === 'like'}
                aria-label={savingList === 'like'
                  ? '좋아요 저장 중'
                  : '좋아요 저장할 목록 선택'}
                title={!savedLists.like && savedLists.exclusion
                  ? '싫어요 선택을 먼저 해제해 주세요.'
                  : undefined}
                data-selection-blocked={blockedListActions.like}
                disabled={savingList !== undefined || savedListsUnavailable || blockedListActions.like}
                onClick={() => void saveRecommendation('like')}
              >
                {savingList === 'like' ? (
                  <LoaderCircle className={styles.resultActionSpinner} aria-hidden="true" />
                ) : (
                  <ThumbsUp aria-hidden="true" fill={savedLists.like ? 'currentColor' : 'none'} />
                )}
                <span>좋아요</span>
              </button>
              <button
                type="button"
                className={savedLists.exclusion ? styles.savedAction : ''}
                aria-pressed={savedLists.exclusion}
                aria-busy={savingList === 'exclusion'}
                aria-label={savingList === 'exclusion'
                  ? `싫어요 ${savedLists.exclusion ? '삭제' : '저장'} 중`
                  : '싫어요'}
                title={!savedLists.exclusion && likedInAnyList
                  ? '모든 좋아요 목록에서 이 가게를 먼저 제거해 주세요.'
                  : undefined}
                data-selection-blocked={blockedListActions.exclusion}
                disabled={savingList !== undefined || savedListsUnavailable || blockedListActions.exclusion}
                onClick={() => void saveRecommendation('exclusion')}
              >
                {savingList === 'exclusion' ? (
                  <LoaderCircle className={styles.resultActionSpinner} aria-hidden="true" />
                ) : (
                  <ThumbsDown aria-hidden="true" fill={savedLists.exclusion ? 'currentColor' : 'none'} />
                )}
                <span>싫어요</span>
              </button>
              <button
                type="button"
                className={temporarilyExcluded ? styles.savedAction : ''}
                aria-label="지금은 싫어요"
                aria-pressed={temporarilyExcluded}
                onClick={temporarilyExcludeRecommendation}
              >
                <Clock3 aria-hidden="true" strokeWidth={temporarilyExcluded ? 3 : 2} />
                <span>지금은 싫어요</span>
              </button>
            </div>
            <a
              className={styles.resultMapLink}
              href={recommendation.placeUrl}
              target="_blank"
              rel="noreferrer"
            >
              카카오맵에서 보기
              <ArrowUpRight aria-hidden="true" />
            </a>
            {resultMessage && <p className={styles.resultMessage} role="status">{resultMessage}</p>}
          </article>
        </>
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

      <div className={styles.rouletteControls} role="group" aria-label="룰렛과 설정">
        <button
          className={styles.rouletteButton}
          type="button"
          aria-label={recommending ? '음식점 탐색 중' : '룰렛으로 음식점 추천'}
          onClick={() => void recommendRestaurant()}
          disabled={recommending || locating}
        >
          <Dices aria-hidden="true" strokeWidth={2.2} />
        </button>
        <button
          className={styles.settingsButton}
          type="button"
          aria-label={filterOpen ? '룰렛 설정 닫기' : '룰렛 설정 열기'}
          aria-expanded={filterOpen}
          aria-controls="map-filter-panel"
          onClick={() => setFilterOpen((open) => !open)}
        >
          <Settings aria-hidden="true" strokeWidth={2.2} />
        </button>
      </div>

      {recommending && (
        <div className={styles.interactionLock} role="status" aria-live="polite">
          <span className={styles.visuallyHidden}>추천 결과를 찾는 중입니다.</span>
        </div>
      )}

      {panelOpen && (
        <button
          className={styles.sheetBackdrop}
          type="button"
          aria-label="사이드 패널 닫기"
          onClick={closeNavigationMenu}
        />
      )}

      <section
        id="navigation-side-panel"
        className={`${styles.sidePanel} ${panelOpen ? styles.sidePanelOpen : ''}`}
        aria-hidden={!panelOpen}
        inert={!panelOpen}
      >
        <header className={styles.sidePanelHeader}>
          {activeItem === 'more' && morePage !== 'main' && (
            <button
              key={morePage}
              className={styles.sidePanelBackButton}
              type="button"
              aria-label={policyDocumentOpen ? '약관 및 정책으로 돌아가기' : '더보기로 돌아가기'}
              onClick={() => setMorePage(policyDocumentOpen ? 'policies' : 'main')}
              autoFocus
            >
              <ArrowLeft aria-hidden="true" />
            </button>
          )}
          <h2>{panelTitle}</h2>
          <button
            className={styles.sidePanelCloseButton}
            type="button"
            aria-label="사이드 패널 닫기"
            onClick={closeNavigationMenu}
          >
            <X aria-hidden="true" strokeWidth={2.2} />
          </button>
        </header>
        <div className={styles.sheetContent} key={activeItem === 'more' ? morePage : activeItem}>
          {panelOpen && activeItem === 'home' && (
            <TodayRecordTab
              rouletteLogs={rouletteLogs}
              items={temporaryExclusions}
              onRemove={removeSavedRestaurant}
            />
          )}
          {panelOpen
            && (activeItem === 'likes' || activeItem === 'exclusions')
            && listStorage && (
            <SavedListTab
              key={`${activeItem}:${listStorage}`}
              listType={activeItem}
              items={activeItem === 'likes' ? [] : exclusions}
              loading={activeItem === 'likes' ? likeLists.loading : listsLoading}
              errorMessage={activeItem === 'likes' ? likeLists.error : listsError}
              likeLists={activeItem === 'likes' ? likeLists : undefined}
              onRemove={removeSavedRestaurant}
            />
          )}
          {panelOpen && activeItem === 'more' && (
            morePage === 'account' && user ? (
              <AccountManagement
                onWithdrawn={handleWithdrawn}
              />
            ) : morePage === 'theme' ? (
              <ThemeSettings
                theme={theme}
                pinColor={pinColor}
                onThemeChange={onThemeChange}
                onPinColorChange={onPinColorChange}
              />
            ) : morePage === 'policies' || morePage === 'terms' || morePage === 'privacy' ? (
              <Policies page={morePage} onSelectDocument={setMorePage} />
            ) : (
              <MoreTab
                onOpenAccountManagement={() => setMorePage('account')}
                onOpenThemeSettings={() => setMorePage('theme')}
                onOpenPolicies={() => setMorePage('policies')}
                user={user}
                checkingSession={authChecking}
                onLoggedOut={handleLoggedOut}
              />
            )
          )}
        </div>
      </section>

      <div className={`${styles.bottomBar} ${panelOpen ? styles.bottomBarOpen : ''}`}>
        <button
          ref={navigationToggleRef}
          className={styles.navigationToggle}
          type="button"
          aria-label="메뉴와 사이드 패널 열기"
          aria-expanded={panelOpen}
          aria-controls="floating-navigation navigation-side-panel"
          aria-hidden={panelOpen}
          inert={panelOpen}
          onClick={openNavigationMenu}
        >
          <Menu aria-hidden="true" strokeWidth={2.2} />
        </button>
        <nav
          id="floating-navigation"
          className={styles.bottomNavigation}
          aria-label="주요 메뉴"
          aria-hidden={!panelOpen}
          inert={!panelOpen}
        >
          {NAVIGATION_ITEMS.map(({ id, label, Icon }) => {
            const selected = panelOpen && activeItem === id;
            return (
              <button
                key={id}
                className={selected ? styles.activeNavigationItem : styles.navigationItem}
                type="button"
                aria-label={label}
                aria-pressed={selected}
                onClick={() => selectNavigationItem(id)}
              >
                <Icon
                  aria-hidden="true"
                  fill={selected && (id === 'likes' || id === 'exclusions')
                    ? 'currentColor'
                    : 'none'}
                  strokeWidth={2.1}
                />
              </button>
            );
          })}
        </nav>
      </div>

      {likeDialogOpen && recommendation && (
        <LikeSaveDialog
          key={recommendation.id}
          restaurant={recommendation}
          likeLists={likeLists}
          saving={savingList === 'like'}
          onSave={saveLikedRecommendation}
          onClose={() => setLikeDialogOpen(false)}
        />
      )}

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
