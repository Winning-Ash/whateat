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
export interface CandidateSet {
  restaurants: Restaurant[];
  partial: boolean;
}
