import type { ExclusionsResponse, LikeListResponse, LikeListsResponse, LikesResponse, Restaurant } from '../types';
import { apiRequest } from './client';

type RestaurantSummary = Pick<Restaurant, 'id' | 'name'>;

export function getLikeLists(): Promise<LikeListsResponse> {
  return apiRequest<LikeListsResponse>('/users/me/like-lists');
}

export function createLikeList(name: string): Promise<LikeListResponse> {
  return apiRequest<LikeListResponse>('/users/me/like-lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function renameLikeList(listId: string, name: string): Promise<void> {
  return apiRequest<void>(`/users/me/like-lists/${encodeURIComponent(listId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function deleteLikeList(listId: string): Promise<void> {
  return apiRequest<void>(`/users/me/like-lists/${encodeURIComponent(listId)}`, {
    method: 'DELETE',
  });
}

export function getLikes(listId: string): Promise<LikesResponse> {
  return apiRequest<LikesResponse>(`/users/me/like-lists/${encodeURIComponent(listId)}/likes`);
}

export function addLike(listId: string, restaurant: RestaurantSummary): Promise<void> {
  return apiRequest<void>(`/users/me/like-lists/${encodeURIComponent(listId)}/likes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    }),
  });
}

export function removeLike(listId: string, restaurantId: string): Promise<void> {
  return apiRequest<void>(`/users/me/like-lists/${encodeURIComponent(listId)}/likes/${encodeURIComponent(restaurantId)}`, {
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
