import RestaurantList from '../../../../components/RestaurantList/RestaurantList';
import { SavedRestaurant } from '../../../../types';
import LikedRestaurantRandomizer from './LikedRestaurantRandomizer';

export type ListType = 'likes' | 'exclusions' | 'temporaryExclusions';

interface SavedListTabProps {
  listType: 'likes' | 'exclusions';
  items: SavedRestaurant[];
  loading: boolean;
  errorMessage?: string;
  onRemove(type: ListType, restaurantId: string): Promise<void>;
}

export default function SavedListTab({
  listType,
  items,
  loading,
  errorMessage,
  onRemove,
}: SavedListTabProps) {
  const title = listType === 'likes' ? '좋아요' : '싫어요';
  const description = listType === 'likes'
    ? '마음에 드는 가게를 기록합니다'
    : '선택한 가게가 다시 나오지 않습니다';

  return (
    <>
      {listType === 'likes' && (
        <LikedRestaurantRandomizer items={items} loading={loading} />
      )}
      <RestaurantList
        title={title}
        description={description}
        items={items.map((item) => ({
          id: item.restaurantId,
          name: item.restaurantName,
          href: `https://place.map.kakao.com/${encodeURIComponent(item.restaurantId)}`,
          createdAt: item.createdAt,
        }))}
        loading={loading}
        errorMessage={errorMessage}
        formatTimestamp={formatSavedDate}
        onRemove={(restaurantId) => onRemove(listType, String(restaurantId))}
      />
    </>
  );
}

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date);
}
