import { ExclusionsResponse, LikesResponse, Restaurant } from '../types';
import { apiRequest } from './client';

type RestaurantSummary = Pick<Restaurant, 'id' | 'name'>;

export function getLikes(): Promise<LikesResponse> {
  return apiRequest<LikesResponse>('/users/me/likes');
}

export function addLike(restaurant: RestaurantSummary): Promise<void> {
  return apiRequest<void>('/users/me/likes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    }),
  });
}

export function removeLike(restaurantId: string): Promise<void> {
  return apiRequest<void>(`/users/me/likes/${encodeURIComponent(restaurantId)}`, {
    method: 'DELETE',
  });
}

export function getExclusions(): Promise<ExclusionsResponse> {
  return apiRequest<ExclusionsResponse>('/users/me/exclusions');
}

export function addExclusion(restaurant: RestaurantSummary): Promise<void> {
  return apiRequest<void>('/users/me/exclusions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    }),
  });
}

export function removeExclusion(restaurantId: string): Promise<void> {
  return apiRequest<void>(`/users/me/exclusions/${encodeURIComponent(restaurantId)}`, {
    method: 'DELETE',
  });
}
