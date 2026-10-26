export interface SavedRestaurant {
  restaurantId: string;
  restaurantName: string;
  createdAt: string;
}

export interface LikesResponse {
  likes: SavedRestaurant[];
}

export interface LikeList {
  id: string;
  name: string;
}

export interface LikeListsResponse {
  lists: LikeList[];
}

export interface LikeListResponse {
  list: LikeList;
}

export interface LikeListWithRestaurants extends LikeList {
  likes: SavedRestaurant[];
}

export const MAX_LIKE_LISTS = 3;
export const MAX_LIKE_LIST_NAME_LENGTH = 30;

export interface ExclusionsResponse {
  exclusions: SavedRestaurant[];
}
