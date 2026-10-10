import { Restaurant, SavedRestaurant } from '../types';

export type RestaurantListType = 'likes' | 'exclusions';

interface LocalSavedRestaurant extends SavedRestaurant {
  category: string;
  address: string;
  roadAddress: string;
  placeUrl: string;
}

const STORAGE_KEYS: Record<RestaurantListType, string> = {
  likes: 'whateat_guest_likes',
  exclusions: 'whateat_guest_exclusions',
};

const MAX_LOCAL_ITEMS = 100;
const MAX_TEMPORARY_EXCLUSIONS = 50;
const TEMPORARY_EXCLUSIONS_KEY = 'whateat_temporary_exclusions';
const TEMPORARY_EXCLUSION_TTL_MS = 2 * 60 * 60 * 1000;

export interface TemporarySavedRestaurant extends SavedRestaurant {
  expiresAt: number;
}

export function getLocalRestaurantList(type: RestaurantListType): LocalSavedRestaurant[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEYS[type]);
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLocalSavedRestaurant).slice(0, MAX_LOCAL_ITEMS);
  } catch {
    return [];
  }
}

export function addLocalRestaurant(type: RestaurantListType, restaurant: Restaurant): void {
  const current = getLocalRestaurantList(type)
    .filter((item) => item.restaurantId !== restaurant.id);
  const next: LocalSavedRestaurant[] = [{
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    category: restaurant.category,
    address: restaurant.address,
    roadAddress: restaurant.roadAddress,
    placeUrl: restaurant.placeUrl,
    createdAt: new Date().toISOString(),
  }, ...current].slice(0, MAX_LOCAL_ITEMS);
  window.localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(next));
}

export function removeLocalRestaurant(type: RestaurantListType, restaurantId: string): void {
  const next = getLocalRestaurantList(type)
    .filter((item) => item.restaurantId !== restaurantId);
  window.localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(next));
}

export function getTemporaryExclusionList(): TemporarySavedRestaurant[] {
  try {
    const value = window.localStorage.getItem(TEMPORARY_EXCLUSIONS_KEY);
    if (!value) return [];

    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(TEMPORARY_EXCLUSIONS_KEY);
      return [];
    }

    const now = Date.now();
    const activeItems = parsed
      .map(normalizeTemporaryExclusion)
      .filter((item): item is TemporarySavedRestaurant => item !== undefined)
      .filter((item) => item.expiresAt > now)
      .filter((item, index, items) => (
        items.findIndex((candidate) => candidate.restaurantId === item.restaurantId) === index
      ))
      .slice(0, MAX_TEMPORARY_EXCLUSIONS);

    if (activeItems.length === 0) {
      window.localStorage.removeItem(TEMPORARY_EXCLUSIONS_KEY);
    } else {
      window.localStorage.setItem(TEMPORARY_EXCLUSIONS_KEY, JSON.stringify(activeItems));
    }

    return activeItems;
  } catch {
    return [];
  }
}

export function getTemporaryExclusionIds(): string[] {
  return getTemporaryExclusionList().map((item) => item.restaurantId);
}

export function addTemporaryExclusion(restaurant: Restaurant): void {
  const now = Date.now();
  const current = getTemporaryExclusionList()
    .filter((item) => item.restaurantId !== restaurant.id);
  const next: TemporarySavedRestaurant[] = [{
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + TEMPORARY_EXCLUSION_TTL_MS,
  }, ...current].slice(0, MAX_TEMPORARY_EXCLUSIONS);

  window.localStorage.setItem(TEMPORARY_EXCLUSIONS_KEY, JSON.stringify(next));
}

export function removeTemporaryExclusion(restaurantId: string): void {
  const next = getTemporaryExclusionList()
    .filter((item) => item.restaurantId !== restaurantId);

  if (next.length === 0) {
    window.localStorage.removeItem(TEMPORARY_EXCLUSIONS_KEY);
  } else {
    window.localStorage.setItem(TEMPORARY_EXCLUSIONS_KEY, JSON.stringify(next));
  }
}

export function clearLocalRestaurantLists(): void {
  for (const key of Object.values(STORAGE_KEYS)) {
    window.localStorage.removeItem(key);
  }
  window.localStorage.removeItem(TEMPORARY_EXCLUSIONS_KEY);
}

function isLocalSavedRestaurant(value: unknown): value is LocalSavedRestaurant {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LocalSavedRestaurant>;
  return typeof item.restaurantId === 'string'
    && /^\d{1,20}$/.test(item.restaurantId)
    && typeof item.restaurantName === 'string'
    && typeof item.createdAt === 'string'
    && typeof item.category === 'string'
    && typeof item.address === 'string'
    && typeof item.roadAddress === 'string'
    && typeof item.placeUrl === 'string';
}

function normalizeTemporaryExclusion(value: unknown): TemporarySavedRestaurant | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Partial<TemporarySavedRestaurant>;
  if (typeof item.restaurantId !== 'string'
    || !/^\d{1,20}$/.test(item.restaurantId)
    || typeof item.expiresAt !== 'number'
    || !Number.isFinite(item.expiresAt)) {
    return undefined;
  }

  return {
    restaurantId: item.restaurantId,
    restaurantName: typeof item.restaurantName === 'string'
      ? item.restaurantName
      : '이름을 알 수 없는 가게',
    createdAt: typeof item.createdAt === 'string'
      ? item.createdAt
      : new Date(item.expiresAt - TEMPORARY_EXCLUSION_TTL_MS).toISOString(),
    expiresAt: item.expiresAt,
  };
}
