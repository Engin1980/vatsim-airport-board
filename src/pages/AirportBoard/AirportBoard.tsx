import { useEffect, useState } from "react";
import type { VatsimData, VatsimPilot } from "../../models/vatsim";
import {
  loadVatsimData,
  extractActiveFlightsPilots,
} from "../../services/vatsimService";
import {
  parseDepTime,
  computeArrival,
  formatTime,
} from "../../utils/flightTime";
import { splitCallsign } from "../../utils/callsign";
import { loadAirports } from "../../services/airportService";
import BoardBlock from "./BoardBlock";

// Fixed ticker widths (characters) — easy to change
const TICKER_WIDTHS = {
  localTime: 5,
  callsign: 8,
  name: 30,
  state: 11,
  delay: 6,
};

function padTickerText(v: any, width: number) {
  const s = v === undefined || v === null ? "" : String(v);
  const trimmed = s.length > width ? s.slice(0, width) : s;
  // use non-breaking spaces so empty tiles remain visible
  return trimmed.padEnd(width, "\u00A0");
}

function formatDelayForCell(delayText: string): string {
  if (!delayText) return "";
  const normalize = (hhmm: string, withPlus = false) => {
    const parts = hhmm.split(":");
    const h = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    return (withPlus ? "+" : "") + `${h}:${m}`;
  };
  // match patterns like "Delayed (+01:20)"
  const delayedMatch = /\(\+(\d{1,2}:\d{2})\)/.exec(delayText);
  if (delayedMatch) return normalize(delayedMatch[1], true);
  // match explicit +HH:MM anywhere
  const plusMatch = /(\+\d{1,2}:\d{2})/.exec(delayText);
  if (plusMatch) return normalize(plusMatch[1].replace("+", ""), true);
  // match Exp HH:MM -> return HH:MM (no plus)
  const expMatch = /^Exp\s+(\d{1,2}:\d{2})/.exec(delayText);
  if (expMatch) return normalize(expMatch[1], false);
  return "";
}

function roundToNearest5(date: Date): Date {
  const d = new Date(date);
  const mins = d.getMinutes();
  const rounded = Math.round(mins / 5) * 5;
  if (rounded === 60) {
    d.setMinutes(0);
    d.setHours(d.getHours() + 1);
  } else {
    d.setMinutes(rounded);
  }
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d;
}

export interface AirportBoardProps {
  icao: string;
}

