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
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
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
import ThemeSettings from './tabs/MoreTab/ThemeSettings/ThemeSettings';
import SavedListTab from './tabs/SavedListTab/SavedListTab';
import TodayRecordTab, {
  type RouletteLogEntry,
} from './tabs/TodayRecordTab/TodayRecordTab';
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

interface MainPageProps {
  theme: ThemeId;
  pinColor: PinColorId;
  onThemeChange(theme: ThemeId): void;
  onPinColorChange(pinColor: PinColorId): void;
}

export default function MainPage({ theme, pinColor, onThemeChange, onPinColorChange }: MainPageProps) {
  const [accountManagementOpen, setAccountManagementOpen] = useState(false);
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
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
  const savingListInProgress = useRef(false);
  const [resultMessage, setResultMessage] = useState<string>();
  const [listStorage, setListStorage] = useState<'server' | 'local'>();
  const [likes, setLikes] = useState<SavedRestaurant[]>([]);
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

  const selectLocation = useCallback((location: MapLocation) => {
    setSelectedLocation(location);
    setRecommendation(undefined);
    setResultMessage(undefined);
    setNotice(undefined);
  }, []);

  const selectSearchedRestaurant = useCallback((restaurant: Restaurant) => {
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

  useEffect(() => {
    if (temporaryExclusions.length === 0) return;

    const nextExpiry = Math.min(...temporaryExclusions.map((item) => item.expiresAt));
    const timeoutId = window.setTimeout(() => {
      setTemporaryExclusions(getTemporaryExclusionList());
    }, Math.max(0, nextExpiry - Date.now() + 50));

    return () => window.clearTimeout(timeoutId);
  }, [temporaryExclusions]);

  function selectNavigationItem(item: NavigationItem) {
    setAccountManagementOpen(false);
    setThemeSettingsOpen(false);
    if (activeItem === item && panelOpen) {
      setPanelOpen(false);
      return;
    }

    setActiveItem(item);
    setPanelOpen(true);
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

  const savedLists = {
    like: recommendation
      ? likes.some((item) => item.restaurantId === recommendation.id)
      : false,
    exclusion: recommendation
      ? exclusions.some((item) => item.restaurantId === recommendation.id)
      : false,
  };
  const temporarilyExcluded = recommendation
    ? temporaryExclusions.some((item) => item.restaurantId === recommendation.id)
    : false;
  const savedListsUnavailable = !listStorage || listsLoading || Boolean(listsError);
  const blockedListActions = {
    like: !savedLists.like && (savedLists.exclusion || savedListsUnavailable),
    exclusion: !savedLists.exclusion && (savedLists.like || savedListsUnavailable),
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
    if (!recommendation || savingListInProgress.current) return;

    if (blockedListActions[target]) {
      const oppositeSaved = target === 'like' ? savedLists.exclusion : savedLists.like;
      setResultMessage(oppositeSaved
        ? `먼저 ${target === 'like' ? '싫어요' : '좋아요'} 선택을 해제해 주세요.`
        : '저장한 목록을 확인한 뒤 다시 시도해 주세요.');
      return;
    }

    if (target === 'like' && !savedLists.like && likes.length >= MAX_SAVED_LIKES) {
      setResultMessage(`좋아요는 최대 ${MAX_SAVED_LIKES}개까지 저장할 수 있습니다.`);
      return;
    }

    savingListInProgress.current = true;
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
    setRecommendation(undefined);
    setResultMessage(undefined);
  }, []);

  async function removeSavedRestaurant(
    type: 'likes' | 'exclusions' | 'temporaryExclusions',
    restaurantId: string,
  ) {
    try {
      if (type === 'temporaryExclusions') {
        removeTemporaryExclusion(restaurantId);
      } else if (listStorage === 'local') {
        removeLocalRestaurant(type, restaurantId);
      } else if (type === 'likes') {
        await removeLike(restaurantId);
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
    } else if (type === 'likes') {
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
    setAccountManagementOpen(false);
    setUser(undefined);
    setLikes([]);
    setExclusions([]);
    setTemporaryExclusions([]);
    setListStorage('local');
  }

  function blockInteractionDuringRecommendation(event: React.SyntheticEvent) {
    if (!recommending) return;
    event.preventDefault();
    event.stopPropagation();
  }

  const panelTitle = activeItem === 'more' && accountManagementOpen
    ? '계정관리'
    : activeItem === 'more' && themeSettingsOpen
      ? '테마 설정'
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
            </div>
            <div className={styles.resultActions}>
              <button
                type="button"
                className={savedLists.like ? styles.savedAction : ''}
                data-label="좋아요"
                aria-pressed={savedLists.like}
                aria-busy={savingList === 'like'}
                aria-label={savingList === 'like'
                  ? `좋아요 ${savedLists.like ? '삭제' : '저장'} 중`
                  : '좋아요'}
                title={!savedLists.like && savedLists.exclusion
                  ? '싫어요 선택을 먼저 해제해 주세요.'
                  : undefined}
                data-selection-blocked={blockedListActions.like}
                disabled={savingList !== undefined || blockedListActions.like}
                onClick={() => void saveRecommendation('like')}
              >
                {savingList === 'like' ? (
                  <LoaderCircle className={styles.resultActionSpinner} aria-hidden="true" />
                ) : (
                  <ThumbsUp aria-hidden="true" fill={savedLists.like ? 'currentColor' : 'none'} />
                )}
              </button>
              <button
                type="button"
                className={savedLists.exclusion ? styles.savedAction : ''}
                data-label="싫어요"
                aria-pressed={savedLists.exclusion}
                aria-busy={savingList === 'exclusion'}
                aria-label={savingList === 'exclusion'
                  ? `싫어요 ${savedLists.exclusion ? '삭제' : '저장'} 중`
                  : '싫어요'}
                title={!savedLists.exclusion && savedLists.like
                  ? '좋아요 선택을 먼저 해제해 주세요.'
                  : undefined}
                data-selection-blocked={blockedListActions.exclusion}
                disabled={savingList !== undefined || blockedListActions.exclusion}
                onClick={() => void saveRecommendation('exclusion')}
              >
                {savingList === 'exclusion' ? (
                  <LoaderCircle className={styles.resultActionSpinner} aria-hidden="true" />
                ) : (
                  <ThumbsDown aria-hidden="true" fill={savedLists.exclusion ? 'currentColor' : 'none'} />
                )}
              </button>
              <button
                type="button"
                className={temporarilyExcluded ? styles.savedAction : ''}
                data-label="지금은 싫어요"
                aria-pressed={temporarilyExcluded}
                onClick={temporarilyExcludeRecommendation}
              >
                <Clock3 aria-hidden="true" />
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

      <button
        className={styles.rouletteButton}
        type="button"
        aria-label={recommending ? '음식점 탐색 중' : '룰렛으로 음식점 추천'}
        onClick={() => void recommendRestaurant()}
        disabled={recommending || locating}
      >
        <Dices aria-hidden="true" strokeWidth={2.2} />
      </button>

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
          onClick={() => setPanelOpen(false)}
        />
      )}

      <section
        className={`${styles.sidePanel} ${panelOpen ? styles.sidePanelOpen : ''}`}
        aria-hidden={!panelOpen}
      >
        <header className={styles.sidePanelHeader}>
          {activeItem === 'more' && (accountManagementOpen || themeSettingsOpen) && (
            <button
              className={styles.sidePanelBackButton}
              type="button"
              aria-label="더보기로 돌아가기"
              onClick={() => {
                setAccountManagementOpen(false);
                setThemeSettingsOpen(false);
              }}
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
            onClick={() => setPanelOpen(false)}
          >
            <X aria-hidden="true" strokeWidth={2.2} />
          </button>
        </header>
        <div className={styles.sheetContent}>
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
              key={activeItem}
              listType={activeItem}
              items={activeItem === 'likes' ? likes : exclusions}
              loading={listsLoading}
              errorMessage={listsError}
              onRemove={removeSavedRestaurant}
            />
          )}
          {panelOpen && activeItem === 'more' && (
            accountManagementOpen && user ? (
              <AccountManagement
                onWithdrawn={handleWithdrawn}
              />
            ) : themeSettingsOpen ? (
              <ThemeSettings
                theme={theme}
                pinColor={pinColor}
                onThemeChange={onThemeChange}
                onPinColorChange={onPinColorChange}
              />
            ) : (
              <MoreTab
                onOpenAccountManagement={() => {
                  setThemeSettingsOpen(false);
                  setAccountManagementOpen(true);
                }}
                onOpenThemeSettings={() => {
                  setAccountManagementOpen(false);
                  setThemeSettingsOpen(true);
                }}
                user={user}
                checkingSession={authChecking}
                onLoggedOut={handleLoggedOut}
              />
            )
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
              aria-pressed={selected && panelOpen}
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
