import { useState, type FormEvent } from 'react';
import { Folder, Plus } from 'lucide-react';
import Dialog from '../../components/Dialog/Dialog';
import type { LikeListsState } from '../../hooks/like-lists';
import type { Restaurant } from '../../types';
import { MAX_LIKE_LISTS, MAX_LIKE_LIST_NAME_LENGTH } from '../../types';
import styles from './LikeSaveDialog.module.css';

interface LikeSaveDialogProps {
  restaurant: Restaurant;
  likeLists: LikeListsState;
  saving: boolean;
  onSave(listIds: string[]): Promise<void>;
  onClose(): void;
}

export default function LikeSaveDialog({ restaurant, likeLists, saving, onSave, onClose }: LikeSaveDialogProps) {
  const { lists, loading, saving: listsSaving, error } = likeLists;
  const [selectedIds, setSelectedIds] = useState(() => lists
    .filter((list) => list.likes.some((item) => item.restaurantId === restaurant.id))
    .map((list) => list.id));
  const [saveError, setSaveError] = useState<string>();
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const addingList = newListOpen && lists.length < MAX_LIKE_LISTS;
  const nameLength = Array.from(newListName.trim()).length;
  const busy = saving || listsSaving || creating;
  const disabled = busy || loading || Boolean(error);
  const changed = lists.some((list) => (
    list.likes.some((item) => item.restaurantId === restaurant.id) !== selectedIds.includes(list.id)
  ));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    if (addingList) {
      if (nameLength < 1 || nameLength > MAX_LIKE_LIST_NAME_LENGTH) return;
      setCreating(true);
      setSaveError(undefined);
      try {
        const listId = await likeLists.createList(newListName);
        setSelectedIds((current) => [...current, listId]);
        setNewListOpen(false);
        setNewListName('');
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : '목록을 추가하지 못했습니다.');
      } finally {
        setCreating(false);
      }
      return;
    }
    if (!changed) return;
    setSaveError(undefined);
    try {
      await onSave(lists.filter((list) => selectedIds.includes(list.id)).map((list) => list.id));
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '좋아요를 저장하지 못했습니다.');
    }
  }

  return (
    <Dialog title="좋아요 저장" busy={busy} onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <p className={styles.restaurantName}>{restaurant.name}</p>
        <div className={styles.lists}>
          {lists.map((list) => {
            const selected = selectedIds.includes(list.id);
            return (
              <label key={list.id} className={`${styles.list} ${selected ? styles.selected : ''}`}>
                <Folder aria-hidden="true" />
                <span>{list.name}</span>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelectedIds((current) => checked
                      ? [...current, list.id]
                      : current.filter((id) => id !== list.id));
                    setSaveError(undefined);
                  }}
                />
              </label>
            );
          })}
        </div>
        {lists.length < MAX_LIKE_LISTS && (
          addingList ? (
            <div className={styles.listEditor}>
              <label htmlFor="new-like-list-name">새 목록 이름</label>
              <input
                id="new-like-list-name"
                type="text"
                value={newListName}
                required
                autoFocus
                disabled={disabled}
                aria-describedby="new-like-list-name-hint"
                onChange={(event) => {
                  setNewListName(event.target.value);
                  setSaveError(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.repeat)) event.preventDefault();
                }}
              />
              <span id="new-like-list-name-hint">{nameLength}/{MAX_LIKE_LIST_NAME_LENGTH}자</span>
              <div className={styles.editorActions}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setNewListOpen(false);
                    setSaveError(undefined);
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={disabled || nameLength < 1 || nameLength > MAX_LIKE_LIST_NAME_LENGTH}
                >
                  {creating ? '추가 중' : '추가'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className={styles.addList}
              type="button"
              disabled={disabled}
              onClick={() => {
                setNewListOpen(true);
                setNewListName('');
                setSaveError(undefined);
              }}
            >
              <Plus aria-hidden="true" />목록 추가
            </button>
          )
        )}
        {loading && <p className={styles.hint} role="status">목록을 불러오고 있습니다.</p>}
        {(saveError || error) && <p className={styles.error} role="alert">{saveError || error}</p>}
        {error && <button className={styles.retry} type="button" disabled={loading} onClick={likeLists.reload}>다시 시도</button>}
        <div className={styles.actions}>
          <button type="button" disabled={busy} onClick={onClose}>취소</button>
          <button type="submit" disabled={disabled || addingList || !changed}>{saving ? '저장 중' : '저장'}</button>
        </div>
      </form>
    </Dialog>
  );
}
