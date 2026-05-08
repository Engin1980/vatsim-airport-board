# VATSIM Airport Board — co to je

  VATSIM Airport Board je jednoduchá webová tabule sloužící k přehledu příletů a odletů pro vybrané letiště. Je navržena tak, aby se dala spustit lokálně i nasadit jako malá veřejná stránka — hlavní zaměření je na čitelné zobrazení letů, jednoduché stránkování a možnost přepínat zdroje dat.

  Pro koho je to užitečné
  - Pro provozovatele virtuálních letišť, kteří chtějí rychlou nástěnku s přehledem aktuálních letů.
  - Pro streamery / pozorovatele provozu, kteří chtějí zobrazit tabuli na druhém monitoru nebo do streamu.

  Co umí (rychlý přehled)
  - Zobrazuje dvě oddělené tabule: přílety (Arrivals) a odlety (Departures).
  - Podporuje stránkování řádků s automatickým otáčením stránek.
  - Každá tabule má vlastní rotaci — interval pro první stránku a interval pro ostatní stránky lze nastavit.
  - Možnost zobrazit „vzdálené“ odlety a měnit počet řádků na stránku.

## Vyzkoušení

Aplikace je dostupná na [https://vatsim-airport-board-dusky.vercel.app](https://vatsim-airport-board-dusky.vercel.app/#/airport/BIIS).

## Vlastní lokální instalace
  
  Jak začít (rychle)
  1) Nainstalujte závislosti:

  ```bash
  npm install
  ```

  2) Spusťte vývojový server a otevřete prohlížeč na `http://localhost:5173`:

  ```bash
  npm run dev
  ```

  3) Do produkce sestavíte pomocí:

  ```bash
  npm run build
  npm run preview
  ```

## Popis použití

  Jak aplikaci používat
  - Na úvodní stránce vyberte letiště (ICAO) ze seznamu.
  - Na stránce tabule můžete pomocí ovládacích prvků v dolním panelu upravit: počet řádků, zapnout/vypnout rotaci stránek, nastavit délku zobrazení první stránky a délku pro ostatní stránky, a zobrazit vzdálené odlety.
  - Nastavení jsou ukládána do `localStorage` pro každý vybraný ICAO zvlášť.

  Kde jsou data
  - Seznam letišť: `public/data/airports.csv` (aplikace jej načítá při startu a převádí na mapu ICAO → airport).
  - Volitelný zdroj reálných dat: VATSIM v3 feed (služba je připravená v `src/services/vatsimService.ts`).

  ## Přispívání
  - Najdete-li chybu nebo chcete funkci, otevřete issue nebo PR s popisem změny.

  ## Krátce o technologii
  Technické detaily nejsou nutné pro uživatele tabule, ale v projektu najdete běžné webové technologie: React + TypeScript a build přes Vite. Hlavní části aplikace jsou v `src/pages/AirportBoard` (UI tabule) a `src/services` (data loader).

  ## Poznámky
  - Projekt nemá v repozitáři explicitní `LICENSE` — přidejte, pokud chcete projekt publikovat pod konkrétní licencí.

  - Soubor s interními instrukcemi (vývoj): viz `./.github/copilot-instructions.md`.
