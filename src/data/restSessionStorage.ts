import AsyncStorage from "@react-native-async-storage/async-storage";

import {
    createInitialRestSessionState,
    type RestSessionState,
} from "./restSession";

const REST_SESSION_STORAGE_KEY = "@tachotrack/rest-session-state/v1";

interface StoredRestSessionState {
  version: 1;

  savedAt: string;

  state: RestSessionState;
}

export async function saveRestSessionState(
  state: RestSessionState,
): Promise<void> {
  const payload: StoredRestSessionState = {
    version: 1,

    savedAt: new Date().toISOString(),

    state,
  };

  await AsyncStorage.setItem(REST_SESSION_STORAGE_KEY, JSON.stringify(payload));
}

export async function loadRestSessionState(): Promise<RestSessionState> {
  const stored = await AsyncStorage.getItem(REST_SESSION_STORAGE_KEY);

  if (stored === null) {
    return createInitialRestSessionState();
  }

  try {
    const parsed = JSON.parse(stored) as StoredRestSessionState;

    if (
      parsed.version !== 1 ||
      parsed.state === undefined ||
      !Array.isArray(parsed.state.sessions)
    ) {
      return createInitialRestSessionState();
    }

    return parsed.state;
  } catch {
    return createInitialRestSessionState();
  }
}

export async function clearRestSessionState(): Promise<void> {
  await AsyncStorage.removeItem(REST_SESSION_STORAGE_KEY);
}

export async function hasStoredRestSessionState(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(REST_SESSION_STORAGE_KEY);

  return stored !== null;
}
