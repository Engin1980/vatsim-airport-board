import { useEffect, useState } from "react";
import BoardBlock from "../../pages/AirportBoard/BoardBlock";

export type TimeMode = 'Airport' | 'User' | 'Zulu'

interface CurrentTimeProps {
  timeMode: TimeMode;
  airportTz?: string;
  length?: number;
  updateIntervalMs?: number;
}

const CurrentTime = ({ timeMode, airportTz, length = 5, updateIntervalMs = 5000 }: CurrentTimeProps) => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), updateIntervalMs);
    return () => clearInterval(id);
  }, [updateIntervalMs]);

  function formatNow(d: Date): string {
    try {
      if (timeMode === 'Zulu') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      if (timeMode === 'Airport' && airportTz) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: airportTz });
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '—';
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <BoardBlock text={formatNow(now)} length={length} />
    </div>
  );
};

export default CurrentTime;
