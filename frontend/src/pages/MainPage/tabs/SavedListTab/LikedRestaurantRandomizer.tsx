import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, Dices } from 'lucide-react';
import type { LikeListsState } from '../../../../hooks/like-lists';
import styles from './LikedRestaurantRandomizer.module.css';

interface LikedRestaurantRandomizerProps {
  likeLists: LikeListsState;
}

const ROLLING_DURATION_MS = 700;

export default function LikedRestaurantRandomizer({
  likeLists,
}: LikedRestaurantRandomizerProps) {
  const { lists, selectedList, loading, saving, error } = likeLists;
  const items = selectedList?.likes ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const [rolling, setRolling] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  const selectedRestaurant = items.find((item) => item.restaurantId === selectedId);

  useEffect(() => {
    setSelectedId(undefined);
    setRolling(false);
    return () => window.clearTimeout(timeoutRef.current);
  }, [selectedList?.id]);

  function selectRandomRestaurant() {
    if (loading || saving || error || rolling || items.length === 0) return;

    const candidates = selectedRestaurant && items.length > 1
      ? items.filter((item) => item.restaurantId !== selectedRestaurant.restaurantId)
      : items;
    const nextRestaurant = candidates[Math.floor(Math.random() * candidates.length)];

    setRolling(true);
    timeoutRef.current = window.setTimeout(() => {
      setSelectedId(nextRestaurant.restaurantId);
      setRolling(false);
    }, ROLLING_DURATION_MS);
  }

  return (
    <section className={styles.randomizer} aria-labelledby="liked-random-title">
      <div className={styles.heading}>
        <div>
          <h3 id="liked-random-title">좋아요 랜덤</h3>
          <p>선택한 목록에 저장한 가게 중 한 곳을 뽑습니다.</p>
        </div>
        <button
          type="button"
          aria-label={rolling ? '좋아요 가게를 뽑는 중' : '선택한 목록에서 가게 뽑기'}
          disabled={loading || saving || Boolean(error) || rolling || items.length === 0}
          onClick={selectRandomRestaurant}
        >
          <Dices className={rolling ? styles.rollingIcon : undefined} aria-hidden="true" />
        </button>
      </div>

      <label className={styles.category}>
        <select
          aria-label="룰렛 카테고리 선택"
          value={selectedList?.id ?? ''}
          disabled={loading || saving || Boolean(error) || rolling || !selectedList}
          onChange={(event) => likeLists.selectList(event.target.value)}
        >
          <button type="button">
            <span className={styles.categoryName}>
              {selectedList?.name ?? (loading ? '불러오는 중' : '목록 없음')}
            </span>
          </button>
          {!selectedList && <option value="">{loading ? '불러오는 중' : '목록 없음'}</option>}
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              <span className={styles.categoryName}>{list.name}</span>
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" />
      </label>

      {selectedRestaurant && !rolling && (
        <a
          className={styles.result}
          href={`https://place.map.kakao.com/${encodeURIComponent(selectedRestaurant.restaurantId)}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`${selectedRestaurant.restaurantName} 카카오맵에서 보기`}
        >
          <span>이번에는 여기!</span>
          <strong>{selectedRestaurant.restaurantName}</strong>
          <ArrowUpRight aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
