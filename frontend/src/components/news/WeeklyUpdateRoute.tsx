import { useBlockStore } from '../../stores/blockStore';
import type { DriveByEvent } from './SecurityCamRenderer';
import WeeklyUpdateApp from './WeeklyUpdateApp';

export default function WeeklyUpdateRoute() {
  const events = useBlockStore((s) => s.getResolvedDriveBys()) as DriveByEvent[];
  return <WeeklyUpdateApp events={events} />;
}
