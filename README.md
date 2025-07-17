# OraOra Rail – Train Timetable Visualizer

Visualizza le tratte e gli orari dei **treni regionali Trenitalia in Sardegna**.

Il progetto è stato sviluppato per il corso di Automated Planning A.A. 2024/2025.

N.B. All'interno del repository è presente una descrizione dettagliata del progetto (**oraora_rail_train_timetable_visaulizer_ENG.pdf** - **oraora_rail_train_timetable_visaulizer_ITA.pdf**)

slide del progetto: https://www.canva.com/design/DAGtcUNXruU/0y71xm8zI6AQPR09hPrg4g/edit?utm_content=DAGtcUNXruU&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton
---
## Come avviare OraOra Rail

### Prerequisiti

- **Python 3.7+** (per il preprocessing dei dati GTFS)
- **Server web** (Python, Node.js, o qualsiasi server HTTP)
- **Browser moderno** (Chrome, Firefox, Safari, Edge)
- **Connessione internet** (per le mappe e le librerie CDN)

### 1. Preparazione

```bash
# Installa le dipendenze Python
pip install -r requirements.txt
```

### 2. Processa i dati GTFS

Scarica i dati GTFS e processali:

```bash
python preprocess_gtfs.py /path/to/gtfs/files ./out
```

Questo genererà i file JSON necessari nella cartella `out/`.

### 3. Avvia il server web

**Opzione A: Python (raccomandato)**
```bash
python -m http.server 8080
```

**Opzione B: Node.js**
```bash
npm install -g http-server
http-server -p 8080
```

**Opzione C: Live Server (VS Code)**
- Installa l'estensione "Live Server"
- Clicca destro su `index.html` → "Open with Live Server"

### 4. Apri l'applicazione

Vai su **http://localhost:8080** nel tuo browser.

## 📁 Struttura del progetto

```
oraora-rail/
├── 📄 index.html              # Pagina principale
├── 🎨 styles.css              # Stili CSS
├── ⚙️ app.js                  # Logica principale
├── 🖼️ favicon.ico             # Icona dell'app
├── 📦 requirements.txt        # Dipendenze Python
├── 🐍 preprocess_gtfs.py      # Script di preprocessing
├── 📚 modules/                # Moduli JavaScript
│   ├── utils.js               # Utilità generali
│   ├── data.js                # Gestione dati
│   ├── map.js                 # Gestione mappa
│   ├── timeline.js            # Timeline degli orari
│   ├── animation.js           # Animazioni treni
│   └── ui.js                  # Interfaccia utente
└── 📊 out/                    # Dati processati (generati)
    ├── routes.json
    ├── shapes.json
    ├── stops.json
    ├── timetable.json
    ├── calendar.json
    └── stats.json
```

## Come usare OraOra Rail

### Interfaccia principale

1. **Seleziona una linea** dal menu a tendina "Linea"
2. **Scegli l'origine** dalla lista delle stazioni di partenza
3. **Seleziona la destinazione** tra le stazioni disponibili
4. **Imposta la data** di viaggio
5. **Scegli l'orario** di partenza desiderato
6. **Clicca "Simula"** per avviare l'animazione

### Controlli animazione

- **Velocità**: Regola la velocità dell'animazione (1x - 10x)
- **Pausa/Play**: Ferma o riprendi l'animazione
- **Reset**: Torna alla configurazione iniziale

### Dashboard informativo

Il pannello di stato mostra:
- Informazioni sulla linea selezionata
- Stazioni di partenza e destinazione
- Orari di partenza e arrivo
- Durata del viaggio
- Numero di fermate
- Stato dell'animazione
