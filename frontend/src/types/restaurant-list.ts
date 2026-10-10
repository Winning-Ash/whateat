export interface SavedRestaurant {
  restaurantId: string;
  restaurantName: string;
  createdAt: string;
}

export interface LikesResponse {
  likes: SavedRestaurant[];
}

export interface ExclusionsResponse {
  exclusions: SavedRestaurant[];
}
