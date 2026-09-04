import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import {
  createDriverHistoryArchive,
  type DriverHistoryArchive,
} from "../../data/driverHistoryArchive";
import { loadDriverHistoryArchive } from "../../data/driverHistoryArchiveStorage";
import { loadManualDutyBoundaryStateResult } from "../../data/manualDutyBoundaryStorage";
import {
  createCurrentFortnightlyDriverHistory,
  rollFortnightlyDriverHistoryForward,
} from "../../data/fortnightlyDriverHistory";
import {
  createInitialRestSessionState,
  type RestSession,
  type RestSessionState,
} from "../../data/restSession";
import { loadRestSessionState } from "../../data/restSessionStorage";
import {
  SAMPLE_COMPLIANCE_NETWORK_WEEK_NOW,
  sampleComplianceNetworkCurrentWeek,
  sampleComplianceNetworkPreviousWeekDays,
} from "../../data/sampleComplianceNetworkWeek";
import {
  SAMPLE_COMPLIANCE_JOURNEY_YEAR_LIVE_DATE,
  SAMPLE_COMPLIANCE_JOURNEY_YEAR_NOW,
  sampleComplianceJourneyYearDays,
} from "../../data/sampleComplianceJourneyYear";
import type { WeeklyDriverHistory } from "../../data/weeklyDriverHistory";
import {
  loadFortnightlyDriverHistory,
  loadWeeklyDriverHistory,
} from "../../data/weeklyDriverHistoryStorage";
import {
  buildWeekComplianceNetworkMap,
  type WeekComplianceDaySummary,
  type WeekComplianceNetworkMapResult,
} from "../../engine/weekComplianceNetworkMap";
import {
  buildManualDutyBoundarySnapshot,
  createManualDutyBoundaryState,
  type ManualDutyBoundaryState,
} from "../../engine/manualDutyBoundary";
import { projectManualDutyBoundariesOntoDriverDays } from "../../engine/manualDutyDriverDayAdapter";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DataMode = "live" | "demo";

interface RestTimerDisplay {
  active: boolean;
  kindLabel: string;
  headline: string;
  legalCompleteAt: number | null;
  safeResumeAt: number | null;
}

const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const REST_SAFETY_MARGIN_MINUTES = 5;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

const ACTIVITY_COLOURS = {
  driving: "#f6404b",
  otherWork: "#38bdf8",
  break: "#22c55e",
  poa: "#a855f7",
};

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

