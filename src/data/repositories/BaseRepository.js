import { localStorageAdapter, generateId } from "../../core/db/localStorageAdapter.js";

/**
 * BaseRepository — 所有資料模型共用的 CRUD 介面。
 * 功能模組（features/）永遠透過 Repository 存取資料，
 * 不直接碰 localStorage，未來要換雲端資料庫時，
 * 只需要新增一個 adapter 並替換這裡注入的 adapter。
 */
export class BaseRepository {
  constructor(collectionKey, idPrefix, adapter = localStorageAdapter) {
    this.collectionKey = collectionKey;
    this.idPrefix = idPrefix;
    this.adapter = adapter;
  }

  getAll() {
    return this.adapter.getCollection(this.collectionKey);
  }

  getById(id) {
    return this.getAll().find((item) => item.id === id) || null;
  }

  create(data) {
    const items = this.getAll();
    const now = new Date().toISOString();
    const record = {
      id: generateId(this.idPrefix),
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    items.push(record);
    this.adapter.setCollection(this.collectionKey, items);
    return record;
  }

  update(id, patch) {
    const items = this.getAll();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    items[index] = {
      ...items[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.adapter.setCollection(this.collectionKey, items);
    return items[index];
  }

  delete(id) {
    const items = this.getAll();
    const next = items.filter((item) => item.id !== id);
    this.adapter.setCollection(this.collectionKey, next);
    return next.length < items.length;
  }
}
