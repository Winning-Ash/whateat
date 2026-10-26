import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Dialog from '../../../../components/Dialog/Dialog';
import RestaurantList from '../../../../components/RestaurantList/RestaurantList';
import { type LikeListsState } from '../../../../hooks/like-lists';
import { MAX_LIKE_LISTS, MAX_LIKE_LIST_NAME_LENGTH, type LikeList } from '../../../../types';
import styles from './LikeListManager.module.css';

interface LikeListManagerProps {
  likeLists: LikeListsState;
}

type ListEditor = { mode: 'create' } | { mode: 'rename' | 'delete'; list: LikeList };

export default function LikeListManager({ likeLists }: LikeListManagerProps) {
  const { lists, loading, saving, error } = likeLists;
  const [editing, setEditing] = useState<ListEditor>();
  const [name, setName] = useState('');
  const [actionError, setActionError] = useState<string>();
  const disabled = loading || saving || Boolean(error);
  const nameLength = Array.from(name.trim()).length;

  function startEditing(editor: ListEditor) {
    setEditing(editor);
    setName(editor.mode === 'rename' ? editor.list.name : '');
    setActionError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !editing) return;
    setActionError(undefined);
    try {
      if (editing.mode === 'create') await likeLists.createList(name);
      else if (editing.mode === 'rename') await likeLists.renameList(editing.list.id, name);
      else await likeLists.deleteList(editing.list.id);
      setEditing(undefined);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '목록을 변경하지 못했습니다.');
    }
  }

  return (
    <div className={styles.manager}>
      {loading && <p className={styles.status} role="status">좋아요 목록을 불러오고 있습니다.</p>}
      {lists.map((list) => (
        <RestaurantList
          key={list.id}
          title={list.name}
          items={list.likes.map((item) => ({
            id: item.restaurantId,
            name: item.restaurantName,
            href: `https://place.map.kakao.com/${encodeURIComponent(item.restaurantId)}`,
            createdAt: item.createdAt,
          }))}
          disabled={disabled}
          formatTimestamp={formatSavedDate}
          onRemove={(restaurantId) => likeLists.removeRestaurant(list.id, String(restaurantId))}
          headerActions={(
            <div className={styles.listActions}>
              <button
                type="button"
                aria-label={`${list.name} 이름 변경`}
                title="이름 변경"
                disabled={disabled}
                onClick={() => startEditing({ mode: 'rename', list })}
              >
                <Pencil aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`${list.name} 목록 삭제`}
                title={list.id === 'default' ? '기본 목록은 삭제할 수 없습니다.' : '목록 삭제'}
                disabled={disabled || list.id === 'default'}
                onClick={() => startEditing({ mode: 'delete', list })}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          )}
        />
      ))}
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" disabled={loading} onClick={likeLists.reload}>다시 시도</button>
        </div>
      )}
      {lists.length < MAX_LIKE_LISTS && (
        <button
          className={styles.addButton}
          type="button"
          disabled={disabled}
          onClick={() => startEditing({ mode: 'create' })}
        >
          <Plus aria-hidden="true" />목록 추가
        </button>
      )}
      {editing && (
        <Dialog
          title={editing.mode === 'create' ? '목록 추가' : editing.mode === 'rename' ? '이름 변경' : '목록 삭제'}
          busy={saving}
          onClose={() => setEditing(undefined)}
        >
          <form className={styles.editor} onSubmit={(event) => void submit(event)}>
            {editing.mode === 'delete' ? (
              <p>‘{editing.list.name}’ 목록을 삭제하시겠습니까?.</p>
            ) : (
              <>
                <label htmlFor="like-list-name">목록 이름</label>
                <input
                  id="like-list-name"
                  value={name}
                  required
                  disabled={disabled}
                  aria-describedby="like-list-name-hint"
                  onChange={(event) => setName(event.target.value)}
                />
                <span id="like-list-name-hint">{nameLength}/{MAX_LIKE_LIST_NAME_LENGTH}자</span>
              </>
            )}
            {(actionError || error) && <p className={styles.error} role="alert">{actionError || error}</p>}
            {error && <button type="button" disabled={loading} onClick={likeLists.reload}>다시 시도</button>}
            <div className={styles.editorActions}>
              <button type="button" disabled={saving} onClick={() => setEditing(undefined)}>취소</button>
              <button
                type="submit"
                disabled={disabled || (editing.mode !== 'delete' && (nameLength < 1 || nameLength > MAX_LIKE_LIST_NAME_LENGTH))}
              >
                {saving ? '처리 중' : editing.mode === 'delete' ? '삭제' : '저장'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date);
}
