
const DB_PREFIX = "smilecare_cache_";
const QUEUE_KEY = "smilecare_sync_queue";

export const localDB = {
  // Save GET results
  save: (path, data) => {
    try {
      localStorage.setItem(DB_PREFIX + path, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error("LocalDB Save Error:", e);
    }
  },

  // Get cached data
  get: (path) => {
    try {
      const cached = localStorage.getItem(DB_PREFIX + path);
      return cached ? JSON.parse(cached).data : null;
    } catch (e) {
      return null;
    }
  },

  // Add to sync queue
  enqueue: (path, method, body, isMultipart = false) => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    queue.push({
      id: Date.now(),
      path,
      method,
      body,
      isMultipart,
      timestamp: Date.now()
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  // Get queue
  getQueue: () => JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"),

  // Clear item from queue
  removeFromQueue: (id) => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    const filtered = queue.filter(item => item.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  }
};
