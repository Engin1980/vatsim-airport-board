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

  const [arrPage, setArrPage] = useState(0);
  const [depPage, setDepPage] = useState(0);
  const [autoRotatePages, setAutoRotatePages] = useState(true);
  const [rotateIntervalSec, setRotateIntervalSec] = useState<number>(15);

  // header is rendered inside table thead so it lines up naturally

  const prevRowsCountArrRef = useRef<number>(rowsCount);
  const prevRowsCountDepRef = useRef<number>(rowsCount);

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

  useEffect(() => {
    if (arrPage >= arrTotalPages) setArrPage(0);
  }, [arrTotalPages, arrPage]);

  useEffect(() => {
    if (depPage >= depTotalPages) setDepPage(0);
  }, [depTotalPages, depPage]);

  useEffect(() => {
    // If interval is 0, keep both tables fixed to the first page
    if (rotateIntervalSec === 0) {
      setArrPage(0);
      setDepPage(0);
      return;
    }
    if (!autoRotatePages) return;
    const id = setInterval(() => {
      setArrPage((p) => (arrTotalPages > 1 ? (p + 1) % arrTotalPages : 0));
      setDepPage((p) => (depTotalPages > 1 ? (p + 1) % depTotalPages : 0));
    }, rotateIntervalSec * 1000);
    return () => clearInterval(id);
  }, [autoRotatePages, rotateIntervalSec, arrTotalPages, depTotalPages]);

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

  if (error) return <div>Error loading data: {error}</div>;
  if (loadingAirports) return <div>Loading airports...</div>;
  if (loadingData) return <div>Loading flights...</div>;

  return (
    <div style={{ padding: "0.01rem" }}>
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
            style={{ width: "8rem" }}
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
          <span>Auto-stránkování</span>
        </label>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>Interval strany (s):</span>
          <input
            type="number"
            min={0}
            value={rotateIntervalSec}
            onChange={(e) => {
              const v = parseInt(e.target.value || "30", 10);
              setRotateIntervalSec(isNaN(v) ? 30 : Math.max(0, v));
            }}
            style={{ width: "4rem" }}
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
