import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Dices } from 'lucide-react';
import { SavedRestaurant } from '../../../../types';
import styles from './LikedRestaurantRandomizer.module.css';

interface LikedRestaurantRandomizerProps {
  items: SavedRestaurant[];
  loading: boolean;
}

const ROLLING_DURATION_MS = 700;

export default function LikedRestaurantRandomizer({
  items,
  loading,
}: LikedRestaurantRandomizerProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const [rolling, setRolling] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  const selectedRestaurant = items.find((item) => item.restaurantId === selectedId);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  function selectRandomRestaurant() {
    if (rolling || items.length === 0) return;

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
          <p>좋아요로 저장한 가게 중 한 곳을 골라드려요.</p>
        </div>
        <button
          type="button"
          disabled={loading || rolling || items.length === 0}
          onClick={selectRandomRestaurant}
        >
          <Dices className={rolling ? styles.rollingIcon : undefined} aria-hidden="true" />
        </button>
      </div>

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
