# OraOra Rail – Train Timetable Visualizer

Visualizza le tratte e gli orari dei **treni regionali Trenitalia in Sardegna**.

Il progetto è stato sviluppato per il corso di Automated Planning A.A. 2024/2025.

**N.B.** All'interno del repository è presente una descrizione dettagliata del progetto (cartella report&slide).

Slide del progetto: https://www.canva.com/design/DAGtcUNXruU/0y71xm8zI6AQPR09hPrg4g/edit?utm_content=DAGtcUNXruU&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton

---

## Architettura del Repository

```
oraora-rail/
├── backend/                   # Backend Flask
│   ├── app.py                 # Server principale e API
│   ├── gtfs_preprocess.py     # Preprocessing dati GTFS
│   ├── gtfs_repo.py           # Repository pattern per dati
│   ├── planner.py             # Planning per viaggi con cambi
│   ├── requirements.txt       # Dipendenze Python
│   ├── resources/             # Dati GTFS input
│   └── gtfs-out/              # Dati JSON processati
├── frontend/                  # Frontend JavaScript
│   ├── index.html             # Pagina principale
│   ├── styles.css             # Styling moderno
│   ├── app.js                 # Applicazione principale
│   └── modules/               # Moduli JavaScript
│       ├── data.js            # Gestione dati
│       ├── map.js             # Visualizzazione mappa
│       ├── timeline.js        # Timeline viaggi
│       ├── animation.js       # Animazioni treni
│       ├── ui.js              # Gestione interfaccia
│       ├── planning.js        # Pannello planning
│       └── utils.js           # Utilities
├── docker/                    # Configurazione Docker
│   ├── Dockerfile
│   ├── compose.yml
└── report&slide/              # Report e Slide del progetto
```

## Come avviare il progetto

### Opzione 1: Docker 

```bash
# 1. Avvia con Docker
cd docker/
docker compose up -d

# 2. Apri il browser
# http://localhost:5000
```

### Opzione 2: Installazione Locale

```bash
# 1. Setup Backend
cd backend/
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Avvia il server
python app.py

# 3. Apri il browser
# http://localhost:5000
```

## Come Usare il progetto

### 1. Visualizzazione Normale (linee dirette BUS - REG (treno))
1. **Seleziona una linea** dal menu
2. **Scegli stazione di partenza** e **destinazione**
3. **Seleziona data** e **orario di partenza**
4. **Clicca "Simula"** per vedere l'animazione del viaggio

### 2. Planning
1. **Clicca "Planning"** per aprire il pannello
2. **Imposta origine e destinazione** (qualsiasi stazione)
3. **Scegli data e orario** di partenza
4. **Seleziona ottimizzazione**: Tempo vs Numero cambi
5. **Calcola piano** per vedere itinerari multi-modali
6. **Simula tutto** o **singole tratte**

### 3. Controlli Animazione
- **Velocità**: Slider da 1x a 10x
- **Progress**: Barra di avanzamento in tempo reale
- **Stop**: Interrompi animazione in qualsiasi momento
