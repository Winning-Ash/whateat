import { useId, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import styles from './RestaurantList.module.css';

export interface RestaurantListItem {
  id: string | number;
  name: string;
  href: string;
  createdAt: string;
}

interface RestaurantListProps {
  title: string;
  description?: string;
  items: RestaurantListItem[];
  loading?: boolean;
  errorMessage?: string;
  formatTimestamp(value: string): string;
  onRemove?(id: string | number): Promise<void>;
}

const EMPTY_LIST_MESSAGE = '저장된 리스트가 없습니다.';

export default function RestaurantList({
  title,
  description,
  items,
  loading = false,
  errorMessage,
  formatTimestamp,
  onRemove,
}: RestaurantListProps) {
  const [expanded, setExpanded] = useState(true);
  const [removingId, setRemovingId] = useState<string | number>();
  const [removeError, setRemoveError] = useState<string>();
  const contentId = useId();

  async function removeItem(item: RestaurantListItem) {
    if (!onRemove) return;

    setRemovingId(item.id);
    setRemoveError(undefined);

    try {
      await onRemove(item.id);
    } catch {
      setRemoveError('목록에서 삭제하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setRemovingId(undefined);
    }
  }

  if (loading) {
    return <p className={styles.statusMessage} role="status">저장한 가게를 불러오고 있습니다.</p>;
  }

  return (
    <div className={styles.listContainer}>
      <section className={styles.listSection}>
        <h3 className={styles.listHeader}>
          <button
            className={styles.listToggle}
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded((current) => !current)}
          >
            <span className={styles.listTitle}>{title}</span>
            <span className={styles.listCount}>{items.length}</span>
            <ChevronDown
              className={`${styles.listChevron} ${expanded ? styles.listChevronExpanded : ''}`}
              aria-hidden="true"
            />
          </button>
        </h3>
        {description && <p className={styles.listDescription}>{description}</p>}
        {expanded && (
          <div id={contentId} className={styles.listContent}>
            {items.length === 0 ? (
              <p className={styles.emptyMessage}>{EMPTY_LIST_MESSAGE}</p>
            ) : (
              <ul className={styles.restaurantList}>
                {items.map((item) => (
                  <li key={item.id}>
                    <a
                      className={styles.restaurantLink}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${item.name} 카카오맵에서 보기`}
                    >
                      <strong>{item.name}</strong>
                      <time dateTime={item.createdAt}>{formatTimestamp(item.createdAt)}</time>
                    </a>
                    {onRemove && (
                      <button
                        type="button"
                        aria-label={`${item.name} 목록에서 삭제`}
                        title="목록에서 삭제"
                        disabled={removingId === item.id}
                        onClick={() => void removeItem(item)}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      {(errorMessage || removeError) && (
        <p className={styles.errorMessage} role="alert">{errorMessage || removeError}</p>
      )}
    </div>
  );
}
