import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { SavedRestaurant } from '../../../../types';
import styles from './BookmarkTab.module.css';

type ListType = 'likes' | 'exclusions';

interface BookmarkTabProps {
  likes: SavedRestaurant[];
  exclusions: SavedRestaurant[];
  loading: boolean;
  errorMessage?: string;
  onRemove(type: ListType, restaurantId: string): Promise<void>;
}

export default function BookmarkTab({
  likes,
  exclusions,
  loading,
  errorMessage,
  onRemove,
}: BookmarkTabProps) {
  const [removeError, setRemoveError] = useState<string>();
  const [removingKey, setRemovingKey] = useState<string>();

  async function removeFromList(type: ListType, restaurantId: string) {
    const key = `${type}:${restaurantId}`;
    setRemovingKey(key);
    setRemoveError(undefined);

    try {
      await onRemove(type, restaurantId);
    } catch {
      setRemoveError('목록에서 삭제하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setRemovingKey(undefined);
    }
  }

  if (loading) {
    return <p className={styles.statusMessage} role="status">저장한 가게를 불러오고 있습니다.</p>;
  }

  return (
    <div className={styles.bookmarkTab}>
      <RestaurantList
        title="좋아요"
        emptyMessage="좋아요한 가게가 없습니다."
        items={likes}
        type="likes"
        removingKey={removingKey}
        onRemove={removeFromList}
      />
      <RestaurantList
        title="싫어요"
        emptyMessage="싫어요한 가게가 없습니다."
        items={exclusions}
        type="exclusions"
        removingKey={removingKey}
        onRemove={removeFromList}
      />
      {(errorMessage || removeError) && (
        <p className={styles.errorMessage} role="alert">{errorMessage || removeError}</p>
      )}
    </div>
  );
}

interface RestaurantListProps {
  title: string;
  emptyMessage: string;
  items: SavedRestaurant[];
  type: ListType;
  removingKey?: string;
  onRemove(type: ListType, restaurantId: string): Promise<void>;
}

function RestaurantList({
  title,
  emptyMessage,
  items,
  type,
  removingKey,
  onRemove,
}: RestaurantListProps) {
  return (
    <section className={styles.listSection}>
      <div className={styles.listHeading}>
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className={styles.emptyMessage}>{emptyMessage}</p>
      ) : (
        <ul className={styles.restaurantList}>
          {items.map((item) => {
            const key = `${type}:${item.restaurantId}`;
            return (
              <li key={item.restaurantId}>
                <a
                  className={styles.restaurantLink}
                  href={`https://place.map.kakao.com/${encodeURIComponent(item.restaurantId)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${item.restaurantName} 카카오맵에서 보기`}
                >
                  <strong>{item.restaurantName}</strong>
                  <time dateTime={item.createdAt}>{formatSavedDate(item.createdAt)}</time>
                </a>
                <button
                  type="button"
                  aria-label={`${item.restaurantName} 목록에서 삭제`}
                  title="목록에서 삭제"
                  disabled={removingKey === key}
                  onClick={() => void onRemove(type, item.restaurantId)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date);
}
