import RestaurantList from '../../../../components/RestaurantList/RestaurantList';
import { SavedRestaurant } from '../../../../types';
import { type ListType } from '../SavedListTab/SavedListTab';
import styles from './TodayRecordTab.module.css';

interface TodayRecordTabProps {
  items: SavedRestaurant[];
  rouletteLogs: RouletteLogEntry[];
  onRemove(type: ListType, restaurantId: string): Promise<void>;
}

export interface RouletteLogEntry {
  logId: number;
  restaurantId: string;
  restaurantName: string;
  placeUrl: string;
  createdAt: string;
}

export default function TodayRecordTab({
  items,
  rouletteLogs,
  onRemove,
}: TodayRecordTabProps) {
  return (
    <div className={styles.tabContent}>
      <RestaurantList
        title="룰렛 기록"
        description="룰렛 결과를 20개까지 기록합니다"
        items={rouletteLogs.map((log) => ({
          id: log.logId,
          name: log.restaurantName,
          href: log.placeUrl,
          createdAt: log.createdAt,
        }))}
        formatTimestamp={formatRouletteLogTime}
      />
      <RestaurantList
        title="지금은 싫어요"
        description="선택한 가게가 2시간 동안 나오지 않습니다"
        items={items.map((item) => ({
          id: item.restaurantId,
          name: item.restaurantName,
          href: `https://place.map.kakao.com/${encodeURIComponent(item.restaurantId)}`,
          createdAt: item.createdAt,
        }))}
        formatTimestamp={formatSavedDate}
        onRemove={(restaurantId) => onRemove('temporaryExclusions', String(restaurantId))}
      />
    </div>
  );
}

function formatRouletteLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date);
}
