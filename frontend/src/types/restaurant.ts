export const FOOD_CATEGORIES = [
  '한식',
  '중식',
  '일식',
  '양식',
  '분식',
  '치킨',
  '피자',
  '아시아음식',
  '패스트푸드',
  '기타',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  category: string;
  placeUrl: string;
}

export interface RestaurantSearchParams {
  lat: number;
  lng: number;
  radius: number;
  category?: FoodCategory;
  cacheOnly?: boolean;
}

export interface CategoriesResponse {
  categories: FoodCategory[];
}

export interface CandidatesResponse {
  restaurants: Restaurant[];
  candidateCount: number;
  cached: boolean;
  partial: boolean;
}

export interface RandomRestaurantResponse {
  restaurant: Restaurant;
  candidateCount: number;
  cached: boolean;
  partial: boolean;
}
