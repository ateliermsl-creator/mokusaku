// 我的 3D 模型：存在這支手機瀏覽器的 IndexedDB，不會上傳。換手機或清除瀏覽器資料就會消失。
const DB = 'mokusaku-models', STORE = 'models';

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), out = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res(out.result); };
    t.onerror = t.onabort = () => { db.close(); rej(t.error); };
  });
};

export const storeOk = () => typeof indexedDB !== 'undefined';
/** 列出已存的模型（不含檔案內容），新的在前 */
export async function listModels() {
  const all = await tx('readonly', (s) => s.getAll());
  return all.map(({ id, name, size, added }) => ({ id, name, size, added })).sort((a, b) => b.added - a.added);
}
export const getModel = (id) => tx('readonly', (s) => s.get(id));
export async function putModel(file) {
  const rec = { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, added: Date.now(), blob: file };
  await tx('readwrite', (s) => s.put(rec));
  return { id: rec.id, name: rec.name, size: rec.size, added: rec.added };
}
export const deleteModel = (id) => tx('readwrite', (s) => s.delete(id));
