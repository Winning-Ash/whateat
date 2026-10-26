import { useEffect, useRef, useState } from 'react';
import {
  addLike,
  ApiError,
  createLikeList,
  deleteLikeList,
  getLikeLists,
  getLikes,
  removeLike,
  renameLikeList,
} from '../api';
import { getLocalLikeLists, saveLocalLikeLists } from '../storage/restaurant-lists';
import type { LikeListWithRestaurants, Restaurant } from '../types';
import { MAX_LIKE_LISTS, MAX_LIKE_LIST_NAME_LENGTH } from '../types';

type ListStorage = 'server' | 'local';

export function useLikeLists(storage: ListStorage | undefined, onSessionExpired: () => void) {
  const [data, setData] = useState<{
    storage?: ListStorage;
    lists: LikeListWithRestaurants[];
  }>({ lists: [] });
  const [selectedId, setSelectedId] = useState('default');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const mutationInProgress = useRef(false);
  const storageRef = useRef(storage);
  storageRef.current = storage;

  useEffect(() => {
    if (!storage) return;
    let active = true;

    async function loadLists() {
      setLoading(true);
      setError(undefined);
      try {
        let lists: LikeListWithRestaurants[];
        if (storage === 'local') {
          lists = getLocalLikeLists();
        } else {
          const response = await getLikeLists();
          lists = await Promise.all(response.lists.map(async (list) => ({
            ...list,
            likes: (await getLikes(list.id)).likes,
          })));
        }
        if (!active) return;
        setData({ storage, lists });
        setSelectedId((current) => lists.some((list) => list.id === current)
          ? current
          : lists[0]?.id ?? 'default');
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) onSessionExpired();
        else setError('좋아요 목록을 불러오지 못했습니다. 다시 시도해 주세요.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadLists();
    return () => { active = false; };
  }, [storage, reloadKey, onSessionExpired]);

  const lists = data.storage === storage ? data.lists : [];
  const selectedList = lists.find((list) => list.id === selectedId) ?? lists[0];
  const unavailable = loading || !storage || data.storage !== storage || Boolean(error);
  const allLikedIds = new Set(lists.flatMap((list) => list.likes.map((item) => item.restaurantId)));

  function reload() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  async function mutate(
    change: (current: LikeListWithRestaurants[], mode: ListStorage) => Promise<LikeListWithRestaurants[]>,
  ) {
    if (unavailable || mutationInProgress.current) {
      throw new Error('목록을 확인한 뒤 다시 시도해 주세요.');
    }
    const mode = storage!;
    mutationInProgress.current = true;
    setSaving(true);
    try {
      const next = await change(lists, mode);
      if (storageRef.current !== mode) throw new Error('로그인 상태가 변경되었습니다. 다시 시도해 주세요.');
      if (mode === 'local') saveLocalLikeLists(next);
      setData({ storage: mode, lists: next });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          onSessionExpired();
          throw new Error('로그인이 만료되었습니다. 비로그인 목록에서 다시 시도해 주세요.');
        }
        if (error.status === 409) {
          reload();
          throw new Error('목록은 최대 3개이며 같은 이름을 사용할 수 없습니다.');
        }
        if (error.status === 404) {
          reload();
          throw new Error('목록이 변경되었습니다. 다시 선택해 주세요.');
        }
        reload();
        throw new Error('좋아요 목록을 변경하지 못했습니다. 다시 시도해 주세요.');
      }
      if (storageRef.current !== mode) {
        throw new Error('로그인 상태가 변경되었습니다. 다시 시도해 주세요.');
      }
      if (mode === 'server') reload();
      throw new Error(mode === 'local'
        ? '브라우저에 좋아요 목록을 저장하지 못했습니다.'
        : '좋아요 목록을 변경하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      mutationInProgress.current = false;
      setSaving(false);
    }
  }

  function validateName(name: string, exceptId?: string) {
    const trimmed = name.trim();
    const length = Array.from(trimmed).length;
    if (length < 1 || length > MAX_LIKE_LIST_NAME_LENGTH) {
      throw new Error('목록 이름은 1~30자로 입력해 주세요.');
    }
    if (lists.some((list) => list.id !== exceptId && list.name === trimmed)) {
      throw new Error('이미 사용 중인 목록 이름입니다.');
    }
    return trimmed;
  }

  async function createList(name: string) {
    const trimmed = validateName(name);
    if (lists.length >= MAX_LIKE_LISTS) throw new Error('목록은 최대 3개까지 만들 수 있습니다.');
    let createdId: string | undefined;
    await mutate(async (current, mode) => {
      const list = mode === 'server'
        ? (await createLikeList(trimmed)).list
        : { id: window.crypto.randomUUID(), name: trimmed };
      createdId = list.id;
      return [...current, { ...list, likes: [] }];
    });
    setSelectedId(createdId!);
    return createdId!;
  }

  function requireList(listId: string) {
    const list = lists.find((item) => item.id === listId);
    if (!list) throw new Error('목록이 변경되었습니다. 다시 선택해 주세요.');
    return list;
  }

  async function renameList(listId: string, name: string) {
    requireList(listId);
    const trimmed = validateName(name, listId);
    await mutate(async (current, mode) => {
      if (mode === 'server') await renameLikeList(listId, trimmed);
      return current.map((list) => list.id === listId ? { ...list, name: trimmed } : list);
    });
  }

  async function deleteList(listId: string) {
    requireList(listId);
    if (listId === 'default') throw new Error('기본 목록은 삭제할 수 없습니다.');
    await mutate(async (current, mode) => {
      if (mode === 'server') await deleteLikeList(listId);
      return current.filter((list) => list.id !== listId);
    });
    setSelectedId((current) => current === listId ? 'default' : current);
  }

  async function saveRestaurant(restaurant: Restaurant, listIds: string[]) {
    listIds.forEach(requireList);
    const selectedIds = new Set(listIds);
    await mutate(async (current, mode) => {
      if (mode === 'server') {
        const orderedLists = [
          ...current.filter((list) => selectedIds.has(list.id)),
          ...current.filter((list) => !selectedIds.has(list.id)),
        ];
        for (const list of orderedLists) {
          const saved = list.likes.some((item) => item.restaurantId === restaurant.id);
          const selected = selectedIds.has(list.id);
          if (saved === selected) continue;
          if (selected) await addLike(list.id, restaurant);
          else await removeLike(list.id, restaurant.id);
        }
      }
      return current.map((list) => {
        const saved = list.likes.some((item) => item.restaurantId === restaurant.id);
        const selected = selectedIds.has(list.id);
        if (saved === selected) return list;
        return {
          ...list,
          likes: selected ? [{
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            createdAt: new Date().toISOString(),
          }, ...list.likes]
            : list.likes.filter((item) => item.restaurantId !== restaurant.id),
        };
      });
    });
  }

  async function removeRestaurant(listId: string, restaurantId: string) {
    requireList(listId);
    await mutate(async (current, mode) => {
      if (mode === 'server') await removeLike(listId, restaurantId);
      return current.map((list) => list.id === listId ? {
        ...list,
        likes: list.likes.filter((item) => item.restaurantId !== restaurantId),
      } : list);
    });
  }

  return {
    lists,
    selectedList,
    selectList: setSelectedId,
    loading: loading || (data.storage !== storage && !error),
    saving,
    error,
    allLikedIds,
    createList,
    renameList,
    deleteList,
    saveRestaurant,
    removeRestaurant,
    reload,
  };
}

export type LikeListsState = ReturnType<typeof useLikeLists>;
