import { useEffect, useState } from "react";
import "./App.css";
import { loadAirports } from "./services/airportService";
import type { Airport } from "./models/airport";
import AirportSelect from "./pages/AirportSelect/AirportSelect";
import AirportBoard from "./pages/AirportBoard/AirportBoard";

function getRoute() {
  const h = location.hash || "";
  if (!h) return { name: "home" };
  const m = h.match(/^#\/airport\/(.+)$/);
  if (m) return { name: "airport", icao: decodeURIComponent(m[1]) };
  return { name: "home" };
}

function App() {
  const [airports, setAirports] = useState<Map<string, Airport> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    loadAirports()
      .then(setAirports)
      .catch((err) => {
        console.error("Failed to load airports", err);
        setError(String(err));
      });
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>
          {(() => {
            if (route.name === "airport" && route.icao && airports) {
              const a = airports.get(route.icao.toUpperCase());
              let name = a?.name;
              if (name && name.endsWith(" Airport"))
                name = name.slice(0, -" Airport".length);
              return name ? (
                <>
                  {route.icao.toUpperCase()} - {name}
                </>
              ) : (
                <>{route.icao.toUpperCase()}</>
              );
            }
          })()}
          <span style={{ marginLeft: 8, color: "#666", fontSize: "0.95rem" }}>
            VATSIM Airport Board
          </span>
        </h1>        
      </header>

      {error && <div className="error">Error loading airports: {error}</div>}

      <main>
        {route.name === "home" && <AirportSelect airports={airports} />}
        {route.name === "airport" && route.icao && (
          <AirportBoard icao={route.icao} />
        )}
      </main>
    </div>
  );
}

export default App;
