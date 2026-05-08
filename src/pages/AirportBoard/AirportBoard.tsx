import { useState, useEffect, useRef } from "react";
import useAirportBoard from "../../hooks/useAirportBoard";
import BoardBlock from "./BoardBlock";
import CurrentTime from "../../components/CurrentTime/CurrentTime";
import { roundToNearest5 } from "../../models/airportBoardModel";

// Fixed ticker widths (characters) — easy to change
const TICKER_WIDTHS = {
  localTime: 5,
  callsign: 8,
  name: 40,
  state: 11,
  delay: 6,
};

export interface AirportBoardProps {
  icao: string;
}

const AirportBoardComponent = ({ icao }: AirportBoardProps) => {
  const {
    arrivals,
    departures,
    loadingAirports,
    loadingData,
    error,
    airportsMap,
    rowsCount,
    setRowsCount,
    showAllDepartures,
    setShowAllDepartures,
    lastFetchAttempt,
    lastDataTimestamp,
  } = useAirportBoard(icao);

  const [timeMode, setTimeMode] = useState<"Airport" | "User" | "Zulu">(
    "Airport",
  );

  const airportTz = airportsMap?.get(icao.toUpperCase())?.timezone ?? undefined;

  const _airportRawName =
    airportsMap?.get(icao.toUpperCase())?.name ?? undefined;
  const airportShortName =
    _airportRawName && _airportRawName.endsWith(" Airport")
      ? _airportRawName.slice(0, -" Airport".length)
      : _airportRawName;

  const headerEl = (
    <header className="app-header">
      <h1>
        <a href="#/" aria-label="Back to airport select" style={{ cursor: "pointer", marginRight: 8, color: "#666", textDecoration: 'none' }}>
          ⇖
        </a>
        {airportShortName ? (
          <>
            {icao.toUpperCase()} - {airportShortName}
          </>
        ) : (
          <>{icao.toUpperCase()}</>
        )}
        <span style={{ marginLeft: 8, color: "#666", fontSize: "0.95rem" }}>
          VATSIM Airport Board
        </span>
      </h1>
    </header>
  );

  const [arrPage, setArrPage] = useState(0);
  const [depPage, setDepPage] = useState(0);
  const [autoRotatePages, setAutoRotatePages] = useState(true);
  const [firstPageDurationSec, setFirstPageDurationSec] = useState<number>(15);
  const [otherPagesIntervalSec, setOtherPagesIntervalSec] = useState<number>(15);

  // Persistable UI settings key (per-ICAO)
  const settingsKey = `airportBoardSettings:${icao.toUpperCase()}`;
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load persisted settings for this airport (if any)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(settingsKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s) {
          if (s.timeMode) setTimeMode(s.timeMode);
          if (typeof s.autoRotatePages === "boolean") setAutoRotatePages(s.autoRotatePages);
          if (typeof s.firstPageDurationSec === "number") setFirstPageDurationSec(s.firstPageDurationSec);
          if (typeof s.otherPagesIntervalSec === "number") setOtherPagesIntervalSec(s.otherPagesIntervalSec);
          if (typeof s.rowsCount === "number") setRowsCount(s.rowsCount);
          if (typeof s.showAllDepartures === "boolean") setShowAllDepartures(s.showAllDepartures);
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setSettingsLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icao]);

  // Save settings when they change (but only after initial load to avoid clobbering)
  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      const s = {
        timeMode,
        autoRotatePages,
        firstPageDurationSec,
        otherPagesIntervalSec,
        rowsCount,
        showAllDepartures,
      };
      localStorage.setItem(settingsKey, JSON.stringify(s));
    } catch (e) {
      // ignore
    }
  }, [settingsLoaded, settingsKey, timeMode, autoRotatePages, firstPageDurationSec, otherPagesIntervalSec, rowsCount, showAllDepartures]);

  // header is rendered inside table thead so it lines up naturally

  const prevRowsCountArrRef = useRef<number>(rowsCount);
  const prevRowsCountDepRef = useRef<number>(rowsCount);

  // No per-page filter — use arrivals/departures directly from the model

  useEffect(() => {
    const prevArr = prevRowsCountArrRef.current;
    const prevDep = prevRowsCountDepRef.current;

    // If rowsCount changed for arrivals and we have arrivals data, recompute arrival page
    if (prevArr !== rowsCount && (arrivals?.length || 0) > 0) {
      setArrPage((prevPage) => {
        const globalIndex = prevPage * prevArr;
        const newTotal = Math.max(
          1,
          Math.ceil((arrivals?.length || 0) / rowsCount),
        );
        const newPage = Math.floor(globalIndex / rowsCount);
        return Math.min(Math.max(0, newPage), newTotal - 1);
      });
      prevRowsCountArrRef.current = rowsCount;
    }

    // If rowsCount changed for departures and we have departures data, recompute departure page
    if (prevDep !== rowsCount && (departures?.length || 0) > 0) {
      setDepPage((prevPage) => {
        const globalIndex = prevPage * prevDep;
        const newTotal = Math.max(
          1,
          Math.ceil((departures?.length || 0) / rowsCount),
        );
        const newPage = Math.floor(globalIndex / rowsCount);
        return Math.min(Math.max(0, newPage), newTotal - 1);
      });
      prevRowsCountDepRef.current = rowsCount;
    }
  }, [rowsCount, arrivals?.length, departures?.length]);

  const arrTotalPages = Math.max(
    1,
    Math.ceil((arrivals?.length || 0) / rowsCount),
  );
  const depTotalPages = Math.max(
    1,
    Math.ceil((departures?.length || 0) / rowsCount),
  );

  // Refs to hold latest page values for scheduling logic (avoid stale closures)
  const arrPageRef = useRef(arrPage);
  const depPageRef = useRef(depPage);

  // Keep refs in sync when external code updates pages
  useEffect(() => {
    arrPageRef.current = arrPage;
  }, [arrPage]);
  useEffect(() => {
    depPageRef.current = depPage;
  }, [depPage]);

  useEffect(() => {
    if (arrPage >= arrTotalPages) setArrPage(0);
  }, [arrTotalPages, arrPage]);

  useEffect(() => {
    if (depPage >= depTotalPages) setDepPage(0);
  }, [depTotalPages, depPage]);

  // no per-page filter; nothing to reset

  // Separate rotation timers for arrivals and departures so they don't stay
  // in lockstep when their page counts differ.
  useEffect(() => {
    if (!autoRotatePages) return;

    // If other-pages interval is 0, lock arrivals to first page only
    if (otherPagesIntervalSec === 0) {
      setArrPage(0);
      return;
    }

    if (arrTotalPages <= 1) return;

    let timeoutIdRef: { id: number | null } = { id: null };
    let cancelled = false;

    const clearExisting = () => {
      if (timeoutIdRef.id != null) {
        clearTimeout(timeoutIdRef.id);
        timeoutIdRef.id = null;
      }
    };

    const schedule = (nextPage: number) => {
      clearExisting();
      if (cancelled) return;
      const delay = nextPage === 0 ? firstPageDurationSec : otherPagesIntervalSec;
      timeoutIdRef.id = window.setTimeout(tick, Math.max(0, delay) * 1000);
    };

    const tick = () => {
      if (cancelled) return;
      const current = arrPageRef.current;
      const next = arrTotalPages > 1 ? (current + 1) % arrTotalPages : 0;
      arrPageRef.current = next;
      setArrPage(next);
      schedule(next);
    };

    // initial schedule
    schedule(arrPageRef.current === 0 ? 0 : arrPageRef.current);

    return () => {
      cancelled = true;
      clearExisting();
    };
  }, [autoRotatePages, firstPageDurationSec, otherPagesIntervalSec, arrTotalPages]);

  useEffect(() => {
    if (!autoRotatePages) return;

    // If other-pages interval is 0, lock departures to first page only
    if (otherPagesIntervalSec === 0) {
      setDepPage(0);
      return;
    }

    if (depTotalPages <= 1) return;

    let timeoutIdRef: { id: number | null } = { id: null };
    let cancelled = false;

    const clearExisting = () => {
      if (timeoutIdRef.id != null) {
        clearTimeout(timeoutIdRef.id);
        timeoutIdRef.id = null;
      }
    };

    const schedule = (nextPage: number) => {
      clearExisting();
      if (cancelled) return;
      const delay = nextPage === 0 ? firstPageDurationSec : otherPagesIntervalSec;
      timeoutIdRef.id = window.setTimeout(tick, Math.max(0, delay) * 1000);
    };

    const tick = () => {
      if (cancelled) return;
      const current = depPageRef.current;
      const next = depTotalPages > 1 ? (current + 1) % depTotalPages : 0;
      depPageRef.current = next;
      setDepPage(next);
      schedule(next);
    };

    // initial schedule
    schedule(depPageRef.current === 0 ? 0 : depPageRef.current);

    return () => {
      cancelled = true;
      clearExisting();
    };
  }, [autoRotatePages, firstPageDurationSec, otherPagesIntervalSec, depTotalPages]);

  // Current time rendering moved to `CurrentTime` component.

  function formatByMode(d: Date | null): string {
    if (!d) return "—";
    const rd = roundToNearest5(d);
    try {
      if (timeMode === "Zulu")
        return rd.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        });
      if (timeMode === "Airport" && airportTz)
        return rd.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: airportTz,
        });
      return rd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "—";
    }
  }

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

  if (error)
    return (
      <>
        {headerEl}
        <div>Error loading data: {error}</div>
      </>
    );
  if (loadingAirports)
    return (
      <>
        {headerEl}
        <div>Loading airports...</div>
      </>
    );
  if (loadingData)
    return (
      <>
        {headerEl}
        <div>Loading flights...</div>
      </>
    );

  return (
    <>
      {headerEl}
      <div style={{ padding: "0.01rem", paddingBottom: "4rem" }}>
        <section style={{ marginTop: "1rem" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "auto",
              display: "inline-table",
            }}
          >
            <thead>
              <tr>
                <th colSpan={5} style={{ padding: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Arrivals</h3>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <div
                        style={{
                          paddingRight: 8,
                          color: "#ccf",
                          fontSize: "0.9rem",
                        }}
                        aria-hidden
                      >
                        {Array.from({ length: arrTotalPages }).map((_, i) => (
                          <span key={i} style={{ marginLeft: i === 0 ? 0 : 6 }}>
                            {i === arrPage ? "⬤" : "⭘"}
                          </span>
                        ))}
                      </div>
                      <div>
                        <CurrentTime
                          timeMode={timeMode}
                          airportTz={airportTz}
                          length={TICKER_WIDTHS.localTime}
                        />
                      </div>
                    </div>
                  </div>
                </th>
              </tr>
              <tr>
                <th>Time</th>
                <th>Flight</th>
                <th>Origin</th>
                <th>State</th>
                <th>Delay</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowsCount }).map((_, idx) => {
                const pageStart = arrPage * rowsCount;
                const item = arrivals[pageStart + idx];
                if (item) {
                  const {
                    callsignSplit,
                    originLabel,
                    state,
                    delayText,
                    expected,
                    time,
                  } = item;
                  const displayState =
                    expected && state === "Enroute"
                      ? `Est ${formatByMode(expected)}`
                      : state || "";
                  return (
                    <tr key={`row-arr-${idx}`}>
                      <td>
                        <BoardBlock
                          text={formatByMode(time)}
                          length={TICKER_WIDTHS.localTime}
                        />
                      </td>
                      <td>
                        <BoardBlock
                          text={callsignSplit}
                          length={TICKER_WIDTHS.callsign}
                        />
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
                          text={delayText || ""}
                          length={TICKER_WIDTHS.delay}
                        />
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={`row-arr-${idx}`}>
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
          <table
            style={{
              borderCollapse: "collapse",
              width: "auto",
              display: "inline-table",
            }}
          >
            <thead>
              <tr>
                <th colSpan={5} style={{ padding: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Departures</h3>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <div
                        style={{
                          paddingRight: 8,
                          color: "#ccf",
                          fontSize: "0.9rem",
                        }}
                        aria-hidden
                      >
                        {Array.from({ length: depTotalPages }).map((_, i) => (
                          <span key={i} style={{ marginLeft: i === 0 ? 0 : 6 }}>
                            {i === depPage ? "⬤" : "⭘"}
                          </span>
                        ))}
                      </div>
                      <div>
                        <CurrentTime
                          timeMode={timeMode}
                          airportTz={airportTz}
                          length={TICKER_WIDTHS.localTime}
                        />
                      </div>
                    </div>
                  </div>
                </th>
              </tr>
              <tr>
                <th>Time</th>
                <th>Flight</th>
                <th>Destination</th>
                <th>State</th>
                <th>Delay</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowsCount }).map((_, idx) => {
                const pageStart = depPage * rowsCount;
                const item = departures[pageStart + idx];
                if (item) {
                  const {
                    callsignSplit,
                    destLabel,
                    state,
                    delayText,
                    expected,
                    time,
                  } = item;
                  const displayState =
                    expected && (state === "Enroute" || state === "Departed")
                      ? `Departed`
                      : state || "";
                  return (
                    <tr key={`row-dep-${idx}`}>
                      <td>
                        <BoardBlock
                          text={formatByMode(time)}
                          length={TICKER_WIDTHS.localTime}
                        />
                      </td>
                      <td>
                        <BoardBlock
                          text={callsignSplit}
                          length={TICKER_WIDTHS.callsign}
                        />
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
                  <tr key={`row-dep-${idx}`}>
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
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "0.75rem 1rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            flexWrap: "wrap",
            background: "var(--bg)",
            color: "var(--text)",
            zIndex: 1000,
            boxShadow: "0 -2px 6px rgba(0,0,0,0.05)",
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
            <span>Zobrazit vzdálené odlety</span>
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>Čas:</span>
            <select
              value={timeMode}
              onChange={(e) => setTimeMode(e.target.value as any)}
              style={{ width: "5rem" }}
            >
              <option value="Airport">Airport</option>
              <option value="User">User</option>
              <option value="Zulu">Zulu</option>
            </select>
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <input
              type="checkbox"
              checked={autoRotatePages}
              onChange={(e) => setAutoRotatePages(e.target.checked)}
            />
            <span>Stránkování</span>
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>Interval (s):</span>
            <input
              type="number"
              min={5}
              value={firstPageDurationSec}
              onChange={(e) => {
                const v = parseInt(e.target.value || "15", 10);
                setFirstPageDurationSec(isNaN(v) ? 15 : Math.max(0, v));
              }}
              style={{ width: "2rem" }}
            />
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>/</span>
            <input
              type="number"
              min={5}
              value={otherPagesIntervalSec}
              onChange={(e) => {
                const v = parseInt(e.target.value || "15", 10);
                setOtherPagesIntervalSec(isNaN(v) ? 15 : Math.max(0, v));
              }}
              style={{ width: "2rem" }}
            />
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
                const v = parseInt(e.target.value || "7", 10);
                setRowsCount(isNaN(v) ? 7 : Math.max(1, v));
              }}
              style={{ width: "2rem" }}
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
    </>
  );
};

export default AirportBoardComponent;
