import { Easing, StyleSheet, Text, View } from "react-native";

import Svg, { Circle } from "react-native-svg";

import { useEffect, useRef, useState } from "react";

export type TachoTrackGaugeStatus = "good" | "warning" | "limit" | "breach";

interface TachoTrackGaugeProps {
  title?: string;

  usedMinutes: number;
  remainingMinutes: number;
  limitMinutes: number;

  percentageUsed: number;
  percentageRemaining: number;

  status: TachoTrackGaugeStatus;

  usedLabel?: string;
  remainingLabel?: string;

  helperText?: string;
}

const SIZE = 280;

const OUTER_STROKE = 18;
const INNER_STROKE = 12;

const OUTER_RADIUS = 118;
const INNER_RADIUS = 88;

const CENTER = SIZE / 2;

const OUTER_CIRCUMFERENCE = 2 * Math.PI * OUTER_RADIUS;

const INNER_CIRCUMFERENCE = 2 * Math.PI * INNER_RADIUS;

const ANIMATION_DURATION = 500;

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));

  const hours = Math.floor(safeMinutes / 60);

  const remaining = safeMinutes % 60;

  if (hours === 0) {
    return `${remaining}m`;
  }

  return `${hours}h ${remaining.toString().padStart(2, "0")}m`;
}

function getUsedStroke(status: TachoTrackGaugeStatus): string {
  if (status === "breach") {
    return "#ff5a5f";
  }

  if (status === "limit") {
    return "#ff8b3d";
  }

  if (status === "warning") {
    return "#f0b94f";
  }

  return "#258cff";
}

function getRemainingStroke(status: TachoTrackGaugeStatus): string {
  if (status === "breach" || status === "limit") {
    return "#5f6772";
  }

  if (status === "warning") {
    return "#f0b94f";
  }

  return "#55e68e";
}

function getStatusText(status: TachoTrackGaugeStatus): string {
  if (status === "breach") {
    return "Limit exceeded";
  }

  if (status === "limit") {
    return "Limit reached";
  }

  if (status === "warning") {
    return "Approaching limit";
  }

  return "Within limit";
}

function easeOutCubic(progress: number): number {
  return Easing.out(Easing.cubic)(progress);
}

export default function TachoTrackGauge({
  title,
  usedMinutes,
  remainingMinutes,
  limitMinutes,
  percentageUsed,
  percentageRemaining,
  status,
  usedLabel = "USED",
  remainingLabel = "REMAINING",
  helperText,
}: TachoTrackGaugeProps) {
  const targetUsed = clampPercentage(percentageUsed);

  const targetRemaining = clampPercentage(percentageRemaining);

  const [displayUsed, setDisplayUsed] = useState(targetUsed);

  const [displayRemaining, setDisplayRemaining] = useState(targetRemaining);

  const usedRef = useRef(displayUsed);

  const remainingRef = useRef(displayRemaining);

  useEffect(() => {
    usedRef.current = displayUsed;
  }, [displayUsed]);

  useEffect(() => {
    remainingRef.current = displayRemaining;
  }, [displayRemaining]);

  useEffect(() => {
    const startUsed = usedRef.current;

    const startRemaining = remainingRef.current;

    const usedDifference = targetUsed - startUsed;

    const remainingDifference = targetRemaining - startRemaining;

    const startedAt = Date.now();

    let frameId: number | null = null;

    function animate() {
      const elapsed = Date.now() - startedAt;

      const rawProgress = Math.min(1, elapsed / ANIMATION_DURATION);

      const easedProgress = easeOutCubic(rawProgress);

      setDisplayUsed(startUsed + usedDifference * easedProgress);

      setDisplayRemaining(startRemaining + remainingDifference * easedProgress);

      if (rawProgress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    }

    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [targetUsed, targetRemaining]);

  const outerDashOffset = OUTER_CIRCUMFERENCE * (1 - displayUsed / 100);

  const innerDashOffset = INNER_CIRCUMFERENCE * (1 - displayRemaining / 100);

  const usedStroke = getUsedStroke(status);

  const remainingStroke = getRemainingStroke(status);

  return (
    <View style={styles.wrapper}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.gaugeContainer}>
        <Svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={styles.svg}
        >
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_RADIUS}
            stroke="#17324d"
            strokeWidth={OUTER_STROKE}
            fill="none"
          />

          <Circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_RADIUS}
            stroke={usedStroke}
            strokeWidth={OUTER_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={OUTER_CIRCUMFERENCE}
            strokeDashoffset={outerDashOffset}
          />

          <Circle
            cx={CENTER}
            cy={CENTER}
            r={INNER_RADIUS}
            stroke="#153427"
            strokeWidth={INNER_STROKE}
            fill="none"
          />

          <Circle
            cx={CENTER}
            cy={CENTER}
            r={INNER_RADIUS}
            stroke={remainingStroke}
            strokeWidth={INNER_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={INNER_CIRCUMFERENCE}
            strokeDashoffset={innerDashOffset}
          />
        </Svg>

        <View style={styles.centerContent}>
          <Text style={styles.mainValue}>{formatMinutes(usedMinutes)}</Text>

          <Text style={styles.mainLabel}>{usedLabel}</Text>

          <View style={styles.divider} />

          <Text style={styles.remainingValue}>
            {formatMinutes(remainingMinutes)}
          </Text>

          <Text style={styles.remainingLabel}>{remainingLabel}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Used</Text>

          <Text style={styles.statValue}>{percentageUsed.toFixed(1)}%</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statLabel}>Remaining</Text>

          <Text style={styles.statValue}>
            {percentageRemaining.toFixed(1)}%
          </Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statLabel}>Limit</Text>

          <Text style={styles.statValue}>{formatMinutes(limitMinutes)}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            status === "warning" && styles.statusWarning,
            status === "limit" && styles.statusLimit,
            status === "breach" && styles.statusBreach,
          ]}
        />

        <Text style={styles.statusText}>{getStatusText(status)}</Text>
      </View>

      {helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 18,
  },

  svg: {
    transform: [
      {
        rotate: "-90deg",
      },
    ],
  },

  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },

  gaugeContainer: {
    width: SIZE,
    height: SIZE,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  centerContent: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

  mainValue: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },

  mainLabel: {
    color: "#7f97af",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 2,
  },

  divider: {
    width: 70,
    height: 1,
    backgroundColor: "#183049",
    marginVertical: 10,
  },

  remainingValue: {
    color: "#55e68e",
    fontSize: 24,
    fontWeight: "900",
  },

  remainingLabel: {
    color: "#7f97af",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 2,
  },

  statsRow: {
    flexDirection: "row",
    gap: 24,
    justifyContent: "center",
    flexWrap: "wrap",
  },

  stat: {
    alignItems: "center",
  },

  statLabel: {
    color: "#8293a8",
    fontSize: 11,
    fontWeight: "700",
  },

  statValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#55e68e",
  },

  statusWarning: {
    backgroundColor: "#f0b94f",
  },

  statusLimit: {
    backgroundColor: "#ff8b3d",
  },

  statusBreach: {
    backgroundColor: "#ff5a5f",
  },

  statusText: {
    color: "#dce8f5",
    fontSize: 12,
    fontWeight: "800",
  },

  helperText: {
    color: "#8293a8",
    fontSize: 12,
    textAlign: "center",
  },
});
