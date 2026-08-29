export type RestSessionType = "daily" | "weekly";

export type RestSessionStatus = "active" | "completed" | "interrupted";

export interface RestSession {
  id: string;

  /**
   * Driver's intended rest category.
   *
   * The final legal classification is determined
   * from the actual elapsed qualifying rest.
   */
  type: RestSessionType;

  /**
   * Exact timestamp at which the rest began.
   */
  startedAt: string;

  /**
   * Null while rest is still running.
   */
  endedAt: string | null;

  /**
   * Null while rest is still running.
   */
  durationMilliseconds: number | null;

  status: RestSessionStatus;
}

export interface RestSessionState {
  sessions: RestSession[];

  activeSessionId: string | null;
}

/**
 * --------------------------------------------------
 * EMPTY REST HISTORY
 * --------------------------------------------------
 */
export function createInitialRestSessionState(): RestSessionState {
  return {
    sessions: [],
    activeSessionId: null,
  };
}

/**
 * --------------------------------------------------
 * START REST SESSION
 * --------------------------------------------------
 */
export function startRestSession(
  state: RestSessionState,
  type: RestSessionType,
  startedAt: string = new Date().toISOString(),
): RestSessionState {
  /**
   * Never create two simultaneous rest sessions.
   */
  if (state.activeSessionId !== null) {
    return state;
  }

  const id = `rest-${type}-${startedAt}`;

  const session: RestSession = {
    id,
    type,
    startedAt,
    endedAt: null,
    durationMilliseconds: null,
    status: "active",
  };

  return {
    sessions: [...state.sessions, session],
    activeSessionId: id,
  };
}

/**
 * --------------------------------------------------
 * END REST SESSION
 * --------------------------------------------------
 */
export function endRestSession(
  state: RestSessionState,
  endedAt: string = new Date().toISOString(),
): RestSessionState {
  if (state.activeSessionId === null) {
    return state;
  }

  const activeSession = state.sessions.find(
    (session) => session.id === state.activeSessionId,
  );

  if (activeSession === undefined) {
    return {
      ...state,
      activeSessionId: null,
    };
  }

  const startTimestamp = new Date(activeSession.startedAt).getTime();

  const endTimestamp = new Date(endedAt).getTime();

  const durationMilliseconds = Math.max(0, endTimestamp - startTimestamp);

  const sessions = state.sessions.map((session): RestSession => {
    if (session.id !== activeSession.id) {
      return session;
    }

    return {
      ...session,
      endedAt,
      durationMilliseconds,
      status: "completed",
    };
  });

  return {
    sessions,
    activeSessionId: null,
  };
}

/**
 * --------------------------------------------------
 * GET ACTIVE REST
 * --------------------------------------------------
 */
export function getActiveRestSession(
  state: RestSessionState,
): RestSession | null {
  if (state.activeSessionId === null) {
    return null;
  }

  return (
    state.sessions.find((session) => session.id === state.activeSessionId) ??
    null
  );
}

/**
 * --------------------------------------------------
 * REST ELAPSED TIME
 * --------------------------------------------------
 */
export function getRestSessionElapsedMilliseconds(
  session: RestSession,
  now: number = Date.now(),
): number {
  if (session.durationMilliseconds !== null) {
    return session.durationMilliseconds;
  }

  return Math.max(0, now - new Date(session.startedAt).getTime());
}
