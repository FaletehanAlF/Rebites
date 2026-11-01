'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FAVORITE_UPDATED_EVENT,
  getLikedFoods,
  isFavorited,
  setFavorite,
  type LikedFood,
} from '@/lib/liked-foods';

interface LikedFoodsState {
  foods: LikedFood[];
  hydrated: boolean;
}

// Store bersama (pola lib/store-closed-modal-store.ts): semua instance
// useLikedFoods berbagi SATU fetch dan SATU set listener, bukan per kartu.
let state: LikedFoodsState = { foods: [], hydrated: false };
let listeners: Array<() => void> = [];
let refreshPromise: Promise<void> | null = null;
let refreshGeneration = 0;
let authSubscription: { unsubscribe: () => void } | null = null;

const SERVER_SNAPSHOT: LikedFoodsState = { foods: [], hydrated: false };

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function refreshStore(force = false): Promise<void> {
  if (refreshPromise && !force) return refreshPromise;
  const generation = ++refreshGeneration;
  const run = (async () => {
    const list = await getLikedFoods();
    // Buang hasil fetch yang sudah tergantikan fetch lebih baru.
    if (generation !== refreshGeneration) return;
    state = { foods: list, hydrated: true };
    emitChange();
  })();
  refreshPromise = run;
  const clear = () => {
    if (refreshPromise === run) refreshPromise = null;
  };
  run.then(clear, clear);
  return run;
}

function isLikedInStore(productId: string): boolean {
  return state.foods.some(
    (f) => f.productId === productId || f.id === productId
  );
}

async function toggleStore(productId: string): Promise<boolean> {
  const next = !isLikedInStore(productId);
  state = {
    ...state,
    foods: next
      ? [...state.foods, { id: productId, productId }]
      : state.foods.filter(
          (f) => f.productId !== productId && f.id !== productId
        ),
  };
  emitChange();

  const ok = await setFavorite(productId, next);
  if (!ok) {
    state = {
      ...state,
      foods: next
        ? state.foods.filter(
            (f) => f.productId !== productId && f.id !== productId
          )
        : [...state.foods, { id: productId, productId }],
    };
    emitChange();
  } else {
    // Paksa fetch baru supaya hasil basi yang sedang berjalan tidak
    // menimpa update optimis tadi.
    void refreshStore(true);
  }
  return ok;
}

function onFavoriteUpdated() {
  void refreshStore();
}

function onVisibilityChange() {
  if (typeof document !== 'undefined' && !document.hidden) void refreshStore();
}

function attachGlobalListeners() {
  window.addEventListener(FAVORITE_UPDATED_EVENT, onFavoriteUpdated);
  document.addEventListener('visibilitychange', onVisibilityChange);
  authSubscription = supabase.auth.onAuthStateChange(() => {
    void refreshStore();
  }).data.subscription;
}

function detachGlobalListeners() {
  window.removeEventListener(FAVORITE_UPDATED_EVENT, onFavoriteUpdated);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  authSubscription?.unsubscribe();
  authSubscription = null;
}

function subscribe(listener: () => void) {
  const first = listeners.length === 0;
  listeners = [...listeners, listener];
  if (first) {
    void refreshStore();
    attachGlobalListeners();
  }
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    if (listeners.length === 0) {
      // Subscriber terakhir unmount: lepas listener global agar tidak bocor.
      detachGlobalListeners();
    }
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

export function useLikedFoods() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const refresh = useCallback(() => refreshStore(), []);
  const toggle = useCallback(
    (productId: string) => toggleStore(productId),
    []
  );

  const isLiked = useCallback(
    (productId: string) =>
      snapshot.foods.some(
        (f) => f.productId === productId || f.id === productId
      ),
    [snapshot]
  );

  const likedIds = useMemo(
    () => new Set(snapshot.foods.map((f) => f.productId || f.id)),
    [snapshot]
  );

  return {
    foods: snapshot.foods,
    hydrated: snapshot.hydrated,
    refresh,
    count: snapshot.foods.length,
    isLiked,
    toggle,
    likedIds,
    isFavorited,
  };
}
