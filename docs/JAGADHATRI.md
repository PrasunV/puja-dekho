# Jagadhatri Puja Dekho (v0.1)

Live at `https://puja-dekho.vercel.app/jagadhatripuja`. `/jagadhatri` and `/Jagadhatri` redirect there. The Durga app at `/` is unchanged.

## Where things are

| Part          | Files                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page          | `jagadhatripuja/index.html` (title, link preview), `src/jagadhatri/` (app), `src/jagadhatri/jg.css` (styles on top of the Durga `styles.css`)            |
| Copy you edit | `src/jagadhatri/config.js`: popular order, What's new items, About text, radius steps                                                                    |
| Data          | `data-src/jagadhatri/Jagadhatri_Puja_List.xlsx` → `scripts/build-jagadhatri.py` → `public/jagadhatripuja/data/pujas.json`                                |
| Counters      | `/api/jagadhatri/visits` and `/api/jagadhatri/live` (`api/jagadhatri/*.js`), tables `jg_visit_counter` and `jg_live_presence` in the same Turso database |
| Offline       | `public/jagadhatripuja-sw.js`, scope `/jagadhatripuja`. The Durga worker (`public/sw.js`, v4) skips `/jagadhatri…` paths                                 |
| Preview image | `public/jagadhatripuja/og.jpg` (1200 × 630)                                                                                                              |

## Fixing data (takes a few minutes)

1. Edit `data-src/jagadhatri/Jagadhatri_Puja_List.xlsx`, sheet **Pujas** (stations and ghats are on sheet **Entry points**).
2. Run `python scripts/build-jagadhatri.py` (first time only: `pip install openpyxl`). If something is wrong it names the row and writes nothing.
3. Commit and push. Vercel deploys in a minute or two; people get the new data the next time they open the app.

Rules: every puja has an `id` that never changes after launch, even if the name changes. For a new row, leave `id` empty and run the script; it suggests one to paste in. Fill **Puja Theme** and **Artist** to replace "Not updated yet".

## Tests

`npm test` covers the data (207 pujas, unique ids), search spellings and typos, the radius list and the separate Jagadhatri counter.
