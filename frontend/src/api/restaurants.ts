import {
  CandidatesResponse,
  CategoriesResponse,
  RandomRestaurantResponse,
  RestaurantSearchParams,
} from '../types';
import { apiRequest } from './client';

export function getRestaurantCategories(): Promise<CategoriesResponse> {
  return apiRequest<CategoriesResponse>('/restaurants/categories');
}

export function getRestaurantCandidates(
  params: RestaurantSearchParams,
): Promise<CandidatesResponse> {
  return apiRequest<CandidatesResponse>(
    `/restaurants/candidates?${createSearchParams(params)}`,
  );
}

export function getRandomRestaurant(
  params: RestaurantSearchParams,
): Promise<RandomRestaurantResponse> {
  return apiRequest<RandomRestaurantResponse>(
    `/restaurants/random?${createSearchParams(params)}`,
  );
}

function createSearchParams(params: RestaurantSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    radius: String(params.radius),
  });

  if (params.category) searchParams.set('category', params.category);
  if (params.cacheOnly !== undefined) {
    searchParams.set('cacheOnly', String(params.cacheOnly));
  }
  if (params.excludeIds?.length) {
    searchParams.set('excludeIds', params.excludeIds.join(','));
  }

  return searchParams;
}
