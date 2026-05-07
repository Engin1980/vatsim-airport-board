import useAirportBoard from "../../hooks/useAirportBoard";
import BoardBlock from "./BoardBlock";
import { formatTime } from "../../utils/flightTime";
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
    rowsCount,
    setRowsCount,
    showAllDepartures,
    setShowAllDepartures,
    lastFetchAttempt,
    lastDataTimestamp,
  } = useAirportBoard(icao);

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
              <th>Time</th>
              <th>Flight</th>
              <th>Origin</th>
              <th>State</th>
              <th>Delay</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowsCount }).map((_, idx) => {
              const item = arrivals[idx];
              if (item) {
                const {
                  local,
                  callsignSplit,
                  originLabel,
                  state,
                  delayText,
                  expected,
                } = item;
                const displayState =
                  expected && state === "Enroute"
                    ? `Est ${formatTime(roundToNearest5(expected))}`
                    : state || "";
                return (
                  <tr key={`row-arr-${idx}`}>
                    <td>
                      <BoardBlock
                        text={local}
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
              <th>Time</th>
              <th>Flight</th>
              <th>Destination</th>
              <th>State</th>
              <th>Delay</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowsCount }).map((_, idx) => {
              const item = departures[idx];
              if (item) {
                const {
                  local,
                  callsignSplit,
                  destLabel,
                  state,
                  delayText,
                  expected,
                } = item;
                const displayState =
                  expected && (state === "Enroute" || state === "Departed")
                    ? `Departed`
                    : state || "";
                return (
                  <tr key={`row-dep-${idx}`}>
                    <td>
                      <BoardBlock
                        text={local}
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
