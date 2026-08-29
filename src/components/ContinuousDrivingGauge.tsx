import TachoTrackGauge from "./TachoTrackGauge";

interface ContinuousDrivingGaugeProps {
  usedMinutes: number;
  remainingMinutes: number;
  limitMinutes: number;
  percentageUsed: number;
  percentageRemaining: number;

  status: "good" | "warning" | "limit" | "breach";
}

export default function ContinuousDrivingGauge({
  usedMinutes,
  remainingMinutes,
  limitMinutes,
  percentageUsed,
  percentageRemaining,
  status,
}: ContinuousDrivingGaugeProps) {
  return (
    <TachoTrackGauge
      usedMinutes={usedMinutes}
      remainingMinutes={remainingMinutes}
      limitMinutes={limitMinutes}
      percentageUsed={percentageUsed}
      percentageRemaining={percentageRemaining}
      status={status}
      usedLabel="DRIVEN"
      remainingLabel="REMAINING"
      helperText="4h 30m continuous driving limit"
    />
  );
}
