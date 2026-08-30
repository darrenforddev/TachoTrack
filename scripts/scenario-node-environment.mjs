const values = new Map();

const localStorage = {
  get length() {
    return values.size;
  },

  clear() {
    values.clear();
  },

  getItem(key) {
    const normalisedKey = String(key);

    return values.has(normalisedKey) ? values.get(normalisedKey) : null;
  },

  key(index) {
    return Array.from(values.keys())[index] ?? null;
  },

  removeItem(key) {
    values.delete(String(key));
  },

  setItem(key, value) {
    values.set(String(key), String(value));
  },
};

globalThis.window = {
  ...(globalThis.window ?? {}),
  localStorage,
};
