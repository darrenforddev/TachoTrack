import TachoTrackGauge from "./TachoTrackGauge";

interface DailyDrivingGaugeProps {
  usedMinutes: number;

  remainingToStandardMinutes: number;
  remainingToExtendedMinutes: number;

  standardLimitMinutes: number;
  extendedLimitMinutes: number;

  percentageOfStandardUsed: number;
  percentageOfExtendedUsed: number;
  percentageRemainingToExtended: number;

  status:
    | "good"
    | "warning"
    | "standard-limit"
    | "extended"
    | "extended-warning"
    | "extended-limit"
    | "breach";
}

function mapDailyStatus(
  status: DailyDrivingGaugeProps["status"],
): "good" | "warning" | "limit" | "breach" {
  if (status === "breach") {
    return "breach";
  }

  if (status === "standard-limit" || status === "extended-limit") {
    return "limit";
  }

  if (status === "warning" || status === "extended-warning") {
    return "warning";
  }

  return "good";
}

export default function DailyDrivingGauge({
  usedMinutes,
  remainingToStandardMinutes,
  remainingToExtendedMinutes,
  standardLimitMinutes,
  extendedLimitMinutes,
  percentageOfStandardUsed,
  percentageOfExtendedUsed,
  percentageRemainingToExtended,
  status,
}: DailyDrivingGaugeProps) {
  const extensionInUse = usedMinutes > standardLimitMinutes;

  const displayedRemaining = extensionInUse
    ? remainingToExtendedMinutes
    : remainingToStandardMinutes;

  const displayedLimit = extensionInUse
    ? extendedLimitMinutes
    : standardLimitMinutes;

  const displayedPercentageUsed = extensionInUse
    ? percentageOfExtendedUsed
    : percentageOfStandardUsed;

  const displayedPercentageRemaining = extensionInUse
    ? percentageRemainingToExtended
    : Math.max(0, Math.min(100, 100 - percentageOfStandardUsed));

  const helperText = extensionInUse
    ? "Extended daily driving active — 10h maximum"
    : "Standard daily driving limit — 9h";

  return (
    <TachoTrackGauge
      usedMinutes={usedMinutes}
      remainingMinutes={displayedRemaining}
      limitMinutes={displayedLimit}
      percentageUsed={displayedPercentageUsed}
      percentageRemaining={displayedPercentageRemaining}
      status={mapDailyStatus(status)}
      usedLabel="DRIVEN TODAY"
      remainingLabel="REMAINING"
      helperText={helperText}
    />
  );
}
