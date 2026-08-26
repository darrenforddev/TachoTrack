/**
 * TachoTrack Safety Margin Engine
 *
 * IMPORTANT:
 *
 * This module does NOT change legal limits.
 *
 * It creates operational target times around
 * the legal timestamps calculated elsewhere
 * by the compliance engine.
 */

export interface SafetyMarginSettings {
  /**
   * Small technical buffer around a legal limit.
   *
   * Example:
   * Legal driving limit = 14:30
   * Safety margin = 5 minutes
   * Recommended stop = 14:25
   */
  legalSafetyMarginMinutes: number;

  /**
   * Advance planning time before the
   * recommended stop time.
   *
   * Example:
   * Recommended stop = 14:25
   * Planning warning = 20 minutes
   * Start looking for parking = 14:05
   */
  planningWarningMinutes: number;
}

export const DEFAULT_SAFETY_MARGIN_SETTINGS: SafetyMarginSettings = {
  legalSafetyMarginMinutes: 5,
  planningWarningMinutes: 20,
};

export interface DrivingSafetyTimes {
  legalLimitTime: string;

  recommendedStopTime: string;

  planningWarningTime: string;

  legalSafetyMarginMinutes: number;

  planningWarningMinutes: number;
}

export interface RestSafetyTimes {
  legalRestCompleteTime: string;

  recommendedResumeTime: string;

  legalSafetyMarginMinutes: number;
}

export interface SafetyMarginStatus {
  legalTimeReached: boolean;

  recommendedTimeReached: boolean;

  remainingToLegalMinutes: number;

  remainingToRecommendedMinutes: number;
}

function timestamp(dateTime: string): number {
  return new Date(dateTime).getTime();
}

function shiftMinutes(dateTime: string, minutes: number): string {
  return new Date(timestamp(dateTime) + minutes * 60 * 1000).toISOString();
}

function remainingMinutes(
  currentDateTime: string,
  targetDateTime: string,
): number {
  const difference = timestamp(targetDateTime) - timestamp(currentDateTime);

  if (difference <= 0) {
    return 0;
  }

  return Math.ceil(difference / (60 * 1000));
}

function sanitiseMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

/**
 * --------------------------------------------------
 * DRIVING LIMIT
 * --------------------------------------------------
 *
 * Safety operates BEFORE the legal limit.
 *
 * Example:
 *
 * Legal limit:        14:30
 * Safety margin:      5m
 * Recommended stop:   14:25
 * Planning warning:   20m
 * Start planning:     14:05
 */
export function calculateDrivingSafetyTimes(
  legalLimitTime: string,
  settings: SafetyMarginSettings = DEFAULT_SAFETY_MARGIN_SETTINGS,
): DrivingSafetyTimes {
  const legalSafetyMarginMinutes = sanitiseMinutes(
    settings.legalSafetyMarginMinutes,
  );

  const planningWarningMinutes = sanitiseMinutes(
    settings.planningWarningMinutes,
  );

  const recommendedStopTime = shiftMinutes(
    legalLimitTime,
    -legalSafetyMarginMinutes,
  );

  const planningWarningTime = shiftMinutes(
    recommendedStopTime,
    -planningWarningMinutes,
  );

  return {
    legalLimitTime,

    recommendedStopTime,

    planningWarningTime,

    legalSafetyMarginMinutes,

    planningWarningMinutes,
  };
}

/**
 * --------------------------------------------------
 * REST COMPLETION
 * --------------------------------------------------
 *
 * Safety operates AFTER the legal completion time.
 *
 * Example:
 *
 * Legal rest complete: 06:00
 * Safety margin:        5m
 * Recommended resume:   06:05
 */
export function calculateRestSafetyTimes(
  legalRestCompleteTime: string,
  settings: SafetyMarginSettings = DEFAULT_SAFETY_MARGIN_SETTINGS,
): RestSafetyTimes {
  const legalSafetyMarginMinutes = sanitiseMinutes(
    settings.legalSafetyMarginMinutes,
  );

  const recommendedResumeTime = shiftMinutes(
    legalRestCompleteTime,
    legalSafetyMarginMinutes,
  );

  return {
    legalRestCompleteTime,

    recommendedResumeTime,

    legalSafetyMarginMinutes,
  };
}

/**
 * --------------------------------------------------
 * DRIVING STATUS
 * --------------------------------------------------
 *
 * Useful for dashboard timers and Jess.
 */
export function evaluateDrivingSafetyStatus(
  currentDateTime: string,
  safetyTimes: DrivingSafetyTimes,
): SafetyMarginStatus {
  const current = timestamp(currentDateTime);

  const legal = timestamp(safetyTimes.legalLimitTime);

  const recommended = timestamp(safetyTimes.recommendedStopTime);

  return {
    legalTimeReached: current >= legal,

    recommendedTimeReached: current >= recommended,

    remainingToLegalMinutes: remainingMinutes(
      currentDateTime,
      safetyTimes.legalLimitTime,
    ),

    remainingToRecommendedMinutes: remainingMinutes(
      currentDateTime,
      safetyTimes.recommendedStopTime,
    ),
  };
}

/**
 * --------------------------------------------------
 * REST STATUS
 * --------------------------------------------------
 *
 * Notice the distinction:
 *
 * legalTimeReached
 *
 * means the statutory rest duration has elapsed.
 *
 * recommendedTimeReached
 *
 * means the driver's optional TachoTrack safety
 * margin has ALSO elapsed.
 */
export function evaluateRestSafetyStatus(
  currentDateTime: string,
  safetyTimes: RestSafetyTimes,
): SafetyMarginStatus {
  const current = timestamp(currentDateTime);

  const legal = timestamp(safetyTimes.legalRestCompleteTime);

  const recommended = timestamp(safetyTimes.recommendedResumeTime);

  return {
    legalTimeReached: current >= legal,

    recommendedTimeReached: current >= recommended,

    remainingToLegalMinutes: remainingMinutes(
      currentDateTime,
      safetyTimes.legalRestCompleteTime,
    ),

    remainingToRecommendedMinutes: remainingMinutes(
      currentDateTime,
      safetyTimes.recommendedResumeTime,
    ),
  };
}

/**
 * Convenience helper for UI/Jess.
 */
export function formatSafetyMinutes(minutes: number): string {
  const safeMinutes = sanitiseMinutes(minutes);

  const hours = Math.floor(safeMinutes / 60);

  const mins = safeMinutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  return `${hours}h ` + `${mins.toString().padStart(2, "0")}m`;
}
