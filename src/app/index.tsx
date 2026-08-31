import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import "../engine/tests/runDailyRestReferencePeriodScenarios";
import "../engine/tests/runLegalRestRestartScenarios";
import "../engine/tests/runLegalRestResumptionGuardScenarios";
import "../engine/tests/runLiveSplitDailyRestScenarios";
import "../engine/tests/runRestHistoryAdapterScenarios";

import {
  changeActivityHistory,
  formatActivityHistoryDuration,
  getActivityHistoryLabel,
  startActivityHistory,
} from "../data/activityHistory";

import { createActivityStateFromHistory } from "../data/activityState";

import {
  createInitialRestSessionState,
  endRestSession,
  getActiveRestSession,
  getRestSessionElapsedMilliseconds,
  startRestSession,
  type RestSessionType,
} from "../data/restSession";

import {
  loadRestSessionState,
  saveRestSessionState,
} from "../data/restSessionStorage";

import { calculateDailyRestReferencePeriod } from "../engine/dailyRestReferencePeriod";
import { calculateLegalRestRestartState } from "../engine/legalRestRestartState";
import {
  evaluateLegalRestResumption,
  type LegalRestResumptionGuardResult,
} from "../engine/legalRestResumptionGuard";

import { calculateReducedDailyRestAllowance } from "../engine/reducedDailyRestAllowance";

import { buildVerifiedReducedDailyRestEvidence } from "../engine/restHistoryAdapter";

import { calculateWeeklyRestSessionState } from "../engine/weeklyRestSessionState";

import { createActivityTimerStateFromHistory } from "../data/activityTimer";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import ContinuousDrivingGauge from "../components/ContinuousDrivingGauge";
import ContinuousDrivingGaugeSimulator from "../components/ContinuousDrivingGaugeSimulator";
import DailyDrivingGauge from "../components/DailyDrivingGauge";
import FortnightlyDrivingGauge from "../components/FortnightlyDrivingGauge";
import WeeklyDrivingGauge from "../components/WeeklyDrivingGauge";
import {
  evaluateDriverDay,
  evaluateDriverWeek,
} from "../engine/complianceEngine";

import { calculateWeeklyDrivingState } from "../engine/weeklyDrivingState";

import { createCurrentFortnightlyDriverHistory } from "../data/fortnightlyDriverHistory";
import { calculateFortnightlyDrivingState } from "../engine/fortnightlyDrivingState";

import {
  changeDriverActivity,
  createInitialActivityState,
  type DriverActivityType,
} from "../data/activityState";

import {
  loadActivityHistory,
  saveActivityHistory,
} from "../data/activityHistoryStorage";

import {
  changeTimedActivity,
  createInitialActivityTimerState,
  formatActivityDuration,
  getActivityElapsedMilliseconds,
} from "../data/activityTimer";

import {
  buildDriverDayForDate,
  buildLiveDriverDay,
} from "../data/liveDriverDayAdapter";

import {
  createCurrentWeeklyDriverHistory,
  upsertDriverDayIntoWeek,
  type WeeklyDriverHistory,
} from "../data/weeklyDriverHistory";

import {
  loadWeeklyDriverHistory,
  saveWeeklyDriverHistory,
} from "../data/weeklyDriverHistoryStorage";

import { convertWeeklyDriverHistoryToDriverWeek } from "../data/weeklyDriverHistoryAdapter";

import { calculateContinuousDrivingState } from "../engine/continuousDrivingState";

import { calculateDailyDrivingState } from "../engine/dailyDrivingState";

import { calculateExtendedDrivingAllowanceState } from "../engine/extendedDrivingAllowanceState";

import "../engine/tests/runActivityHistoryAdapterScenarios";
import "../engine/tests/runCalendarComplianceEventsScenarios";
import "../engine/tests/runContinuousDrivingStateScenarios";
import "../engine/tests/runDailyDrivingStateScenarios";
import "../engine/tests/runDailyRestScenarios";
import "../engine/tests/runDrivingScenarios";
import "../engine/tests/runExtendedDrivingAllowanceStateScenarios";
import "../engine/tests/runLiveContinuousDrivingScenarios";
import "../engine/tests/runLiveDriverDayAdapterScenarios";
import "../engine/tests/runReducedDailyRestHistoryScenarios";
import "../engine/tests/runRestCompensationScenarios";
import "../engine/tests/runRestResumptionScenarios";
import "../engine/tests/runSafetyMarginScenarios";
import "../engine/tests/runSplitDailyRestScenarios";
import "../engine/tests/runWeeklyDriverHistoryScenarios";
// import "../engine/tests/runWeeklyDriverHistoryStorageScenarios";
import "../engine/tests/runFortnightlyDriverHistoryScenarios";
// import "../engine/tests/runFortnightlyDriverHistoryStorageScenarios";
import "../engine/tests/runFortnightlyDrivingStateScenarios";
import "../engine/tests/runWeeklyDrivingStateScenarios";
import "../engine/tests/runWeeklyRestCompensationAllocationScenarios";
import "../engine/tests/runWeeklyRestDeadlineScenarios";
import "../engine/tests/runWeeklyRestHistoryScenarios";
import "../engine/tests/runWeeklyRestMultiObligationAllocationScenarios";
import "../engine/tests/runWeeklyRestObligationCoordinatorScenarios";

interface DashboardAction {
  label: string;
  activity: DriverActivityType;
}

const actions: DashboardAction[] = [
  {
    label: "Driving",
    activity: "driving",
  },
  {
    label: "Break",
    activity: "break",
  },
  {
    label: "Other Work",
    activity: "other-work",
  },
  {
    label: "POA",
    activity: "poa",
  },
];

const diaryItems = [
  {
    label: "Compliance Network",
    subtitle: "Live overhead view of today's legal journey",
  },
  {
    label: "Weekly Diary",
    subtitle: "View this week's driving record",
  },
  {
    label: "Fortnight Diary",
    subtitle: "View two-week 90h driving compliance",
  },
  {
    label: "Monthly Compliance",
    subtitle: "Heat-map view by day and week",
  },
  {
    label: "Yearly Compliance",
    subtitle: "52-week compliance heat map",
  },
];

function formatClockTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRestDuration(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatRestMilestone(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  return date.toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addRestMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(
    new Date(isoTimestamp).getTime() + minutes * 60 * 1000,
  ).toISOString();
}

function formatRestRestartRoute(
  route:
    | "reduced-daily-rest"
    | "regular-daily-rest"
    | "split-regular-daily-rest",
): string {
  switch (route) {
    case "reduced-daily-rest":
      return "Reduced Daily Rest";
    case "regular-daily-rest":
      return "Regular Daily Rest";
    case "split-regular-daily-rest":
      return "Split Regular Daily Rest";
  }
}

export default function HomeScreen() {
  const initialStartedAt = new Date().toISOString();

  const initialNow = new Date(initialStartedAt).getTime();

  const [activityState, setActivityState] = useState(() =>
    createInitialActivityState(initialStartedAt),
  );

  const [timerState, setTimerState] = useState(() =>
    createInitialActivityTimerState("other-work", initialNow),
  );

  const [activityHistory, setActivityHistory] = useState(() =>
    startActivityHistory("other-work", initialStartedAt, "manual"),
  );

  const [activityHistoryHydrated, setActivityHistoryHydrated] = useState(false);

  const [restSessionState, setRestSessionState] = useState(() =>
    createInitialRestSessionState(),
  );

  const [restSessionHydrated, setRestSessionHydrated] = useState(false);

  const [restResumptionWarning, setRestResumptionWarning] =
    useState<LegalRestResumptionGuardResult | null>(null);

  /**
   * --------------------------------------------------
   * WEEKLY HISTORY
   * --------------------------------------------------
   *
   * Starts with an empty current week.
   *
   * Stored history is loaded before we allow
   * automatic saving.
   */
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyDriverHistory>(() =>
    createCurrentWeeklyDriverHistory(initialNow),
  );

  const [weeklyHistoryHydrated, setWeeklyHistoryHydrated] = useState(false);
  const [fortnightlyHistory, setFortnightlyHistory] = useState(() =>
    createCurrentFortnightlyDriverHistory(initialNow),
  );

  const [fortnightlyHistoryHydrated, setFortnightlyHistoryHydrated] =
    useState(false);

  /**
   * null = real live continuous-driving value.
   *
   * Any number = development-only gauge override.
   */
  const [simulatedUsedMinutes, setSimulatedUsedMinutes] = useState<
    number | null
  >(null);

  const [now, setNow] = useState(initialNow);
  const [activeLocalDate, setActiveLocalDate] = useState(() => {
    const date = new Date(initialNow);

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  });

  /**
   * --------------------------------------------------
   * LIVE CLOCK
   * --------------------------------------------------
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /**
   * --------------------------------------------------
   * LOCAL MIDNIGHT ROLLOVER
   * --------------------------------------------------
   *
   * Resets the dashboard activity totals when the
   * local calendar day changes without interrupting
   * the driver's currently active activity.
   */
  useEffect(() => {
    if (!activityHistoryHydrated) {
      return;
    }

    const currentDate = new Date(now);

    const currentLocalDate = [
      currentDate.getFullYear(),
      String(currentDate.getMonth() + 1).padStart(2, "0"),
      String(currentDate.getDate()).padStart(2, "0"),
    ].join("-");

    if (currentLocalDate === activeLocalDate) {
      return;
    }

    setTimerState(
      createActivityTimerStateFromHistory(activityHistory.events, now),
    );

    setActiveLocalDate(currentLocalDate);
  }, [now, activeLocalDate, activityHistory, activityHistoryHydrated]);

  /**
   * --------------------------------------------------
   * LOAD STORED ACTIVITY HISTORY
   * --------------------------------------------------
   *
   * Restores the driver's activity trace before
   * automatic activity-history saving begins.
   *
   * This prevents a browser refresh or app restart
   * from resetting the beginning of the shift.
   */
  useEffect(() => {
    let cancelled = false;

    async function hydrateActivityHistory() {
      const storedHistory = await loadActivityHistory();

      if (cancelled) {
        return;
      }

      if (storedHistory !== null) {
        setActivityHistory(storedHistory);

        setActivityState(createActivityStateFromHistory(storedHistory.events));

        setTimerState(
          createActivityTimerStateFromHistory(storedHistory.events),
        );
      }

      setActivityHistoryHydrated(true);
    }

    void hydrateActivityHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * --------------------------------------------------
   * SAVE ACTIVITY HISTORY
   * --------------------------------------------------
   *
   * Saving is disabled until hydration has completed.
   *
   * This prevents the temporary fresh activity created
   * during startup from overwriting genuine stored
   * activity history.
   */
  useEffect(() => {
    if (!activityHistoryHydrated) {
      return;
    }

    void saveActivityHistory(activityHistory);
  }, [activityHistory, activityHistoryHydrated]);

  /**
   * --------------------------------------------------
   * LOAD STORED REST SESSION
   * --------------------------------------------------
   */
  useEffect(() => {
    let cancelled = false;

    async function hydrateRestSession() {
      const storedRestSession = await loadRestSessionState();

      if (cancelled) {
        return;
      }

      setRestSessionState(storedRestSession);
      setRestSessionHydrated(true);
    }

    void hydrateRestSession();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * --------------------------------------------------
   * SAVE REST SESSION
   * --------------------------------------------------
   */
  useEffect(() => {
    if (!restSessionHydrated) {
      return;
    }

    void saveRestSessionState(restSessionState);
  }, [restSessionState, restSessionHydrated]);

  /**
   * --------------------------------------------------
   * LOAD STORED WEEK
   * --------------------------------------------------
   *
   * Important:
   *
   * We do NOT start automatic saving until this
   * load has completed.
   *
   * That prevents an empty new state from
   * overwriting genuine saved compliance history.
   */
  useEffect(() => {
    let cancelled = false;

    async function hydrateWeeklyHistory() {
      const currentWeek = createCurrentWeeklyDriverHistory(Date.now());

      const storedHistory = await loadWeeklyDriverHistory();

      if (cancelled) {
        return;
      }

      /**
       * Only accept the stored record when it
       * represents the same Monday-Sunday week.
       *
       * An old week must never leak into the
       * new week's extension allowance.
       */
      const storedIsCurrentWeek =
        storedHistory !== null &&
        storedHistory.weekStartDate === currentWeek.weekStartDate &&
        storedHistory.weekEndDate === currentWeek.weekEndDate;

      setWeeklyHistory(storedIsCurrentWeek ? storedHistory : currentWeek);

      setWeeklyHistoryHydrated(true);
    }

    void hydrateWeeklyHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFortnightlyHistory() {
      const { loadFortnightlyDriverHistory } =
        await import("../data/weeklyDriverHistoryStorage");

      const { rollFortnightlyDriverHistoryForward } =
        await import("../data/fortnightlyDriverHistory");

      const storedHistory = await loadFortnightlyDriverHistory();

      if (cancelled) {
        return;
      }

      if (storedHistory === null) {
        setFortnightlyHistory(
          createCurrentFortnightlyDriverHistory(Date.now()),
        );
      } else {
        setFortnightlyHistory(
          rollFortnightlyDriverHistoryForward(storedHistory, Date.now()),
        );
      }

      setFortnightlyHistoryHydrated(true);
    }

    void hydrateFortnightlyHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleActivityPress(activity: DriverActivityType) {
    const changedAt = Date.now();
    const changedAtIso = new Date(changedAt).toISOString();
    const activeRest = getActiveRestSession(restSessionState);

    if (activeRest?.type === "daily" && activity !== "break") {
      const reducedRestEvidence = buildVerifiedReducedDailyRestEvidence(
        restSessionState.sessions.filter(
          (session) => session.id !== activeRest.id,
        ),
      );

      const referencePeriod = calculateDailyRestReferencePeriod(
        restSessionState.sessions,
        activeRest.startedAt,
        changedAt,
        reducedRestEvidence,
      );

      const referenceStart = referencePeriod.referenceStart;

      const reducedRestAllowance = calculateReducedDailyRestAllowance(
        restSessionState.sessions.filter(
          (session) => session.id !== activeRest.id,
        ),
      );

      const restartState = calculateLegalRestRestartState(
        activeRest,
        restSessionState.sessions,
        reducedRestAllowance,
        referenceStart,
        changedAt,
      );

      const guardResult = evaluateLegalRestResumption(activity, restartState);

      if (!guardResult.mayChangeActivity) {
        setRestResumptionWarning(guardResult);
        setNow(changedAt);
        return;
      }
    }

    setRestResumptionWarning(null);

    if (activeRest !== null && activity !== "break") {
      setRestSessionState((currentState) =>
        endRestSession(currentState, changedAtIso),
      );
    }

    setActivityState((currentState) =>
      changeDriverActivity(currentState, activity, changedAtIso),
    );

    setTimerState((currentState) =>
      changeTimedActivity(currentState, activity, changedAt),
    );

    setActivityHistory((currentHistory) =>
      changeActivityHistory(currentHistory, activity, changedAtIso, "manual"),
    );

    setNow(changedAt);
  }

  function handleStartRest(type: RestSessionType) {
    if (getActiveRestSession(restSessionState) !== null) {
      return;
    }

    setRestResumptionWarning(null);

    const startedAt = Date.now();
    const startedAtIso = new Date(startedAt).toISOString();

    setRestSessionState((currentState) =>
      startRestSession(currentState, type, startedAtIso),
    );

    setActivityState((currentState) =>
      changeDriverActivity(currentState, "break", startedAtIso),
    );

    setTimerState((currentState) =>
      changeTimedActivity(currentState, "break", startedAt),
    );

    setActivityHistory((currentHistory) =>
      changeActivityHistory(currentHistory, "break", startedAtIso, "manual"),
    );

    setNow(startedAt);
  }

  function getDisplayedActivityTime(activity: DriverActivityType): string {
    const milliseconds = getActivityElapsedMilliseconds(
      timerState,
      activity,
      now,
    );

    return formatActivityDuration(milliseconds);
  }

  function getHistoryDuration(
    startedAt: string,
    endedAt: string | null,
    storedDuration: number | null,
  ): string {
    if (storedDuration !== null) {
      return formatActivityHistoryDuration(storedDuration);
    }

    if (endedAt !== null) {
      return formatActivityHistoryDuration(
        new Date(endedAt).getTime() - new Date(startedAt).getTime(),
      );
    }

    return formatActivityHistoryDuration(
      Math.max(0, now - new Date(startedAt).getTime()),
    );
  }

  /**
   * --------------------------------------------------
   * LIVE DRIVER DAY
   * --------------------------------------------------
   */
  const liveDriverDay = buildLiveDriverDay(activityHistory.events, now);

  /**
   * --------------------------------------------------
   * MERGE TODAY INTO STORED WEEK
   * --------------------------------------------------
   *
   * Runs only after storage hydration is complete.
   *
   * Because upsert uses the date as the key,
   * today's live snapshot replaces today's
   * older snapshot instead of creating duplicates.
   */
  useEffect(() => {
    if (!weeklyHistoryHydrated || !activityHistoryHydrated) {
      return;
    }

    setWeeklyHistory((currentHistory) =>
      upsertDriverDayIntoWeek(currentHistory, liveDriverDay),
    );
  }, [
    activityHistoryHydrated,
    activityHistory,
    liveDriverDay.date,
    liveDriverDay.drivingMinutes,
    liveDriverDay.otherWorkMinutes,
    liveDriverDay.breakMinutes,
    liveDriverDay.poaMinutes,
    liveDriverDay.restMinutes,
    liveDriverDay.activities.length,
  ]);

  /**
   * --------------------------------------------------
   * MERGE TODAY INTO STORED FORTNIGHT
   * --------------------------------------------------
   */
  useEffect(() => {
    if (!fortnightlyHistoryHydrated || !activityHistoryHydrated) {
      return;
    }

    setFortnightlyHistory((currentHistory) => ({
      ...currentHistory,

      currentWeek: upsertDriverDayIntoWeek(
        currentHistory.currentWeek,
        liveDriverDay,
      ),
    }));
  }, [
    fortnightlyHistoryHydrated,
    activityHistoryHydrated,
    activityHistory,
    liveDriverDay.date,
    liveDriverDay.drivingMinutes,
    liveDriverDay.otherWorkMinutes,
    liveDriverDay.breakMinutes,
    liveDriverDay.poaMinutes,
    liveDriverDay.restMinutes,
    liveDriverDay.activities.length,
  ]);

  /**
   * --------------------------------------------------
   * SAVE LONG-TERM DRIVER HISTORY
   * --------------------------------------------------
   *
   * The permanent archive is rebuilt from canonical
   * ActivityHistory data.
   *
   * We archive both today and yesterday because an
   * activity can cross the local midnight boundary.
   *
   * Example:
   *
   * Thursday 23:30 -> Friday 00:15
   *
   * Thursday receives:
   * 23:30 -> 00:00
   *
   * Friday receives:
   * 00:00 -> 00:15
   *
   * Both days are written together using one archive
   * load/save cycle.
   */
  useEffect(() => {
    if (!activityHistoryHydrated) {
      return;
    }

    async function persistDriverDayArchive() {
      const { upsertDriverDaysInArchiveStorage } =
        await import("../data/driverHistoryArchiveStorage");

      const currentDate = new Date(now);

      const previousDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() - 1,
        12,
        0,
        0,
        0,
      );

      const previousDateString = [
        previousDate.getFullYear(),
        String(previousDate.getMonth() + 1).padStart(2, "0"),
        String(previousDate.getDate()).padStart(2, "0"),
      ].join("-");

      const previousDriverDay = buildDriverDayForDate(
        activityHistory.events,
        previousDateString,
        now,
      );

      const daysToPersist = [liveDriverDay];

      if (previousDriverDay.activities.length > 0) {
        daysToPersist.push(previousDriverDay);
      }

      await upsertDriverDaysInArchiveStorage(daysToPersist);
    }

    void persistDriverDayArchive();
  }, [
    activityHistoryHydrated,
    activityHistory,
    liveDriverDay.date,
    liveDriverDay.drivingMinutes,
    liveDriverDay.otherWorkMinutes,
    liveDriverDay.breakMinutes,
    liveDriverDay.poaMinutes,
    liveDriverDay.restMinutes,
    liveDriverDay.activities.length,
  ]);

  /**
   * --------------------------------------------------
   * SAVE WEEKLY HISTORY
   * --------------------------------------------------
   *
   * Every meaningful weekly-history change is
   * persisted after hydration.
   */
  useEffect(() => {
    if (!weeklyHistoryHydrated) {
      return;
    }

    void saveWeeklyDriverHistory(weeklyHistory);
  }, [weeklyHistory, weeklyHistoryHydrated]);

  /**
   * --------------------------------------------------
   * SAVE FORTNIGHTLY HISTORY
   * --------------------------------------------------
   */
  useEffect(() => {
    if (!fortnightlyHistoryHydrated) {
      return;
    }

    async function persistFortnightlyHistory() {
      const { saveFortnightlyDriverHistory } =
        await import("../data/weeklyDriverHistoryStorage");

      await saveFortnightlyDriverHistory(fortnightlyHistory);
    }

    void persistFortnightlyHistory();
  }, [fortnightlyHistory, fortnightlyHistoryHydrated]);

  /**
   * --------------------------------------------------
   * CONTINUOUS DRIVING
   * --------------------------------------------------
   */
  const continuousDrivingState = calculateContinuousDrivingState(liveDriverDay);

  const gaugeLimitMinutes = continuousDrivingState.limitMinutes;

  const gaugeUsedMinutes =
    simulatedUsedMinutes ?? continuousDrivingState.drivingMinutesUsed;

  const gaugeRemainingMinutes = Math.max(
    0,
    gaugeLimitMinutes - gaugeUsedMinutes,
  );

  const gaugePercentageUsed =
    gaugeLimitMinutes > 0 ? (gaugeUsedMinutes / gaugeLimitMinutes) * 100 : 0;

  const gaugePercentageRemaining = Math.max(
    0,
    Math.min(100, 100 - gaugePercentageUsed),
  );

  const gaugeStatus: "good" | "warning" | "limit" | "breach" =
    simulatedUsedMinutes === null
      ? continuousDrivingState.status
      : gaugeUsedMinutes > gaugeLimitMinutes
        ? "breach"
        : gaugeUsedMinutes === gaugeLimitMinutes
          ? "limit"
          : gaugeRemainingMinutes <= 60
            ? "warning"
            : "good";

  /**
   * --------------------------------------------------
   * DAILY DRIVING
   * --------------------------------------------------
   */
  const dailyDrivingState = calculateDailyDrivingState(liveDriverDay);
  const dailyCompliance = evaluateDriverDay(liveDriverDay, {
    isLiveDay: true,
  });

  /**
   * --------------------------------------------------
   * CURRENT WEEK
   * --------------------------------------------------
   *
   * Merge today's live snapshot synchronously as
   * well so the dashboard is always current even
   * before the state-saving effect finishes.
   */
  const currentWeek = upsertDriverDayIntoWeek(weeklyHistory, liveDriverDay);
  const driverWeek = convertWeeklyDriverHistoryToDriverWeek(currentWeek);

  const weeklyCompliance = evaluateDriverWeek(driverWeek, {
    liveDate: liveDriverDay.date,
  });
  const weeklyDrivingState = calculateWeeklyDrivingState(currentWeek.days);
  const weeklyWorkingMinutes = currentWeek.days.reduce(
    (total, day) => total + day.drivingMinutes + day.otherWorkMinutes,
    0,
  );
  const liveFortnightCurrentWeek = upsertDriverDayIntoWeek(
    fortnightlyHistory.currentWeek,
    liveDriverDay,
  );

  const fortnightlyDrivingState = calculateFortnightlyDrivingState(
    fortnightlyHistory.previousWeek.days,
    liveFortnightCurrentWeek.days,
  );
  const dashboardComplianceLevel =
    dailyCompliance.level === "breach" ||
    weeklyCompliance.level === "breach" ||
    fortnightlyDrivingState.status === "breach"
      ? "breach"
      : dailyCompliance.level === "warning" ||
          weeklyCompliance.level === "warning" ||
          fortnightlyDrivingState.status === "warning"
        ? "warning"
        : "good";

  const dashboardComplianceText =
    dashboardComplianceLevel === "good"
      ? "COMPLIANT"
      : dashboardComplianceLevel === "warning"
        ? "WARNING"
        : "BREACH";

  /**
   * --------------------------------------------------
   * 10H EXTENSION ALLOWANCE
   * --------------------------------------------------
   */
  const extendedDrivingAllowance = calculateExtendedDrivingAllowanceState(
    currentWeek.days,
  );

  const currentActivityLabel =
    activityState.currentActivity === "driving"
      ? "Driving"
      : activityState.currentActivity === "break"
        ? "Break"
        : activityState.currentActivity === "other-work"
          ? "Other Work"
          : "POA";

  const activeRestSession = getActiveRestSession(restSessionState);

  const activeRestElapsedMilliseconds =
    activeRestSession === null
      ? 0
      : getRestSessionElapsedMilliseconds(activeRestSession, now);

  const dailyNineHourMilestone =
    activeRestSession?.type === "daily"
      ? addRestMinutes(activeRestSession.startedAt, 9 * 60)
      : null;

  const dailyElevenHourMilestone =
    activeRestSession?.type === "daily"
      ? addRestMinutes(activeRestSession.startedAt, 11 * 60)
      : null;

  const weeklyRestState =
    activeRestSession?.type === "weekly"
      ? calculateWeeklyRestSessionState(activeRestSession, now)
      : null;

  const dailyRestReferenceEvidence =
    activeRestSession?.type === "daily"
      ? buildVerifiedReducedDailyRestEvidence(
          restSessionState.sessions.filter(
            (session) => session.id !== activeRestSession.id,
          ),
        )
      : [];

  const dailyRestReferencePeriod =
    activeRestSession?.type === "daily"
      ? calculateDailyRestReferencePeriod(
          restSessionState.sessions,
          activeRestSession.startedAt,
          now,
          dailyRestReferenceEvidence,
        )
      : null;

  const dailyRestReferenceStart =
    dailyRestReferencePeriod?.referenceStart ?? null;

  const reducedDailyRestAllowanceState = calculateReducedDailyRestAllowance(
    restSessionState.sessions.filter(
      (session) => session.id !== activeRestSession?.id,
    ),
  );

  const legalRestRestartState =
    activeRestSession?.type === "daily"
      ? calculateLegalRestRestartState(
          activeRestSession,
          restSessionState.sessions,
          reducedDailyRestAllowanceState,
          dailyRestReferenceStart,
          now,
        )
      : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TachoTrack</Text>

            <Text style={styles.subtitle}>Driver Dashboard</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              dashboardComplianceLevel === "warning" &&
                styles.statusBadgeWarning,
              dashboardComplianceLevel === "breach" && styles.statusBadgeBreach,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                dashboardComplianceLevel === "warning" &&
                  styles.statusTextWarning,
                dashboardComplianceLevel === "breach" &&
                  styles.statusTextBreach,
              ]}
            >
              {dashboardComplianceText}
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Continuous Driving</Text>

          <ContinuousDrivingGauge
            usedMinutes={gaugeUsedMinutes}
            remainingMinutes={gaugeRemainingMinutes}
            limitMinutes={gaugeLimitMinutes}
            percentageUsed={gaugePercentageUsed}
            percentageRemaining={gaugePercentageRemaining}
            status={gaugeStatus}
          />
        </View>

        {__DEV__ && (
          <ContinuousDrivingGaugeSimulator
            activeUsedMinutes={simulatedUsedMinutes}
            onSelect={setSimulatedUsedMinutes}
          />
        )}

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Daily Driving</Text>

          <DailyDrivingGauge
            usedMinutes={dailyDrivingState.drivingMinutesUsed}
            remainingToStandardMinutes={
              dailyDrivingState.remainingToStandardMinutes
            }
            remainingToExtendedMinutes={
              dailyDrivingState.remainingToExtendedMinutes
            }
            standardLimitMinutes={dailyDrivingState.standardLimitMinutes}
            extendedLimitMinutes={dailyDrivingState.extendedLimitMinutes}
            percentageOfStandardUsed={
              dailyDrivingState.percentageOfStandardUsed
            }
            percentageOfExtendedUsed={
              dailyDrivingState.percentageOfExtendedUsed
            }
            percentageRemainingToExtended={
              dailyDrivingState.percentageRemainingToExtended
            }
            status={dailyDrivingState.status}
          />

          <View style={styles.extensionPanel}>
            <View>
              <Text style={styles.extensionLabel}>10h Extensions</Text>

              <Text style={styles.extensionSubtext}>Weekly allowance</Text>
            </View>

            <View style={styles.extensionRight}>
              <View style={styles.extensionDots}>
                <View
                  style={[
                    styles.extensionDot,
                    extendedDrivingAllowance.extensionsRemaining >= 1 &&
                      styles.extensionDotAvailable,
                  ]}
                />

                <View
                  style={[
                    styles.extensionDot,
                    extendedDrivingAllowance.extensionsRemaining >= 2 &&
                      styles.extensionDotAvailable,
                  ]}
                />
              </View>

              <Text
                style={
                  extendedDrivingAllowance.extensionsRemaining > 0
                    ? styles.extensionRemaining
                    : styles.extensionExhausted
                }
              >
                {extendedDrivingAllowance.extensionsRemaining} remaining
              </Text>
            </View>
          </View>

          <Text style={styles.storageStatus}>
            {weeklyHistoryHydrated
              ? "Weekly history saved locally"
              : "Loading weekly history..."}
          </Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Weekly Driving</Text>

          <WeeklyDrivingGauge
            usedMinutes={weeklyDrivingState.drivingMinutesUsed}
            remainingMinutes={weeklyDrivingState.remainingMinutes}
            limitMinutes={weeklyDrivingState.limitMinutes}
            percentageUsed={weeklyDrivingState.percentageUsed}
            percentageRemaining={weeklyDrivingState.percentageRemaining}
            status={weeklyDrivingState.status}
          />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Fortnightly Driving</Text>

          <FortnightlyDrivingGauge
            usedMinutes={fortnightlyDrivingState.drivingMinutesUsed}
            remainingMinutes={fortnightlyDrivingState.remainingMinutes}
            limitMinutes={fortnightlyDrivingState.limitMinutes}
            percentageUsed={fortnightlyDrivingState.percentageUsed}
            percentageRemaining={fortnightlyDrivingState.percentageRemaining}
            status={fortnightlyDrivingState.status}
          />
          <View style={styles.fortnightBreakdown}>
            <View style={styles.fortnightStat}>
              <Text style={styles.fortnightStatLabel}>Previous Week</Text>
              <Text style={styles.fortnightStatValue}>
                {Math.floor(
                  fortnightlyHistory.previousWeek.days.reduce(
                    (total, day) => total + day.drivingMinutes,
                    0,
                  ) / 60,
                )}
                h
              </Text>
            </View>

            <View style={styles.fortnightStat}>
              <Text style={styles.fortnightStatLabel}>Current Week</Text>
              <Text style={styles.fortnightStatValue}>
                {Math.floor(weeklyDrivingState.drivingMinutesUsed / 60)}h
              </Text>
            </View>

            <View style={styles.fortnightStat}>
              <Text style={styles.fortnightStatLabel}>90h Remaining</Text>
              <Text style={styles.fortnightStatRemaining}>
                {Math.floor(fortnightlyDrivingState.remainingMinutes / 60)}h
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.currentActivityPanel}>
          <Text style={styles.currentActivityLabel}>Current Activity</Text>

          <Text style={styles.currentActivityValue}>
            {currentActivityLabel}
          </Text>
        </View>

        <View style={styles.restPanel}>
          <View style={styles.restPanelHeader}>
            <View>
              <Text style={styles.restPanelTitle}>Rest Control</Text>

              <Text style={styles.restPanelSubtitle}>
                Start a protected daily or weekly rest period
              </Text>
            </View>

            <Text
              style={[
                styles.restStorageStatus,
                restSessionHydrated && styles.restStorageStatusReady,
              ]}
            >
              {restSessionHydrated ? "READY" : "LOADING"}
            </Text>
          </View>

          {activeRestSession === null ? (
            <View style={styles.restButtonRow}>
              <Pressable
                disabled={!restSessionHydrated}
                onPress={() => handleStartRest("daily")}
                style={[
                  styles.restStartButton,
                  !restSessionHydrated && styles.restStartButtonDisabled,
                ]}
              >
                <Text style={styles.restStartEyebrow}>START REST</Text>
                <Text style={styles.restStartTitle}>Daily Rest</Text>
                <Text style={styles.restStartText}>
                  Track the 9h and 11h daily-rest milestones
                </Text>
              </Pressable>

              <Pressable
                disabled={!restSessionHydrated}
                onPress={() => handleStartRest("weekly")}
                style={[
                  styles.restStartButton,
                  !restSessionHydrated && styles.restStartButtonDisabled,
                ]}
              >
                <Text style={styles.restStartEyebrow}>START REST</Text>
                <Text style={styles.restStartTitle}>Weekly Rest</Text>
                <Text style={styles.restStartText}>
                  Track the 45h regular weekly-rest milestone
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.activeRestCard}>
              <View style={styles.activeRestTopRow}>
                <View>
                  <Text style={styles.activeRestEyebrow}>REST IN PROGRESS</Text>

                  <Text style={styles.activeRestTitle}>
                    {activeRestSession.type === "daily"
                      ? "Daily Rest"
                      : "Weekly Rest"}
                  </Text>
                </View>

                <Text style={styles.activeRestDuration}>
                  {formatRestDuration(activeRestElapsedMilliseconds)}
                </Text>
              </View>

              <View style={styles.restStatGrid}>
                <View style={styles.restStat}>
                  <Text style={styles.restStatLabel}>Started</Text>
                  <Text style={styles.restStatValue}>
                    {formatRestMilestone(activeRestSession.startedAt)}
                  </Text>
                </View>

                {activeRestSession.type === "daily" &&
                  dailyNineHourMilestone !== null &&
                  dailyElevenHourMilestone !== null && (
                    <>
                      <View style={styles.restStat}>
                        <Text style={styles.restStatLabel}>9h milestone</Text>
                        <Text style={styles.restStatValue}>
                          {formatRestMilestone(dailyNineHourMilestone)}
                        </Text>
                      </View>

                      <View style={styles.restStat}>
                        <Text style={styles.restStatLabel}>11h milestone</Text>
                        <Text style={styles.restStatValue}>
                          {formatRestMilestone(dailyElevenHourMilestone)}
                        </Text>
                      </View>
                    </>
                  )}

                {activeRestSession.type === "weekly" &&
                  weeklyRestState !== null && (
                    <View style={styles.restStat}>
                      <Text style={styles.restStatLabel}>45h milestone</Text>
                      <Text style={styles.restStatValue}>
                        {formatRestMilestone(
                          weeklyRestState.fortyFiveHourCompletionTime,
                        )}
                      </Text>
                    </View>
                  )}
              </View>

              {activeRestSession.type === "daily" &&
                legalRestRestartState !== null && (
                  <View style={styles.restIntelligencePanel}>
                    <View style={styles.restIntelligenceHeader}>
                      <View>
                        <Text style={styles.restIntelligenceEyebrow}>
                          DAILY REST INTELLIGENCE
                        </Text>
                        <Text style={styles.restIntelligenceRoute}>
                          {formatRestRestartRoute(legalRestRestartState.route)}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.restRestartBadge,
                          legalRestRestartState.mayResumeWork
                            ? styles.restRestartBadgeReady
                            : styles.restRestartBadgeWaiting,
                        ]}
                      >
                        <Text
                          style={[
                            styles.restRestartBadgeText,
                            legalRestRestartState.mayResumeWork
                              ? styles.restRestartBadgeTextReady
                              : styles.restRestartBadgeTextWaiting,
                          ]}
                        >
                          {legalRestRestartState.mayResumeWork
                            ? "REST COMPLETE"
                            : "RESTING"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.restIntelligenceGrid}>
                      <View style={styles.restIntelligenceStat}>
                        <Text style={styles.restIntelligenceLabel}>
                          {legalRestRestartState.referenceStatus === "verified"
                            ? "Earliest restart"
                            : "Rest milestone"}
                        </Text>

                        <Text style={styles.restIntelligenceValue}>
                          {formatRestMilestone(
                            legalRestRestartState.earliestLegalRestartTime,
                          )}
                        </Text>
                      </View>

                      <View style={styles.restIntelligenceStat}>
                        <Text style={styles.restIntelligenceLabel}>
                          Remaining
                        </Text>
                        <Text style={styles.restIntelligenceValue}>
                          {Math.floor(
                            legalRestRestartState.remainingRestMinutes / 60,
                          )}
                          h{" "}
                          {String(
                            legalRestRestartState.remainingRestMinutes % 60,
                          ).padStart(2, "0")}
                          m
                        </Text>
                      </View>

                      <View style={styles.restIntelligenceStat}>
                        <Text style={styles.restIntelligenceLabel}>
                          Reduced rests
                        </Text>
                        <Text style={styles.restIntelligenceValue}>
                          {legalRestRestartState.allowanceStatus ===
                            "verified" &&
                          legalRestRestartState.reducedRestsUsed !== null
                            ? `${legalRestRestartState.reducedRestsUsed} / 3 used`
                            : "Unverified"}
                        </Text>
                      </View>

                      <View style={styles.restIntelligenceStat}>
                        <Text style={styles.restIntelligenceLabel}>
                          Reduced remaining
                        </Text>
                        <Text style={styles.restIntelligenceValue}>
                          {legalRestRestartState.allowanceStatus ===
                            "verified" &&
                          legalRestRestartState.reducedRestsRemaining !== null
                            ? legalRestRestartState.reducedRestsRemaining
                            : "—"}
                        </Text>
                      </View>
                    </View>

                    {legalRestRestartState.splitFirstPartAvailable && (
                      <View style={styles.splitRestBanner}>
                        <Text style={styles.splitRestTitle}>
                          SPLIT FIRST PART ✓
                        </Text>
                        <Text style={styles.splitRestText}>
                          Earlier qualifying rest:{" "}
                          {Math.floor(
                            legalRestRestartState.splitFirstPartMinutes / 60,
                          )}
                          h{" "}
                          {String(
                            legalRestRestartState.splitFirstPartMinutes % 60,
                          ).padStart(2, "0")}
                          m. The current 9-hour part can complete a split
                          regular daily rest.
                        </Text>
                      </View>
                    )}

                    <View style={styles.restAllowanceRow}>
                      <Text style={styles.restAllowanceLabel}>
                        Reduced allowance if restarting at earliest time
                      </Text>
                      <Text
                        style={
                          legalRestRestartState.allowanceStatus ===
                            "unverified" ||
                          legalRestRestartState.reducedRestWillBeUsed
                            ? styles.restAllowanceUsed
                            : styles.restAllowancePreserved
                        }
                      >
                        {legalRestRestartState.allowanceStatus === "unverified"
                          ? "UNVERIFIED — 11H REQUIRED"
                          : legalRestRestartState.reducedRestWillBeUsed
                            ? "YES"
                            : "NO — PRESERVED"}
                      </Text>
                    </View>

                    {legalRestRestartState.referenceStatus === "unverified" ? (
                      <View style={styles.restDeadlineWarning}>
                        <Text style={styles.restDeadlineWarningTitle}>
                          REFERENCE PERIOD UNVERIFIED
                        </Text>

                        <Text style={styles.restDeadlineWarningText}>
                          TachoTrack does not yet have enough recorded
                          qualifying-rest history to verify the applicable
                          24-hour daily-rest reference period. The rest
                          milestone may still be shown for planning, but a
                          compliant restart cannot be confirmed.
                        </Text>
                      </View>
                    ) : !legalRestRestartState.restartWithinReferencePeriod ? (
                      <View style={styles.restDeadlineWarning}>
                        <Text style={styles.restDeadlineWarningTitle}>
                          24H DEADLINE EXCEEDED
                        </Text>

                        <Text style={styles.restDeadlineWarningText}>
                          The required rest milestone falls outside the verified
                          24-hour daily-rest reference period and must not be
                          treated as a compliant restart.
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.restNotice}>
                      <Text style={styles.restNoticeTitle}>
                        Restart guidance
                      </Text>
                      <Text style={styles.restNoticeText}>
                        {legalRestRestartState.message}
                      </Text>
                    </View>
                  </View>
                )}

              {activeRestSession.type === "weekly" &&
                weeklyRestState !== null && (
                  <View style={styles.restNotice}>
                    <Text style={styles.restNoticeTitle}>
                      {weeklyRestState.fortyFiveHourReached
                        ? "45h regular weekly rest reached"
                        : "45h regular weekly rest in progress"}
                    </Text>

                    <Text style={styles.restNoticeText}>
                      {weeklyRestState.message}
                    </Text>
                  </View>
                )}

              <Text style={styles.restEndHint}>
                Driving, Other Work and POA are checked before the protected
                rest can end. An early restart attempt leaves the rest running
                and shows a warning.
              </Text>
            </View>
          )}
        </View>

        {restResumptionWarning !== null && (
          <View style={styles.restGuardWarning}>
            <View style={styles.restGuardWarningHeader}>
              <View style={styles.restGuardWarningTitleBlock}>
                <Text style={styles.restGuardWarningEyebrow}>
                  PROTECTED REST
                </Text>

                <Text style={styles.restGuardWarningTitle}>
                  {restResumptionWarning.title}
                </Text>
              </View>

              <Pressable
                onPress={() => setRestResumptionWarning(null)}
                style={styles.restGuardDismissButton}
              >
                <Text style={styles.restGuardDismissText}>DISMISS</Text>
              </Pressable>
            </View>

            <Text style={styles.restGuardWarningText}>
              {restResumptionWarning.message}
            </Text>

            <View style={styles.restGuardWarningStats}>
              <View style={styles.restGuardWarningStat}>
                <Text style={styles.restGuardWarningStatLabel}>
                  Remaining rest
                </Text>

                <Text style={styles.restGuardWarningStatValue}>
                  {Math.floor(restResumptionWarning.remainingRestMinutes / 60)}h{" "}
                  {String(
                    restResumptionWarning.remainingRestMinutes % 60,
                  ).padStart(2, "0")}
                  m
                </Text>
              </View>

              <View style={styles.restGuardWarningStat}>
                <Text style={styles.restGuardWarningStatLabel}>
                  Earliest restart
                </Text>

                <Text style={styles.restGuardWarningStatValue}>
                  {formatRestMilestone(
                    restResumptionWarning.earliestLegalRestartTime,
                  )}
                </Text>
              </View>
            </View>

            <Text style={styles.restGuardWarningFooter}>
              Your activity was not changed and the protected rest is still
              running.
            </Text>
          </View>
        )}

        <View style={styles.actionGrid}>
          {actions.map((action) => {
            const isActive = activityState.currentActivity === action.activity;

            return (
              <Pressable
                key={action.label}
                onPress={() => handleActivityPress(action.activity)}
                style={[styles.actionCard, isActive && styles.actionCardActive]}
              >
                <Text
                  style={[
                    styles.actionLabel,
                    isActive && styles.actionLabelActive,
                  ]}
                >
                  {action.label}
                </Text>

                <Text
                  style={[
                    styles.actionValue,
                    isActive && styles.actionValueActive,
                  ]}
                >
                  {getDisplayedActivityTime(action.activity)}
                </Text>

                {isActive && <Text style={styles.activeIndicator}>ACTIVE</Text>}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.traceSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Activity Trace</Text>

            <Text style={styles.sectionText}>
              Chronological driver activity record
            </Text>
          </View>

          <View style={styles.traceCard}>
            <View style={styles.traceHeader}>
              <Text style={[styles.traceHeaderText, styles.traceTimeColumn]}>
                Start
              </Text>

              <Text
                style={[styles.traceHeaderText, styles.traceActivityColumn]}
              >
                Activity
              </Text>

              <Text
                style={[styles.traceHeaderText, styles.traceDurationColumn]}
              >
                Duration
              </Text>

              <Text style={[styles.traceHeaderText, styles.traceSourceColumn]}>
                Source
              </Text>
            </View>

            {activityHistory.events
              .slice()
              .reverse()
              .map((event) => {
                const isActive = event.id === activityHistory.activeEventId;

                return (
                  <View
                    key={event.id}
                    style={[styles.traceRow, isActive && styles.traceRowActive]}
                  >
                    <Text style={[styles.traceText, styles.traceTimeColumn]}>
                      {formatClockTime(event.startedAt)}
                    </Text>

                    <Text
                      style={[
                        styles.traceActivityText,
                        styles.traceActivityColumn,
                      ]}
                    >
                      {getActivityHistoryLabel(event.activity)}
                    </Text>

                    <Text
                      style={[styles.traceText, styles.traceDurationColumn]}
                    >
                      {getHistoryDuration(
                        event.startedAt,
                        event.endedAt,
                        event.durationMilliseconds,
                      )}
                    </Text>

                    <Text
                      style={[styles.traceSourceText, styles.traceSourceColumn]}
                    >
                      {event.source}
                    </Text>
                  </View>
                );
              })}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Diary & Compliance</Text>

          <Text style={styles.sectionText}>
            Review your recorded activity and WTD status.
          </Text>
        </View>

        <View style={styles.diaryGrid}>
          {diaryItems.map((item) => (
            <Pressable
              key={item.label}
              style={styles.diaryCard}
              onPress={() => {
                if (item.label === "Compliance Network") {
                  router.push("/diary/network");
                }

                if (item.label === "Weekly Diary") {
                  router.push("/diary/week");
                }

                if (item.label === "Fortnight Diary") {
                  router.push("/diary/fortnight");
                }

                if (item.label === "Monthly Compliance") {
                  router.push("/diary/month");
                }

                if (item.label === "Yearly Compliance") {
                  router.push("/diary/year");
                }
              }}
            >
              <Text style={styles.diaryTitle}>{item.label}</Text>

              <Text style={styles.diarySubtitle}>{item.subtitle}</Text>

              <Text style={styles.openText}>Open →</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>Weekly Driving</Text>

            <Text style={styles.summaryValue}>
              {Math.floor(weeklyDrivingState.drivingMinutesUsed / 60)}h{" "}
              {weeklyDrivingState.drivingMinutesUsed % 60}m
            </Text>
          </View>

          <View>
            <Text style={styles.summaryLabel}>Working Time</Text>

            <Text style={styles.summaryValue}>
              {Math.floor(weeklyWorkingMinutes / 60)}h{" "}
              {weeklyWorkingMinutes % 60}m
            </Text>
          </View>

          <View>
            <Text style={styles.summaryLabel}>Compliance</Text>

            <Text style={styles.summaryGood}>Live</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#06111f",
  },

  page: {
    flexGrow: 1,
    padding: 28,
    gap: 24,
    backgroundColor: "#06111f",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brand: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },

  subtitle: {
    color: "#8293a8",
    fontSize: 16,
    marginTop: 4,
  },

  statusBadge: {
    backgroundColor: "#123924",
    borderColor: "#36d274",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },

  statusText: {
    color: "#55e68e",
    fontSize: 12,
    fontWeight: "800",
  },

  statusBadgeWarning: {
    backgroundColor: "#3d3012",
    borderColor: "#f0b94f",
  },

  statusBadgeBreach: {
    backgroundColor: "#421b1b",
    borderColor: "#ff6262",
  },

  statusTextWarning: {
    color: "#f0b94f",
  },

  statusTextBreach: {
    color: "#ff6262",
  },

  hero: {
    alignItems: "center",
    backgroundColor: "#0b1929",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "#183049",
  },

  heroLabel: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },

  extensionPanel: {
    width: "100%",
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#183049",
    backgroundColor: "#081523",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  extensionLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  extensionSubtext: {
    color: "#8293a8",
    fontSize: 11,
    marginTop: 3,
  },

  extensionRight: {
    alignItems: "flex-end",
    gap: 5,
  },

  extensionDots: {
    flexDirection: "row",
    gap: 7,
  },

  extensionDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#44566a",
    backgroundColor: "#182433",
  },

  extensionDotAvailable: {
    backgroundColor: "#55e68e",
    borderColor: "#55e68e",
  },

  extensionRemaining: {
    color: "#55e68e",
    fontSize: 12,
    fontWeight: "900",
  },

  extensionExhausted: {
    color: "#f0b94f",
    fontSize: 12,
    fontWeight: "900",
  },

  storageStatus: {
    color: "#607488",
    fontSize: 10,
    marginTop: 8,
  },

  fortnightBreakdown: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#183049",
  },

  fortnightStat: {
    flex: 1,
    alignItems: "center",
  },

  fortnightStatLabel: {
    color: "#8293a8",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },

  fortnightStatValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },

  fortnightStatRemaining: {
    color: "#55e68e",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },

  currentActivityPanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 18,
    padding: 16,
  },

  currentActivityLabel: {
    color: "#8293a8",
    fontSize: 12,
    fontWeight: "700",
  },

  currentActivityValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },

  restPanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 22,
    padding: 18,
    gap: 16,
  },

  restPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  restPanelTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },

  restPanelSubtitle: {
    color: "#8293a8",
    fontSize: 12,
    marginTop: 4,
  },

  restStorageStatus: {
    color: "#8293a8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  restStorageStatusReady: {
    color: "#55e68e",
  },

  restButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  restStartButton: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 220,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#28527a",
    backgroundColor: "#0a2035",
    padding: 18,
  },

  restStartButtonDisabled: {
    opacity: 0.45,
  },

  restStartEyebrow: {
    color: "#55e68e",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  restStartTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 6,
  },

  restStartText: {
    color: "#95a8bc",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },

  activeRestCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2c6d5a",
    backgroundColor: "#0a211d",
    padding: 18,
    gap: 16,
  },

  activeRestTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },

  activeRestEyebrow: {
    color: "#55e68e",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  activeRestTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },

  activeRestDuration: {
    color: "#7bf3aa",
    fontSize: 26,
    fontWeight: "900",
  },

  restStatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  restStat: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 145,
    borderRadius: 14,
    backgroundColor: "#081914",
    borderWidth: 1,
    borderColor: "#1f4c40",
    padding: 12,
  },

  restStatLabel: {
    color: "#7fa093",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  restStatValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 5,
  },

  restIntelligencePanel: {
    gap: 12,
  },

  restIntelligenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  restIntelligenceEyebrow: {
    color: "#67b8ff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  restIntelligenceRoute: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },

  restRestartBadge: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },

  restRestartBadgeReady: {
    backgroundColor: "#123924",
    borderColor: "#36d274",
  },

  restRestartBadgeWaiting: {
    backgroundColor: "#3d3012",
    borderColor: "#f0b94f",
  },

  restRestartBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  restRestartBadgeTextReady: {
    color: "#55e68e",
  },

  restRestartBadgeTextWaiting: {
    color: "#f0b94f",
  },

  restIntelligenceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  restIntelligenceStat: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 150,
    borderRadius: 14,
    backgroundColor: "#081914",
    borderWidth: 1,
    borderColor: "#1f4c40",
    padding: 12,
  },

  restIntelligenceLabel: {
    color: "#7fa093",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  restIntelligenceValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
  },

  splitRestBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2c6d5a",
    backgroundColor: "#0b2a22",
    padding: 14,
  },

  splitRestTitle: {
    color: "#55e68e",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  splitRestText: {
    color: "#b6d9c9",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  restAllowanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    backgroundColor: "#081523",
    borderWidth: 1,
    borderColor: "#183049",
    padding: 12,
  },

  restAllowanceLabel: {
    color: "#95a8bc",
    fontSize: 11,
    fontWeight: "800",
    flex: 1,
  },

  restAllowanceUsed: {
    color: "#f0b94f",
    fontSize: 11,
    fontWeight: "900",
  },

  restAllowancePreserved: {
    color: "#55e68e",
    fontSize: 11,
    fontWeight: "900",
  },

  restDeadlineWarning: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ff6262",
    backgroundColor: "#421b1b",
    padding: 14,
  },

  restDeadlineWarningTitle: {
    color: "#ff8a8a",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  restDeadlineWarningText: {
    color: "#ffc2c2",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  restNotice: {
    borderRadius: 14,
    backgroundColor: "#0b1d2d",
    borderWidth: 1,
    borderColor: "#25435f",
    padding: 14,
  },

  restNoticeTitle: {
    color: "#67b8ff",
    fontSize: 13,
    fontWeight: "900",
  },

  restNoticeText: {
    color: "#9eb0c3",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  restEndHint: {
    color: "#6f847b",
    fontSize: 10,
    lineHeight: 15,
  },

  restGuardWarning: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f0b94f",
    backgroundColor: "#30250d",
    padding: 18,
    gap: 14,
  },

  restGuardWarningHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  restGuardWarningTitleBlock: {
    flex: 1,
  },

  restGuardWarningEyebrow: {
    color: "#f0b94f",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  restGuardWarningTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },

  restGuardWarningText: {
    color: "#e3d6b6",
    fontSize: 13,
    lineHeight: 20,
  },

  restGuardDismissButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#8c7134",
    backgroundColor: "#211a0b",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },

  restGuardDismissText: {
    color: "#f0b94f",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  restGuardWarningStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  restGuardWarningStat: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#6e5726",
    backgroundColor: "#211a0b",
    padding: 12,
  },

  restGuardWarningStatLabel: {
    color: "#b9a36d",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  restGuardWarningStatValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
  },

  restGuardWarningFooter: {
    color: "#f0b94f",
    fontSize: 11,
    fontWeight: "800",
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  actionCard: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 150,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 20,
    padding: 18,
  },

  actionCardActive: {
    backgroundColor: "#0d3159",
    borderColor: "#258cff",
  },

  actionLabel: {
    color: "#95a8bc",
    fontSize: 14,
    fontWeight: "700",
  },

  actionLabelActive: {
    color: "#ffffff",
  },

  actionValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 10,
  },

  actionValueActive: {
    color: "#67b8ff",
  },

  activeIndicator: {
    color: "#55e68e",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 8,
    letterSpacing: 1,
  },

  traceSection: {
    gap: 12,
  },

  sectionHeader: {
    gap: 4,
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },

  sectionText: {
    color: "#8293a8",
    fontSize: 14,
  },

  traceCard: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 20,
    overflow: "hidden",
  },

  traceHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#081523",
    borderBottomWidth: 1,
    borderBottomColor: "#183049",
  },

  traceHeaderText: {
    color: "#8293a8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  traceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#13263a",
  },

  traceRowActive: {
    backgroundColor: "#0d3159",
  },

  traceText: {
    color: "#dce8f5",
    fontSize: 13,
    fontWeight: "700",
  },

  traceActivityText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  traceSourceText: {
    color: "#55e68e",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  traceTimeColumn: {
    flex: 1.2,
  },

  traceActivityColumn: {
    flex: 1.4,
  },

  traceDurationColumn: {
    flex: 1.2,
  },

  traceSourceColumn: {
    flex: 1,
  },

  diaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  diaryCard: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 220,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 20,
    padding: 20,
  },

  diaryTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },

  diarySubtitle: {
    color: "#8293a8",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },

  openText: {
    color: "#4ba6ff",
    marginTop: 18,
    fontWeight: "800",
  },

  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: "#0b1929",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#183049",
    padding: 20,
  },

  summaryLabel: {
    color: "#8293a8",
    fontSize: 13,
    fontWeight: "700",
  },

  summaryValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
  },

  summaryGood: {
    color: "#55e68e",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
  },
});
