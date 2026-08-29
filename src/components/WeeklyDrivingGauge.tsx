import TachoTrackGauge from "./TachoTrackGauge";

interface WeeklyDrivingGaugeProps {
  usedMinutes: number;
  remainingMinutes: number;
  limitMinutes: number;
  percentageUsed: number;
  percentageRemaining: number;

  status: "good" | "warning" | "limit" | "breach";
}

export default function WeeklyDrivingGauge({
  usedMinutes,
  remainingMinutes,
  limitMinutes,
  percentageUsed,
  percentageRemaining,
  status,
}: WeeklyDrivingGaugeProps) {
  return (
    <TachoTrackGauge
      usedMinutes={usedMinutes}
      remainingMinutes={remainingMinutes}
      limitMinutes={limitMinutes}
      percentageUsed={percentageUsed}
      percentageRemaining={percentageRemaining}
      status={status}
      usedLabel="DRIVEN THIS WEEK"
      remainingLabel="REMAINING"
      helperText="Maximum weekly driving time — 56h"
    />
  );
}
