export type Memory = {
  id: string;
  fact: string;
  note: string;
  tag: string;
  createdAt: number;
};

const DB_NAME = "monika-mind";
const STORE = "memories";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getMemories(): Promise<Memory[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve((req.result as Memory[]).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

export async function addMemories(
  items: Array<{ fact: string; note: string; tag: string }>,
): Promise<Memory[]> {
  if (typeof indexedDB === "undefined" || !items.length) return [];
  const existing = await getMemories();
  const known = new Set(existing.map((m) => m.fact.toLowerCase().trim()));
  const fresh = items
    .filter((m) => !known.has(m.fact.toLowerCase().trim()))
    .map((m) => ({
      ...m,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    }));
  if (!fresh.length) return [];
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    fresh.forEach((m) => tx.objectStore(STORE).put(m));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return fresh;
}

export async function deleteMemory(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Very small keyword-overlap retrieval (basic RAG). */
export function selectRelevant(memories: Memory[], query: string, limit = 8): Memory[] {
  const tokens = new Set(
    query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 3),
  );
  const scored = memories.map((m) => {
    const hay = `${m.fact} ${m.tag}`.toLowerCase();
    let score = 0;
    tokens.forEach((t) => {
      if (hay.includes(t)) score += 2;
    });
    score += Math.max(0, 1 - (Date.now() - m.createdAt) / (1000 * 60 * 60 * 24 * 30));
    return { m, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.m);
}
