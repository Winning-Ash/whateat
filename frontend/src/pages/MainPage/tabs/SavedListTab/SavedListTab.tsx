import RestaurantList from '../../../../components/RestaurantList/RestaurantList';
import { type LikeListsState } from '../../../../hooks/like-lists';
import { SavedRestaurant } from '../../../../types';
import LikeListManager from './LikeListManager';
import LikedRestaurantRandomizer from './LikedRestaurantRandomizer';

export type ListType = 'exclusions' | 'temporaryExclusions';

interface SavedListTabProps {
  listType: 'likes' | 'exclusions';
  items: SavedRestaurant[];
  loading: boolean;
  errorMessage?: string;
  likeLists?: LikeListsState;
  onRemove(type: ListType, restaurantId: string): Promise<void>;
}

export default function SavedListTab({
  listType,
  items,
  loading,
  errorMessage,
  likeLists,
  onRemove,
}: SavedListTabProps) {
  if (listType === 'likes') {
    if (!likeLists) return null;
    return (
      <>
        <LikedRestaurantRandomizer likeLists={likeLists} />
        <LikeListManager likeLists={likeLists} />
      </>
    );
  }

  return (
    <RestaurantList
      title="싫어요"
      description="선택한 가게가 다시 나오지 않습니다"
      items={items.map((item) => ({
        id: item.restaurantId,
        name: item.restaurantName,
        href: `https://place.map.kakao.com/${encodeURIComponent(item.restaurantId)}`,
        createdAt: item.createdAt,
      }))}
      loading={loading}
      errorMessage={errorMessage}
      disabled={Boolean(errorMessage)}
      formatTimestamp={formatSavedDate}
      onRemove={(restaurantId) => onRemove(listType, String(restaurantId))}
    />
  );
}

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date);
}
