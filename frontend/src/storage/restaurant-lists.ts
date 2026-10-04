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

export function clearLocalRestaurantLists(): void {
  for (const key of Object.values(STORAGE_KEYS)) {
    window.localStorage.removeItem(key);
  }
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