function formatDate(dateString: string): string {
  return new Date(`${dateString}T12:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatWeekRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function formatClock(value: number): string {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLocalDate(milliseconds: number): string {
  const date = new Date(milliseconds);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseDateOnly(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const milliseconds = new Date(`${value}T00:00:00.000Z`).getTime();

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return milliseconds;
}

function toDateOnly(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

function buildRequestedWeekHistory(
  days: WeeklyDriverHistory["days"],
  requestedWeekStart: string,
): {
  currentWeek: WeeklyDriverHistory;
  previousWeekDays: WeeklyDriverHistory["days"];
  startMilliseconds: number;
  endExclusiveMilliseconds: number;
} {
  const startMilliseconds = parseDateOnly(requestedWeekStart);

  if (
    startMilliseconds === null ||
    new Date(startMilliseconds).getUTCDay() !== 1
  ) {
    throw new Error("The requested Week Journey must begin on a Monday.");
  }

  const endExclusiveMilliseconds = startMilliseconds + 7 * DAY_MILLISECONDS;
  const weekEndDate = toDateOnly(endExclusiveMilliseconds - DAY_MILLISECONDS);
  const previousWeekStartDate = toDateOnly(
    startMilliseconds - 7 * DAY_MILLISECONDS,
  );
  const previousWeekEndDate = toDateOnly(startMilliseconds - DAY_MILLISECONDS);

  return {
    currentWeek: {
      weekStartDate: requestedWeekStart,
      weekEndDate,
      days: days.filter(
        (day) => day.date >= requestedWeekStart && day.date <= weekEndDate,
      ),
    },
    previousWeekDays: days.filter(
      (day) =>
        day.date >= previousWeekStartDate && day.date <= previousWeekEndDate,
    ),
    startMilliseconds,
    endExclusiveMilliseconds,
  };
}

function getWeekNow(
  startMilliseconds: number,
  endExclusiveMilliseconds: number,
  preferredNow: number,
): number {
  if (
    preferredNow >= startMilliseconds &&
    preferredNow < endExclusiveMilliseconds
  ) {
    return preferredNow;
  }

  return endExclusiveMilliseconds - 12 * 60 * 60 * 1000;
}

function getDayStatusColour(day: WeekComplianceDaySummary): string {
  if (!day.recorded) {
    return "#506782";
  }

  if (day.level === "breach") {
    return "#fb5770";
  }

  if (day.level === "warning") {
    return "#f5a400";
  }

  return "#22c55e";
}

function getDayStatusLabel(day: WeekComplianceDaySummary): string {
  if (!day.recorded) {
    return "NO RECORD";
  }

  if (day.live) {
    return day.level === "breach" ? "LIVE BREACH" : "LIVE";
  }

  if (day.level === "breach") {
    return "BREACH";
  }

  if (day.level === "warning") {
    const dailyDrivingWarning =
      day.lineSeverities["daily-driving"] === "warning";
    const restWarning = day.lineSeverities["daily-rest"] === "warning";

    if (dailyDrivingWarning && restWarning) {
      return "10H + REDUCED REST";
    }

    if (dailyDrivingWarning) {
      return "10H EXTENSION";
    }

    if (restWarning) {
      return "REDUCED REST";
    }

    return "WARNING";
  }

  return "COMPLIANT";
}

function openDay(day: WeekComplianceDaySummary): void {
  if (!day.recorded) {
    return;
  }

  router.push({
    pathname: "/diary/day",
    params: { date: day.date },
  });
}

function ActivityRibbon({ day }: { day: WeekComplianceDaySummary }) {
  const segments = [
    {
      id: "driving",
      minutes: day.drivingMinutes,
      colour: ACTIVITY_COLOURS.driving,
    },
    {
      id: "other-work",
      minutes: Math.max(0, day.workingMinutes - day.drivingMinutes),
      colour: ACTIVITY_COLOURS.otherWork,
    },
    {
      id: "break",
      minutes: day.breakMinutes,
      colour: ACTIVITY_COLOURS.break,
    },
    {
      id: "poa",
      minutes: day.poaMinutes,
      colour: ACTIVITY_COLOURS.poa,
    },
  ].filter((segment) => segment.minutes > 0);

  return (
    <View style={styles.activityRibbon}>
      {segments.map((segment) => (
        <View
          key={segment.id}
          style={{
            backgroundColor: segment.colour,
            flex: segment.minutes,
          }}
        />
      ))}
    </View>
  );
}

function JourneyDay({
  day,
  index,
  manualDutyMinutes,
}: {
  day: WeekComplianceDaySummary;
  index: number;
  manualDutyMinutes: number;
}) {
  const statusColour = getDayStatusColour(day);

  return (
    <Pressable
      disabled={!day.recorded}
      onPress={() => openDay(day)}
      style={({ pressed }) => [
        styles.journeyDay,
        day.live && styles.liveJourneyDay,
        pressed && day.recorded && styles.journeyDayPressed,
      ]}
    >
      <View style={styles.journeyDayHeading}>
        <Text style={styles.journeyDayName}>{DAY_NAMES[index]}</Text>
        <Text style={styles.journeyDayDate}>{formatDate(day.date)}</Text>
      </View>

      <View style={styles.journeyStatusRow}>
        <Text style={[styles.journeyStatus, { color: statusColour }]}>
          {getDayStatusLabel(day)}
        </Text>
        {day.live ? <Text style={styles.nowBadge}>NOW</Text> : null}
      </View>

      <ActivityRibbon day={day} />

      <Text
        style={[
          styles.journeyDayTotal,
          !day.recorded && styles.journeyDayTotalEmpty,
        ]}
      >
        {day.recorded
          ? `${formatMinutes(day.drivingMinutes)} drive · ${formatMinutes(day.workingMinutes)} work`
          : "Awaiting activity"}
      </Text>

      {manualDutyMinutes > 0 ? (
        <Text style={styles.manualDutyBadge}>
          MANUAL DUTY · {formatMinutes(manualDutyMinutes)}
        </Text>
      ) : null}
    </Pressable>
  );
}

function getRestStopPresentation(day: WeekComplianceDaySummary): {
  label: string;
  value: string;
  level: "good" | "warning" | "breach" | "empty";
} {
  if (!day.recorded) {
    return { label: "No evidence", value: "—", level: "empty" };
  }

  if (day.live && day.restMinutes === 0) {
    return { label: "Live rest", value: "In progress", level: "good" };
  }

  if (day.dailyRestType === "regular") {
    return {
      label: "Regular rest",
      value: formatMinutes(day.restMinutes),
      level: "good",
    };
  }

  if (day.dailyRestType === "reduced") {
    return {
      label: "Reduced rest",
      value: formatMinutes(day.restMinutes),
      level: "warning",
    };
  }

  if (day.dailyRestType === "weekly") {
    return {
      label: "Weekly rest",
      value: formatMinutes(day.restMinutes),
      level: "good",
    };
  }

  return {
    label: "Rest unresolved",
    value: formatMinutes(day.restMinutes),
    level: "breach",
  };
}

function RestStop({
  day,
  nextDayName,
  dayName,
}: {
  day: WeekComplianceDaySummary;
  dayName: string;
  nextDayName: string;
}) {
  const presentation = getRestStopPresentation(day);

  return (
    <View
      style={[
        styles.restStop,
        presentation.level === "warning" && styles.restStopWarning,
        presentation.level === "breach" && styles.restStopBreach,
        presentation.level === "empty" && styles.restStopEmpty,
      ]}
    >
      <Text style={styles.restStopRoute}>
        {dayName} → {nextDayName}
      </Text>
      <Text style={styles.restStopLabel}>{presentation.label}</Text>
      <Text style={styles.restStopValue}>{presentation.value}</Text>
    </View>
  );
}

function buildActiveRestTimer(
  session: RestSession | null,
  now: number,
): RestTimerDisplay {
  if (session === null || session.status !== "active") {
    return {
      active: false,
      kindLabel: "OVERNIGHT REST",
      headline: "No active rest timer",
      legalCompleteAt: null,
      safeResumeAt: null,
    };
  }

  const startedAt = new Date(session.startedAt).getTime();

  if (!Number.isFinite(startedAt)) {
    return {
      active: false,
      kindLabel: "OVERNIGHT REST",
      headline: "Rest start time unavailable",
      legalCompleteAt: null,
      safeResumeAt: null,
    };
  }

  const requiredMinutes = session.type === "weekly" ? 45 * 60 : 11 * 60;
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - startedAt) / (60 * 1000)),
  );
  const remainingMinutes = Math.max(0, requiredMinutes - elapsedMinutes);
  const legalCompleteAt = startedAt + requiredMinutes * 60 * 1000;

  return {
    active: true,
    kindLabel:
      session.type === "weekly" ? "WEEKLY REST · LIVE" : "OVERNIGHT REST · LIVE",
    headline:
      remainingMinutes === 0
        ? "Legal rest reached"
        : `${formatMinutes(remainingMinutes)} to legal rest`,
    legalCompleteAt,
    safeResumeAt:
      legalCompleteAt + REST_SAFETY_MARGIN_MINUTES * 60 * 1000,
  };
}

function buildDemoRestTimer(): RestTimerDisplay {
  const legalCompleteAt = new Date("2026-08-30T04:15:00.000Z").getTime();

  return {
    active: true,
    kindLabel: "OVERNIGHT REST · LIVE",
    headline: "6h 00m to legal rest",
    legalCompleteAt,
    safeResumeAt:
      legalCompleteAt + REST_SAFETY_MARGIN_MINUTES * 60 * 1000,
  };
}

function OvernightRestCard({ timer }: { timer: RestTimerDisplay }) {
  return (
    <View style={[styles.overnightCard, !timer.active && styles.overnightCardIdle]}>
      <Text style={styles.overnightKicker}>{timer.kindLabel}</Text>
      <Text style={styles.overnightHeadline}>{timer.headline}</Text>

      {timer.legalCompleteAt !== null && timer.safeResumeAt !== null ? (
        <>
          <View style={styles.overnightRow}>
            <Text style={styles.overnightRowLabel}>Legal completion</Text>
            <Text style={styles.overnightRowValue}>
              {formatClock(timer.legalCompleteAt)}
            </Text>
          </View>
          <View style={styles.overnightRow}>
            <Text style={styles.overnightRowLabel}>Safe resume</Text>
            <Text style={styles.overnightRowValue}>
              {formatClock(timer.safeResumeAt)}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function CumulativeRail({
  label,
  value,
  limitLabel,
  percentage,
  colour,
  stationValues,
}: {
  label: string;
  value: string;
  limitLabel: string;
  percentage: number;
  colour: string;
  stationValues: string[];
}) {
  const used = Math.max(0, Math.min(100, percentage));
  const remaining = Math.max(0.001, 100 - used);

  return (
    <View style={styles.cumulativeRail}>
      <View style={styles.cumulativeHeading}>
        <Text style={styles.cumulativeLabel}>{label}</Text>
        <Text style={[styles.cumulativeValue, { color: colour }]}>
          {value} / {limitLabel}
        </Text>
      </View>

      <View style={styles.railTrack}>
        {used > 0 ? (
          <View style={{ backgroundColor: colour, flex: used }} />
        ) : null}
        <View style={{ flex: remaining }} />
      </View>

      <View style={styles.stationValues}>
        {stationValues.map((station, index) => (
          <Text key={`${label}-${index}`} style={styles.stationValue}>
            {station}
          </Text>
        ))}
      </View>
    </View>
  );
}

function buildCumulativeValues(
  days: WeekComplianceDaySummary[],
  openingMinutes: number,
): string[] {
  let runningTotal = openingMinutes;

  return days.map((day) => {
    if (!day.recorded) {
      return "—";
    }

    runningTotal += day.drivingMinutes;

    return formatMinutes(runningTotal);
  });
}

export default function WeekComplianceNetworkScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    returnMonth?: string;
    returnTo?: string;
    returnYear?: string;
    weekStart?: string;
  }>();
  const requestedMode = getSingleParam(params.mode);
  const returnMonth = getSingleParam(params.returnMonth);
  const returnTo = getSingleParam(params.returnTo);
  const returnYear = getSingleParam(params.returnYear);
  const requestedWeekStart = getSingleParam(params.weekStart);
  const [dataMode, setDataMode] = useState<DataMode>(() =>
    requestedMode === "demo" ? "demo" : "live",
  );
  const [now, setNow] = useState(() => Date.now());
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restState, setRestState] = useState<RestSessionState>(() =>
    createInitialRestSessionState(),
  );
  const [liveHistory, setLiveHistory] = useState(() =>
    createCurrentFortnightlyDriverHistory(Date.now()),
  );
  const [archive, setArchive] = useState<DriverHistoryArchive>(() =>
    createDriverHistoryArchive(),
  );
  const [manualDutyState, setManualDutyState] =
    useState<ManualDutyBoundaryState>(() => createManualDutyBoundaryState());

  useEffect(() => {
    if (requestedMode === "demo" || requestedMode === "live") {
      setDataMode(requestedMode);
    }
  }, [requestedMode]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate(): Promise<void> {
      try {
        const [
          storedWeek,
          storedFortnight,
          storedRestState,
          storedArchive,
          storedManualDuty,
        ] =
          await Promise.all([
            loadWeeklyDriverHistory(),
            loadFortnightlyDriverHistory(),
            loadRestSessionState(),
            loadDriverHistoryArchive(),
            loadManualDutyBoundaryStateResult(),
          ]);

        if (cancelled) {
          return;
        }

        const rolledFortnight =
          storedFortnight === null
            ? createCurrentFortnightlyDriverHistory(Date.now())
            : rollFortnightlyDriverHistoryForward(storedFortnight, Date.now());
        const currentWeek =
          storedWeek !== null &&
          storedWeek.weekStartDate === rolledFortnight.currentWeek.weekStartDate &&
          storedWeek.weekEndDate === rolledFortnight.currentWeek.weekEndDate
            ? storedWeek
            : rolledFortnight.currentWeek;

        setLiveHistory({ ...rolledFortnight, currentWeek });
        setRestState(storedRestState);
        setArchive(storedArchive);
        setManualDutyState(storedManualDuty.state);
        setLoadError(null);
        setHydrated(true);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Stored week history could not be loaded.",
        );
        setHydrated(true);
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [refreshVersion]);

  const prepared = useMemo<{
    result: WeekComplianceNetworkMapResult | null;
    error: string | null;
  }>(() => {
    try {
      if (requestedWeekStart !== undefined) {
        const sourceDays = dataMode === "demo"
          ? sampleComplianceJourneyYearDays
          : projectManualDutyBoundariesOntoDriverDays(
              archive.days,
              manualDutyState,
            ).days;
        const requestedWeek = buildRequestedWeekHistory(
          sourceDays,
          requestedWeekStart,
        );
        const preferredNow =
          dataMode === "demo"
            ? new Date(SAMPLE_COMPLIANCE_JOURNEY_YEAR_NOW).getTime()
            : now;
        const weekNow = getWeekNow(
          requestedWeek.startMilliseconds,
          requestedWeek.endExclusiveMilliseconds,
          preferredNow,
        );
        const candidateLiveDate =
          dataMode === "demo"
            ? SAMPLE_COMPLIANCE_JOURNEY_YEAR_LIVE_DATE
            : getLocalDate(now);
        const liveDate =
          candidateLiveDate >= requestedWeek.currentWeek.weekStartDate &&
          candidateLiveDate <= requestedWeek.currentWeek.weekEndDate
            ? candidateLiveDate
            : undefined;

        return {
          result: buildWeekComplianceNetworkMap({
            id: `week-journey-${dataMode}-${requestedWeekStart}`,
            currentWeek: requestedWeek.currentWeek,
            previousWeekDays: requestedWeek.previousWeekDays,
            ...(liveDate === undefined ? {} : { liveDate }),
            now: weekNow,
          }),
          error: null,
        };
      }

      if (dataMode === "demo") {
        return {
          result: buildWeekComplianceNetworkMap({
            id: "week-journey-demo",
            currentWeek: sampleComplianceNetworkCurrentWeek,
            previousWeekDays: sampleComplianceNetworkPreviousWeekDays,
            liveDate: "2026-08-29",
            now: SAMPLE_COMPLIANCE_NETWORK_WEEK_NOW,
          }),
          error: null,
        };
      }

      const projectedCurrentWeek = projectManualDutyBoundariesOntoDriverDays(
        liveHistory.currentWeek.days,
        manualDutyState,
      );
      const projectedPreviousWeek = projectManualDutyBoundariesOntoDriverDays(
        liveHistory.previousWeek.days,
        manualDutyState,
      );

      return {
        result: buildWeekComplianceNetworkMap({
          id: `week-journey-${liveHistory.currentWeek.weekStartDate}`,
          currentWeek: {
            ...liveHistory.currentWeek,
            days: projectedCurrentWeek.days,
          },
          previousWeekDays: projectedPreviousWeek.days,
          liveDate: getLocalDate(now),
          now,
        }),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error:
          error instanceof Error
            ? error.message
            : "The week journey could not be built.",
      };
    }
  }, [
    archive.days,
    dataMode,
    liveHistory,
    manualDutyState,
    now,
    requestedWeekStart,
  ]);

  const result = prepared.result;
  const resultStartMilliseconds =
    result === null ? null : parseDateOnly(result.days[0].date);
  const resultEndExclusiveMilliseconds =
    resultStartMilliseconds === null
      ? null
      : resultStartMilliseconds + 7 * DAY_MILLISECONDS;
  const preferredDisplayNow =
    dataMode === "demo"
      ? requestedWeekStart === undefined
        ? new Date(SAMPLE_COMPLIANCE_NETWORK_WEEK_NOW).getTime()
        : new Date(SAMPLE_COMPLIANCE_JOURNEY_YEAR_NOW).getTime()
      : now;
  const displayNow =
    requestedWeekStart !== undefined &&
    resultStartMilliseconds !== null &&
    resultEndExclusiveMilliseconds !== null
      ? getWeekNow(
          resultStartMilliseconds,
          resultEndExclusiveMilliseconds,
          preferredDisplayNow,
        )
      : preferredDisplayNow;
  const activeRestSession =
    restState.sessions.find(
      (session) => session.id === restState.activeSessionId,
    ) ?? null;
  const resultContainsLiveDay = result?.days.some((day) => day.live) ?? false;
  const restTimer =
    dataMode === "demo" && resultContainsLiveDay
      ? buildDemoRestTimer()
      : dataMode === "live" && resultContainsLiveDay
        ? buildActiveRestTimer(activeRestSession, now)
        : buildActiveRestTimer(null, displayNow);

  const weeklyStationValues =
    result === null ? [] : buildCumulativeValues(result.days, 0);
  const fortnightStationValues =
    result === null
      ? []
      : buildCumulativeValues(
          result.days,
          result.states.fortnightlyDriving.previousWeekDrivingMinutes,
        );

  function refresh(): void {
    setNow(Date.now());
    setRefreshVersion((version) => version + 1);
  }

  function closeWeek(): void {
    const parsedReturnYear = Number(returnYear);
    const parsedReturnMonth = Number(returnMonth);

    if (returnTo === "fortnight") {
      router.replace({
        pathname: "/diary/fortnight-journey",
        params: { mode: dataMode },
      });

      return;
    }

    if (returnTo === "year" && Number.isInteger(parsedReturnYear)) {
      router.replace({
        pathname: "/diary/year-journey",
        params: { mode: dataMode, year: String(parsedReturnYear) },
      });

      return;
    }

    if (
      Number.isInteger(parsedReturnYear) &&
      Number.isInteger(parsedReturnMonth) &&
      parsedReturnMonth >= 1 &&
      parsedReturnMonth <= 12
    ) {
      router.replace({
        pathname: "/diary/month-journey",
        params: {
          mode: dataMode,
          month: String(parsedReturnMonth),
          ...(returnTo === undefined ? {} : { returnTo }),
          year: String(parsedReturnYear),
        },
      });

      return;
    }

    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>TACHOTRACK LIVE</Text>
            <Text style={styles.screenTitle}>Week Journey</Text>
            <Text style={styles.screenSubtitle}>
              {result === null
                ? "Preparing the current week"
                : `${formatWeekRange(result.days[0].date, result.days[6].date)} · ${dataMode === "demo" ? "demo snapshot" : "updated"} ${formatClock(displayNow)}`}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.segmentedControl}>
              <Pressable
                onPress={() => setDataMode("live")}
                style={[
                  styles.segmentButton,
                  dataMode === "live" && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    dataMode === "live" && styles.segmentTextActive,
                  ]}
                >
                  Live
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDataMode("demo")}
                style={[
                  styles.segmentButton,
                  dataMode === "demo" && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    dataMode === "demo" && styles.segmentTextActive,
                  ]}
                >
                  Demo Week
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={refresh} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </Pressable>
            <Pressable onPress={closeWeek} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>

        {!hydrated && dataMode === "live" ? (
          <View style={styles.messagePanel}>
            <Text style={styles.messageTitle}>Loading stored week…</Text>
          </View>
        ) : null}

        {loadError !== null && dataMode === "live" ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Stored history unavailable</Text>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : null}

        {prepared.error !== null ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Week journey unavailable</Text>
            <Text style={styles.errorText}>{prepared.error}</Text>
          </View>
        ) : null}

        {result !== null ? (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.weeklySummaryCard]}>
                <Text style={styles.summaryLabel}>WEEKLY DRIVING</Text>
                <Text style={styles.summaryValue}>
                  {formatMinutes(result.states.weeklyDriving.drivingMinutesUsed)}
                </Text>
                <Text style={styles.summaryDetail}>
                  {formatMinutes(result.states.weeklyDriving.remainingMinutes)} legally available
                </Text>
              </View>
              <View style={[styles.summaryCard, styles.fortnightSummaryCard]}>
                <Text style={styles.summaryLabel}>FORTNIGHT DRIVING</Text>
                <Text style={styles.summaryValue}>
                  {formatMinutes(result.states.fortnightlyDriving.drivingMinutesUsed)}
                </Text>
                <Text style={styles.summaryDetail}>
                  {formatMinutes(result.states.fortnightlyDriving.remainingMinutes)} before 90h
                </Text>
              </View>
              <View style={[styles.summaryCard, styles.extensionSummaryCard]}>
                <Text style={styles.summaryLabel}>10H EXTENSIONS</Text>
                <Text style={styles.summaryValue}>
                  {result.states.extendedDriving.extensionsUsed} / {result.states.extendedDriving.maxExtensionsPerWeek}
                </Text>
                <Text style={styles.summaryDetail}>
                  {result.states.extendedDriving.extensionsRemaining === 0
                    ? "Weekly allowance exhausted"
                    : `${result.states.extendedDriving.extensionsRemaining} remaining this week`}
                </Text>
              </View>
            </View>

            <View style={styles.mainPanel}>
              <View style={styles.sectionHeadingRow}>
                <View>
                  <Text style={styles.sectionTitle}>The week as one journey</Text>
                  <Text style={styles.sectionSubtitle}>
                    Days are sections; activity changes form the route
                  </Text>
                </View>
                <View style={styles.activityLegend}>
                  <Text style={[styles.legendItem, { color: ACTIVITY_COLOURS.driving }]}>● Driving</Text>
                  <Text style={[styles.legendItem, { color: ACTIVITY_COLOURS.otherWork }]}>● Other Work</Text>
                  <Text style={[styles.legendItem, { color: ACTIVITY_COLOURS.break }]}>● Break</Text>
                  <Text style={[styles.legendItem, { color: ACTIVITY_COLOURS.poa }]}>● POA</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.journeyRow}
              >
                {result.days.map((day, index) => {
                  const manualSnapshot = buildManualDutyBoundarySnapshot(
                    manualDutyState,
                    day.date,
                  );
                  const manualDutyMinutes =
                    dataMode === "live"
                      ? manualSnapshot.additionalOtherWorkMinutes +
                        manualSnapshot.additionalPoaMinutes +
                        manualSnapshot.additionalBreakRestMinutes
                      : 0;

                  return (
                    <JourneyDay
                      key={day.date}
                      day={day}
                      index={index}
                      manualDutyMinutes={manualDutyMinutes}
                    />
                  );
                })}
              </ScrollView>

              <View style={styles.restSection}>
                <View style={styles.restRouteColumn}>
                  <Text style={styles.restSectionTitle}>Overnight-rest route</Text>
                  <Text style={styles.restSectionSubtitle}>
                    Every night is a protected stop between working days
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.restStopsRow}
                  >
                    {result.days.slice(0, 6).map((day, index) => (
                      <RestStop
                        key={`rest-${day.date}`}
                        day={day}
                        dayName={DAY_NAMES[index]}
                        nextDayName={DAY_NAMES[index + 1]}
                      />
                    ))}
                  </ScrollView>
                </View>

                <OvernightRestCard timer={restTimer} />
              </View>

              <View style={styles.cumulativeRailsPanel}>
                <CumulativeRail
                  label="56h weekly route"
                  value={formatMinutes(result.states.weeklyDriving.drivingMinutesUsed)}
                  limitLabel="56h"
                  percentage={result.states.weeklyDriving.percentageUsed}
                  colour="#eab308"
                  stationValues={weeklyStationValues}
                />
                <CumulativeRail
                  label="90h fortnight route"
                  value={formatMinutes(result.states.fortnightlyDriving.drivingMinutesUsed)}
                  limitLabel="90h"
                  percentage={result.states.fortnightlyDriving.percentageUsed}
                  colour="#ec3f6f"
                  stationValues={fortnightStationValues}
                />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#020718", flex: 1 },
  screenContent: { gap: 12, padding: 16 },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  screenTitle: { color: "#f8fafc", fontSize: 28, fontWeight: "900" },
  screenSubtitle: { color: "#6580a6", fontSize: 12, marginTop: 3 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 10 },
  segmentedControl: {
    backgroundColor: "#071426",
    borderColor: "#234463",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3,
  },
  segmentButton: { borderRadius: 7, paddingHorizontal: 13, paddingVertical: 9 },
  segmentButtonActive: { backgroundColor: "#169ee8" },
  segmentText: { color: "#7187a7", fontSize: 12, fontWeight: "800" },
  segmentTextActive: { color: "#ffffff" },
  secondaryButton: {
    backgroundColor: "#071426",
    borderColor: "#234463",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  secondaryButtonText: { color: "#43c6ff", fontSize: 12, fontWeight: "900" },
  closeButton: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },
  closeButtonText: { color: "#071426", fontSize: 12, fontWeight: "900" },
  messagePanel: {
    backgroundColor: "#071426",
    borderColor: "#1a314d",
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  messageTitle: { color: "#dce9f8", fontSize: 14, fontWeight: "800" },
  errorPanel: {
    backgroundColor: "#2b1019",
    borderColor: "#7f253c",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  errorTitle: { color: "#ff91a3", fontSize: 14, fontWeight: "900" },
  errorText: { color: "#ffc2cc", fontSize: 12, marginTop: 5 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: {
    backgroundColor: "#071426",
    borderColor: "#1d354f",
    borderRadius: 14,
    borderTopWidth: 3,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  weeklySummaryCard: { borderTopColor: "#eab308" },
  fortnightSummaryCard: { borderTopColor: "#ec3f6f" },
  extensionSummaryCard: { borderTopColor: "#a855f7" },
  summaryLabel: {
    color: "#607da3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  summaryValue: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 7,
  },
  summaryDetail: { color: "#91a5c0", fontSize: 11, marginTop: 4 },
  mainPanel: {
    backgroundColor: "#061121",
    borderColor: "#1a304b",
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
  },
  sectionHeadingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "900" },
  sectionSubtitle: { color: "#6480a3", fontSize: 11, marginTop: 3 },
  activityLegend: { flexDirection: "row", gap: 14 },
  legendItem: { fontSize: 10, fontWeight: "800" },
  journeyRow: { minWidth: "100%", paddingTop: 14 },
  journeyDay: {
    borderLeftColor: "#1d3855",
    borderLeftWidth: 1,
    minHeight: 172,
    paddingHorizontal: 11,
    paddingVertical: 11,
    width: 177,
  },
  liveJourneyDay: {
    backgroundColor: "#082238",
    borderColor: "#38bdf8",
    borderRadius: 10,
    borderWidth: 1,
  },
  journeyDayPressed: { opacity: 0.72 },
  journeyDayHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  journeyDayName: { color: "#f8fafc", fontSize: 15, fontWeight: "900" },
  journeyDayDate: { color: "#6e87a8", fontSize: 10 },
  journeyStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  journeyStatus: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  nowBadge: {
    backgroundColor: "#0b4b62",
    borderRadius: 7,
    color: "#72e3ff",
    fontSize: 8,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  activityRibbon: {
    backgroundColor: "#14263d",
    borderRadius: 6,
    flexDirection: "row",
    height: 42,
    marginTop: 11,
    overflow: "hidden",
  },
  journeyDayTotal: { color: "#dce8f6", fontSize: 10, fontWeight: "700", marginTop: 9 },
  journeyDayTotalEmpty: { color: "#526a87" },
  manualDutyBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#0b4b62",
    borderRadius: 6,
    color: "#72e3ff",
    fontSize: 8,
    fontWeight: "900",
    marginTop: 7,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  restSection: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  restRouteColumn: { flex: 1 },
  restSectionTitle: { color: "#eaf3ff", fontSize: 13, fontWeight: "900" },
  restSectionSubtitle: { color: "#6480a3", fontSize: 9, marginTop: 2 },
  restStopsRow: { gap: 7, paddingTop: 8 },
  restStop: {
    backgroundColor: "#082d24",
    borderLeftColor: "#22c55e",
    borderLeftWidth: 4,
    borderRadius: 9,
    minHeight: 100,
    padding: 11,
    width: 148,
  },
  restStopWarning: { backgroundColor: "#33260a", borderLeftColor: "#f5a400" },
  restStopBreach: { backgroundColor: "#35131c", borderLeftColor: "#fb5770" },
  restStopEmpty: { backgroundColor: "#111e30", borderLeftColor: "#506782" },
  restStopRoute: { color: "#7590b2", fontSize: 9, fontWeight: "800" },
  restStopLabel: { color: "#bfeccf", fontSize: 10, marginTop: 7 },
  restStopValue: { color: "#f1fff6", fontSize: 15, fontWeight: "900", marginTop: 4 },
  overnightCard: {
    backgroundColor: "#063522",
    borderColor: "#0c6f42",
    borderLeftColor: "#22c55e",
    borderLeftWidth: 5,
    borderRadius: 13,
    borderWidth: 1,
    minHeight: 132,
    minWidth: 275,
    padding: 17,
  },
  overnightCardIdle: { backgroundColor: "#0b1d2b", borderColor: "#29445e" },
  overnightKicker: {
    color: "#47e68b",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  overnightHeadline: { color: "#f4fff7", fontSize: 27, fontWeight: "900", marginVertical: 12 },
  overnightRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  overnightRowLabel: { color: "#8bc5a5", fontSize: 10 },
  overnightRowValue: { color: "#ffffff", fontSize: 11, fontWeight: "900" },
  cumulativeRailsPanel: {
    backgroundColor: "#071426",
    borderColor: "#182f49",
    borderRadius: 13,
    borderWidth: 1,
    gap: 12,
    marginTop: 13,
    padding: 13,
  },
  cumulativeRail: { gap: 5 },
  cumulativeHeading: { flexDirection: "row", justifyContent: "space-between" },
  cumulativeLabel: { color: "#dce9f8", fontSize: 11, fontWeight: "800" },
  cumulativeValue: { fontSize: 11, fontWeight: "900" },
  railTrack: {
    backgroundColor: "#15283e",
    borderRadius: 4,
    flexDirection: "row",
    height: 8,
    overflow: "hidden",
  },
  stationValues: { flexDirection: "row" },
  stationValue: { color: "#617b9e", flex: 1, fontSize: 8, textAlign: "center" },
});
