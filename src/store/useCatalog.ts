import { useMemo } from 'react';
import { store } from '../lib/db';
import { toCategory } from '../lib/api';
import { useDbVersion } from '../admin/AdminContext';
import type { Category } from '../types';
import type { Announcement } from '../types/admin';

/**
 * Live category tree.
 *
 * Categories live in Postgres and are hydrated into the shared snapshot, so an
 * admin renaming or hiding a category is reflected here without a reload. The
 * hook subscribes to snapshot changes rather than reading a static array.
 */
export function useCategories(): Category[] {
  useDbVersion();
  return useMemo(() => store.read().categories.map(toCategory), []);
}

/** A single category by id, or undefined when it no longer exists. */
export function useCategory(id: string): Category | undefined {
  const categories = useCategories();
  return categories.find((c) => c.id === id);
}

/**
 * Announcement ticker rows from store settings.
 *
 * Settings travel with the hydrated snapshot, so the same `useDbVersion`
 * subscription the other hooks use keeps this live after an admin edit.
 * Older persisted settings may not carry the key, hence the empty fallback.
 */
export function useAnnouncements(): { items: Announcement[] } {
  useDbVersion();
  return { items: store.read().settings.announcements ?? [] };
}