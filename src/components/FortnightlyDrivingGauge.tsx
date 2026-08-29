import TachoTrackGauge, { type TachoTrackGaugeStatus } from "./TachoTrackGauge";

interface FortnightlyDrivingGaugeProps {
  usedMinutes: number;
  remainingMinutes: number;
  limitMinutes: number;

  percentageUsed: number;
  percentageRemaining: number;

  status: TachoTrackGaugeStatus;
}

export default function FortnightlyDrivingGauge({
  usedMinutes,
  remainingMinutes,
  limitMinutes,
  percentageUsed,
  percentageRemaining,
  status,
}: FortnightlyDrivingGaugeProps) {
  return (
    <TachoTrackGauge
      usedMinutes={usedMinutes}
      remainingMinutes={remainingMinutes}
      limitMinutes={limitMinutes}
      percentageUsed={percentageUsed}
      percentageRemaining={percentageRemaining}
      status={status}
      usedLabel="USED"
      remainingLabel="REMAINING"
      helperText="Maximum 90h driving across two consecutive weeks"
    />
  );
}
