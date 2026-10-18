# PRD status

Built from "Durga Puja Map – MVP PRD". Queue reports, ratings, tour planner, nickname, check-ins and "Search this area" are hidden for the MVP; their code is kept (see `docs/v2-parked`, `src/features/tour`, `src/hooks/use{Live,Reports,Dwell}*`).

## Placeholders to replace

- `VITE_REPORT_FORM_URL` – the Report issue form.
- `VITE_ORS_KEY` – walking route preview (optional).
- `src/data/popular.js` – the Popular strip (currently the first 10 featured pujas).
- `src/data/crowd.js` – typical crowd by hour (PRD placeholder pattern plus per-puja overrides).

## Rules worth knowing

- The list holds all pujas, nearest first. The radius sets the header count, the Popular strip, the map zoom and the "Farther than X" divider.
- Choosing a metro station replaces the radius (pujas within 1 km of it).
- "You're near" needs 50 m accuracy, 100 m radius, 60 s dwell; clears beyond 150 m.
- Crowd is always worded "Usually X at this hour" and never shown in green/amber/red.