const AirportBoardComponent = ({ icao }: AirportBoardProps) => {
  const [data, setData] = useState<VatsimData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [airportsMap, setAirportsMap] = useState<Map<string, any> | null>(null);
  const [showAllDepartures, setShowAllDepartures] = useState<boolean>(false);
  const [rowsCount, setRowsCount] = useState<number>(7);
  const [lastFetchAttempt, setLastFetchAttempt] = useState<Date | null>(null);
  const [lastDataTimestamp, setLastDataTimestamp] = useState<string | null>(
    null,
  );

  function formatTimestamp(v: any): string {
    if (!v) return "—";
    try {
      const d = v instanceof Date ? v : new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleString();
    } catch (e) {
      return String(v);
    }
  }

  useEffect(() => {
    // Load airports first on mount and capture errors
    let mounted = true;
    loadAirports()
      .then((m) => {
        if (mounted) setAirportsMap(m);
      })
      .catch((e) => {
        console.warn("Failed to load airports map", e);
        if (mounted) setError(String(e));
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Only load VATSIM data once airportsMap is available to avoid ICAO fallbacks
    if (!airportsMap) return;
    let mounted = true;
    // reset data while reloading initial set
    setData(null);
    setError(null);
    setLastFetchAttempt(new Date());
    loadVatsimData()
      .then((d) => {
        if (mounted) {
          setData(d);
          const ts =
            d?.general?.update ??
            d?.update ??
            d?.general?.timestamp ??
            new Date().toISOString();
          setLastDataTimestamp(ts ?? null);
        }
      })
      .catch((e) => {
        if (mounted) setError(String(e));
      });
    return () => {
      mounted = false;
    };
  }, [icao, airportsMap]);

  // Poll VATSIM feed every 30s in background and update state only when data changed
  useEffect(() => {
    if (!airportsMap) return; // wait for airports
    let mounted = true;

    const fetchAndMaybeUpdate = async () => {
      try {
        // mark the attempt time
        setLastFetchAttempt(new Date());
        const newData = await loadVatsimData();
        if (!mounted) return;
        // update last known server timestamp even if content is identical
        const ts2 =
          newData?.general?.update ??
          newData?.update ??
          newData?.general?.timestamp ??
          new Date().toISOString();
        setLastDataTimestamp(ts2 ?? null);
        setData((prev) => {
          // If there was no previous data, just set the fetched one
          if (!prev) return newData;

          try {
            // Reuse unchanged pilot objects by callsign (preserves refs so React + BoardBlock don't remount)
            const prevPilots = Array.isArray(prev.pilots) ? prev.pilots : [];
            const prevMap = new Map<string, any>();
            prevPilots.forEach((pp: any) => {
              const key = (pp.callsign ?? pp.cid ?? "").toString();
              if (key) prevMap.set(key, pp);
            });

            const mergedPilots = Array.isArray(newData.pilots)
              ? newData.pilots.map((np: any) => {
                  const key = (np.callsign ?? np.cid ?? "").toString();
                  const existing = key ? prevMap.get(key) : null;
                  if (existing) {
                    try {
                      if (JSON.stringify(existing) === JSON.stringify(np))
                        return existing;
                    } catch (e) {
                      // ignore stringify errors and fall through to use new object
                    }
                  }
                  return np;
                })
              : [];

            const merged = { ...newData, pilots: mergedPilots };

            try {
              if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
            } catch (e) {
              // fallthrough
            }

            return merged;
          } catch (e) {
            // fallback: set new data
            return newData;
          }
        });
      } catch (e) {
        // don't disrupt UI on poll errors
        // eslint-disable-next-line no-console
        console.warn("VATSIM poll failed", e);
      }
    };

    // start immediate check and then interval
    fetchAndMaybeUpdate();
    const id = setInterval(fetchAndMaybeUpdate, 30000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [airportsMap]);

  // Debug: log flight_plan for SHT 8V if present
  useEffect(() => {
    const csTargets = ["SHT 8V", "SHT8V"];
    if (!data) return;
    const f = extractActiveFlightsPilots(data).find((p) =>
      csTargets.includes((p.callsign ?? "").toString()),
    );
    if (f) {
      // eslint-disable-next-line no-console
      console.log("DEBUG flight_plan for", f.callsign, f.flight_plan, f);
    }
  }, [data]);

  if (error) return <div>Error loading data: {error}</div>;
  if (!airportsMap) return <div>Loading airports...</div>;
  if (!data) return <div>Loading flights...</div>;

  const pilots: VatsimPilot[] = extractActiveFlightsPilots(data);

  const arrivals = pilots.filter(
    (p) => (p.flight_plan?.arrival ?? "").toUpperCase() === icao.toUpperCase(),
  );
  const departures = pilots.filter(
    (p) =>
      (p.flight_plan?.departure ?? "").toUpperCase() === icao.toUpperCase(),
  );

  // include pre-filed plans (profiles) as departures (synthetic pilots)
  const profiles = (data.profiles ?? []) as any[];
  const prefilePilots = profiles
    .filter(
      (fp) =>
        ((fp.departure ?? "") as string).toUpperCase() === icao.toUpperCase(),
    )
    .map((fp) => ({
      callsign: fp.callsign ?? "",
      flight_plan: fp,
      __is_prefile: true,
    }));

  const departuresSource: any[] = [...departures, ...prefilePilots];

  // compute times and sort ascending (null times last)
  const DIST_ENROUTE_NM = 40;
  const DIST_ARRIVING_NM = 10;

  function computeArrivalState(p: any): string {
    const pos = getPilotPos(p);
    const airport = getAirportCoords(icao);
    const speedRaw =
      (p as any).groundspeed ?? (p as any).ground_speed ?? (p as any).gs;
    const speed: number | null =
      speedRaw === undefined || speedRaw === null ? null : Number(speedRaw);
    let dist: number | null = null;
    if (
      pos &&
      airport &&
      airport.latitude_deg !== null &&
      airport.longitude_deg !== null
    ) {
      dist = distanceNm(
        pos.lat,
        pos.lon,
        Number(airport.latitude_deg),
        Number(airport.longitude_deg),
      );
    }
    // If we don't have a distance, we can't infer anything
    if (dist === null) return "Unknown";
    // If speed is missing, infer state from distance only
    if (speed === null) {
      if (dist > DIST_ENROUTE_NM) return "Enroute";
      if (dist > DIST_ARRIVING_NM) return "Arriving";
      // close to airport but no speed -> treat as Arriving
      return "Arriving";
    }
    if (dist > DIST_ENROUTE_NM) return "Enroute";
    if (dist > DIST_ARRIVING_NM) return "Arriving";
    // dist <= 10
    if (speed > 40) return "Landing";
    if (speed > 0 && speed <= 40) return "Landed";
    if (speed === 0) return "At the gate";
    return "Unknown";
  }

  const arrivalsWithTime = arrivals
    .map((p) => {
      const time = computeArrival(p.flight_plan);
      const pos = getPilotPos(p);
      const airport = getAirportCoords(icao);
      let dist: number | null = null;
      if (
        pos &&
        airport &&
        airport.latitude_deg !== null &&
        airport.longitude_deg !== null
      ) {
        dist = distanceNm(
          pos.lat,
          pos.lon,
          Number(airport.latitude_deg),
          Number(airport.longitude_deg),
        );
      }
      const speedRaw =
        (p as any).groundspeed ?? (p as any).ground_speed ?? (p as any).gs;
      const speed: number | null =
        speedRaw === undefined || speedRaw === null ? null : Number(speedRaw);
      const state = computeArrivalState(p);
      // expected arrival based on current position + groundspeed, plus fixed 10 minutes
      let expected: Date | null = null;
      if (dist !== null && speed !== null && speed > 0) {
        const minutesToGo = (dist / speed) * 60; // hours->minutes
        expected = new Date(
          Date.now() + Math.round((minutesToGo + 10) * 60000),
        );
      }
      // compute delay text: compare expected to planned arrival (time)
      let delayText: string = "";
      if (expected && time) {
        const diffMin = Math.round(
          (expected.getTime() - time.getTime()) / 60000,
        );
        if (diffMin > 10) {
          const rounded = Math.round(diffMin / 10) * 10;
          const hh = Math.floor(rounded / 60);
          const mm = rounded % 60;
          const hhStr = hh.toString().padStart(2, "0");
          const mmStr = mm.toString().padStart(2, "0");
          delayText = `+${hhStr}:${mmStr}`;
        } else {
          // no meaningful delay
          delayText = "";
        }
      } else if (expected) {
        // no planned arrival to compare, still show expected time
        delayText = `Exp ${formatTime(expected)}`;
      } else {
        delayText = "";
      }
      return { p, time, state, speed, dist, expected, delayText };
    })
    .sort((a, b) => {
      if (a.time === null && b.time === null)
        return a.p.callsign.localeCompare(b.p.callsign);
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time.getTime() - b.time.getTime();
    });

  const displayedArrivals = arrivalsWithTime.slice(0, rowsCount);

  const SPEED_THRESHOLD = 40; // knots
  const DIST_THRESHOLD_NM = 5; // nautical miles
  const NOT_MOVING_THRESHOLD = 0.5; // knots

  function deg2rad(d: number) {
    return (d * Math.PI) / 180;
  }
  function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const Rkm = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const km = Rkm * c;
    return km / 1.852; // convert km to nautical miles
  }

  function getPilotPos(p: any) {
    const lat = p.latitude ?? p.latitude_deg ?? p.lat;
    const lon = p.longitude ?? p.longitude_deg ?? p.lon;
    if (lat === undefined || lon === undefined || lat === null || lon === null)
      return null;
    const nLat = Number(lat);
    const nLon = Number(lon);
    if (Number.isFinite(nLat) && Number.isFinite(nLon))
      return { lat: nLat, lon: nLon };
    return null;
  }

  function getAirportCoords(icao: string) {
    if (!airportsMap) return null;
    return airportsMap.get(icao.toUpperCase()) || null;
  }

  function computeDepartureState(p: any): string {
    // prefiles have no state
    if ((p as any).__is_prefile) return "";
    const pos = getPilotPos(p);
    const airport = getAirportCoords(icao);
    const speed = Number(p.groundspeed ?? p.ground_speed ?? p.gs ?? 0) || 0;
    let dist = null;
    if (
      pos &&
      airport &&
      airport.latitude_deg !== null &&
      airport.longitude_deg !== null
    ) {
      dist = distanceNm(
        pos.lat,
        pos.lon,
        Number(airport.latitude_deg),
        Number(airport.longitude_deg),
      );
    }
    // logic
    if (speed > SPEED_THRESHOLD) return "Departed";
    if (dist !== null && dist <= DIST_THRESHOLD_NM) {
      if (speed <= NOT_MOVING_THRESHOLD) return "Gate Open";
      if (speed <= SPEED_THRESHOLD) return "Gate Closed";
    }
    // more than threshold distance
    if (dist !== null && dist > DIST_THRESHOLD_NM) {
      if (speed < SPEED_THRESHOLD) return "Arrived Dest";
      return "Departed";
    }
    // fallback based on speed
    if (speed <= NOT_MOVING_THRESHOLD) return "Gate Open";
    if (speed <= SPEED_THRESHOLD) return "Gate Closed";
    return "Departed";
  }

  const departuresWithTime = departuresSource
    .map((p) => {
      const time = parseDepTime(p.flight_plan);
      const pos = getPilotPos(p);
      const airport = getAirportCoords(icao);
      const speedRaw =
        (p as any).groundspeed ?? (p as any).ground_speed ?? (p as any).gs;
      const speed: number | null =
        speedRaw === undefined || speedRaw === null ? null : Number(speedRaw);
      const isPrefile = Boolean((p as any).__is_prefile);

      let dist: number | null = null;
      if (isPrefile) dist = 0;
      else if (
        pos &&
        airport &&
        airport.latitude_deg !== null &&
        airport.longitude_deg !== null
      ) {
        dist = distanceNm(
          pos.lat,
          pos.lon,
          Number(airport.latitude_deg),
          Number(airport.longitude_deg),
        );
      }

      const state = computeDepartureState(p);
      // compute departure delay:
      // - for real pilots: if Gate Open and planned time passed -> Delayed (round up tens)
      // - for prefiles: if planned time passed -> Delayed (round up tens)
      let delayText: string = "";
      if (isPrefile && time) {
        const now = new Date();
        if (now.getTime() > time.getTime()) {
          const diffMin = Math.ceil((now.getTime() - time.getTime()) / 60000);
          const rounded = Math.ceil(diffMin / 10) * 10; // round up to next 10 minutes
          const hh = Math.floor(rounded / 60);
          const mm = rounded % 60;
          const hhStr = hh.toString().padStart(2, "0");
          const mmStr = mm.toString().padStart(2, "0");
          delayText = `Delayed (+${hhStr}:${mmStr})`;
        }
      } else if (state === "Gate Open" && time) {
        const now = new Date();
        if (now.getTime() > time.getTime()) {
          const diffMin = Math.ceil((now.getTime() - time.getTime()) / 60000);
          const rounded = Math.ceil(diffMin / 10) * 10; // round up to next 10 minutes
          const hh = Math.floor(rounded / 60);
          const mm = rounded % 60;
          const hhStr = hh.toString().padStart(2, "0");
          const mmStr = mm.toString().padStart(2, "0");
          delayText = `Delayed (+${hhStr}:${mmStr})`;
        }
      }

      // compute estimated arrival to destination (for enroute/departed flights)
      let expected: Date | null = null;
      try {
        const destIcao = p.flight_plan?.arrival ?? null;
        const destAirport = destIcao ? getAirportCoords(destIcao) : null;
        if (
          pos &&
          destAirport &&
          destAirport.latitude_deg !== null &&
          destAirport.longitude_deg !== null &&
          speed !== null &&
          speed > 0
        ) {
          const distToDest = distanceNm(
            pos.lat,
            pos.lon,
            Number(destAirport.latitude_deg),
            Number(destAirport.longitude_deg),
          );
          if (distToDest !== null && !isNaN(Number(distToDest))) {
            const minutesToGo = (distToDest / speed) * 60;
            expected = new Date(Date.now() + Math.round(minutesToGo * 60000));
          }
        }
      } catch (e) {
        // ignore failures computing expected
      }

      return { p, time, state, speed, dist, delayText, expected };
    })
    .sort((a, b) => {
      if (a.time === null && b.time === null)
        return a.p.callsign.localeCompare(b.p.callsign);
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time.getTime() - b.time.getTime();
    });

  // filter departures based on checkbox: show all or only those within 50 NM
  const displayedDepartures = departuresWithTime.filter(
    (d) => showAllDepartures || (d.dist !== null && d.dist <= 50),
  );

  return (
    <div style={{ padding: "0.01rem" }}>
      <section style={{ marginTop: "1rem" }}>
        <h3>Arrivals</h3>
        <table
          style={{
            borderCollapse: "collapse",
            width: "auto",
            display: "inline-table",
          }}
        >
          <thead>
            <tr>
              <th>LocalTime</th>
              <th>Callsign</th>
              <th>Město / Název</th>
              <th>State</th>
              <th>Delay</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowsCount }).map((_, idx) => {
              const item = displayedArrivals[idx];
              if (item) {
                const { p, time, state, delayText, expected } = item;
                const originIcao = p.flight_plan?.departure ?? null;
                const originAirport = originIcao
                  ? getAirportCoords(originIcao)
                  : null;
                // Prefer explicit airport name; fall back to municipality/city if available
                let originName =
                  originAirport?.name ??
                  originAirport?.municipality ??
                  originAirport?.city ??
                  null;
                if (originName && originName.endsWith(" Airport"))
                  originName = originName.slice(0, -" Airport".length);
                const originLabel = originName ?? originIcao ?? "—";
                const local = time ? formatTime(roundToNearest5(time)) : "—";
                const cs = splitCallsign(p.callsign);
                // display Est HH:MM for enroute arrivals when expected arrival exists
                const displayState =
                  expected && state === "Enroute"
                    ? `Est ${formatTime(roundToNearest5(expected))}`
                    : state || "";
                return (
                  <tr key={`${p.callsign}-arr`}>
                    <td>
                      <BoardBlock
                        text={local}
                        length={TICKER_WIDTHS.localTime}
                      />
                    </td>
                    <td>
                      <BoardBlock text={cs} length={TICKER_WIDTHS.callsign} />
                    </td>
                    <td>
                      <BoardBlock
                        text={originLabel}
                        length={TICKER_WIDTHS.name}
                      />
                    </td>
                    <td>
                      <BoardBlock
                        text={displayState}
                        length={TICKER_WIDTHS.state}
                      />
                    </td>
                    <td>
                      <BoardBlock
                        text={delayText}
                        length={TICKER_WIDTHS.delay}
                      />
                    </td>
                  </tr>
                );
              }
              // empty row placeholder
              return (
                <tr key={`empty-arr-${idx}`}>
                  <td>
                    <BoardBlock text="" length={TICKER_WIDTHS.localTime} />
                  </td>
                  <td>
                    <BoardBlock text="" length={TICKER_WIDTHS.callsign} />
                  </td>
                  <td>
                    <BoardBlock text="" length={TICKER_WIDTHS.name} />
                  </td>
                  <td>
                    <BoardBlock text="" length={TICKER_WIDTHS.state} />
                  </td>
                  <td>
                    <BoardBlock text="" length={TICKER_WIDTHS.delay} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h3>Departures</h3>
        <table
          style={{
            borderCollapse: "collapse",
            width: "auto",
            display: "inline-table",
          }}
        >
          <thead>
            <tr>
              <th>LocalTime</th>
              <th>Callsign</th>
              <th>Město / Název</th>
              <th>State</th>
              <th>Delay</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowsCount }).map((_, idx) => {
              const item = displayedDepartures[idx];
              if (item) {
                const { p, time, state, delayText, expected } = item;
                const destIcao = p.flight_plan?.arrival ?? null;
                const destAirport = destIcao
                  ? getAirportCoords(destIcao)
                  : null;
                let destName =
                  destAirport?.name ??
                  destAirport?.municipality ??
                  destAirport?.city ??
                  null;
                if (destName && destName.endsWith(" Airport"))
                  destName = destName.slice(0, -" Airport".length);
                const destLabel = destName ?? "—";
                const local = time ? formatTime(roundToNearest5(time)) : "—";
                const cs = splitCallsign(p.callsign);
                // display Est HH:MM for enroute/departed flights when expected arrival exists
                const displayState = 
                  expected && (state === "Enroute" || state === "Departed")
                    ? `Departed`
                    : state || "";
                return (
                  <tr key={`${p.callsign}-dep`}>
                    <td>
                      <BoardBlock
                        text={local}
                        length={TICKER_WIDTHS.localTime}
                      />
                    </td>
                    <td>
                      <BoardBlock text={cs} length={TICKER_WIDTHS.callsign} />
                    </td>
                    <td>
                      <BoardBlock
                        text={destLabel}
                        length={TICKER_WIDTHS.name}
                      />
                    </td>
                    <td>
                      <BoardBlock
                        text={displayState}
                        length={TICKER_WIDTHS.state}
                      />
                    </td>
                    <td>
                      <BoardBlock
                        text={delayText || ""}
                        length={TICKER_WIDTHS.delay}
                      />
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={`empty-dep-${idx}`}>
                  <td>
                    <BoardBlock text="" length={TICKER_WIDTHS.localTime} />
                  </td>
                  <td>
                    <BoardBlock text="" length={TICKER_WIDTHS.callsign} />
                  </td>
                  <td>
                    <BoardBlock text="" length={TICKER_WIDTHS.name} />
                  </td>
                  <td>
                    <BoardBlock text="" length={TICKER_WIDTHS.state} />
                  </td>
                  <td>
                    <BoardBlock text="" length={TICKER_WIDTHS.delay} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div
        style={{
          marginTop: "1.5rem",
          paddingTop: "0.5rem",
          borderTop: "1px solid #eee",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <input
            type="checkbox"
            checked={showAllDepartures}
            onChange={(e) => setShowAllDepartures(e.target.checked)}
          />
          <span>Zobrazit všechny odlety (včetně vzdálenějších než 50 NM)</span>
        </label>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>Počet řádků:</span>
          <input
            type="number"
            min={1}
            value={rowsCount}
            onChange={(e) => {
              const v = parseInt(e.target.value || "10", 10);
              setRowsCount(isNaN(v) ? 10 : Math.max(1, v));
            }}
            style={{ width: "4rem" }}
          />
        </label>

        <div
          style={{
            marginLeft: "auto",
            textAlign: "right",
            color: "#999",
            fontSize: "0.9rem",
          }}
        >
          <div>Soubor: {formatTimestamp(lastDataTimestamp)}</div>
          <div>Poslední pokus: {formatTimestamp(lastFetchAttempt)}</div>
        </div>
      </div>
    </div>
  );
};

export default AirportBoardComponent;
