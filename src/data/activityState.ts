export type DriverActivityType = "driving" | "break" | "other-work" | "poa";

export interface DriverActivityState {
  /**
   * Activity currently selected by the driver.
   */
  currentActivity: DriverActivityType;

  /**
   * When the current activity started.
   *
   * Stored as an ISO timestamp so we can
   * calculate elapsed time later.
   */
  startedAt: string;

  /**
   * Convenience flag for future logic.
   */
  isActive: boolean;
}

/**
 * --------------------------------------------------
 * DEFAULT ACTIVITY STATE
 * --------------------------------------------------
 *
 * For now we begin in Other Work because
 * that is generally safer than assuming
 * the driver is already driving.
 *
 * Later this can come from:
 *
 * - saved session state
 * - manual driver selection
 * - tachograph integration
 */
export function createInitialActivityState(
  startedAt: string = new Date().toISOString(),
): DriverActivityState {
  return {
    currentActivity: "other-work",

    startedAt,

    isActive: true,
  };
}

/**
 * --------------------------------------------------
 * CHANGE ACTIVITY
 * --------------------------------------------------
 *
 * Creates a new state when the driver presses
 * Driving / Break / Other Work / POA.
 *
 * We keep this function pure so it can later
 * be used by:
 *
 * - the dashboard UI
 * - tests
 * - persisted sessions
 * - future tachograph data
 */
export function changeDriverActivity(
  currentState: DriverActivityState,
  nextActivity: DriverActivityType,
  changedAt: string = new Date().toISOString(),
): DriverActivityState {
  /**
   * If the driver selects the activity that is
   * already active, keep the existing start time.
   */
  if (currentState.currentActivity === nextActivity) {
    return currentState;
  }

  return {
    currentActivity: nextActivity,

    startedAt: changedAt,

    isActive: true,
  };
}

/**
 * --------------------------------------------------
 * DRIVER-FACING LABEL
 * --------------------------------------------------
 */
export function getActivityLabel(activity: DriverActivityType): string {
  switch (activity) {
    case "driving":
      return "Driving";

    case "break":
      return "Break";

    case "other-work":
      return "Other Work";

    case "poa":
      return "POA";
  }
}
