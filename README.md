# OraOra Rail – Train Timetable Visualizer

Visualizza le tratte e gli orari dei **treni regionali Trenitalia in Sardegna**.

Il progetto è stato sviluppato per il corso di Automated Planning A.A. 2024/2025.

---

## Contenuto del repo

| Cartella / File | Descrizione                                                                                |
| --------------- | ------------------------------------------------------------------------------------------ |
| `resources/`          | File TXT GTFS originali (feed Trenitalia)                                            |
| `preprocess.py` | Script di pre‑processing: converte i TXT in una serie di JSON ottimizzati per il front‑end |
| `out/`          | JSON generati (routes, stops, trips, shapes, calendar…)                                    |
| `modules/`      | Front‑end modulare (Leaflet + vis‑timeline)                                                |
| `index.html`    | Entry‑point single‑page con mappa, timeline e dashboard                                    |
| `styles.css`    | Stili per la UI                                                                            |

---

## Setup rapido

```bash
# 1. Clona il progetto
$ git clone <repo-url>
$ cd oraora-rail

# 2. (Opzionale) Crea un venv
$ python -m venv venv && source venv/bin/activate

# 3. Installa dipendenze
$ pip install -r requirements.txt

# 4. Genera i JSON a partire dai feed GTFS
$ python preprocess.py resources out

# 5. Avvia un server statico (ad esempio)
$ python -m http.server 8000
```
