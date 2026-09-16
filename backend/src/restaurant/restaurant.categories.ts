export const FOOD_CATEGORIES = ['한식', '중식', '일식', '양식', '분식', '치킨', '피자', '아시아음식', '패스트푸드', '기타'] as const;
export type FoodCategory = typeof FOOD_CATEGORIES[number];

export function foodCategory(path: string): FoodCategory {
  const segments = path.split('>').map(segment => segment.trim());
  // Prefer the most specific category (e.g. 음식점 > 양식 > 피자).
  for (const segment of segments.reverse()) {
    if ((FOOD_CATEGORIES as readonly string[]).includes(segment)) return segment as FoodCategory;
  }
  return '기타';
}
