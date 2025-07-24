const Utils = {
    // Format date from YYYYMMDD to DD/MM/YYYY
    formatDate(dateString) {
        if (!dateString || dateString.length !== 8) return '-';
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        return `${day}/${month}/${year}`;
    },

    // Format date for timeline (YYYY-MM-DD)
    formatDateForTimeline(dateString) {
        if (!dateString || dateString.length !== 8) return null;
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        return `${year}-${month}-${day}`;
    },

    // Parse HH:MM:SS in minuti
    timeToMinutes(timeString) {
        if (!timeString) return 0;
        const [h, m, s] = timeString.split(':').map(Number);
        return h * 60 + m + (s || 0) / 60;
    },

    // Aggiunge minuti a una data (Date) e ritorna nuova Date
    addMinutesToDate(date, minutes) {
        return new Date(date.getTime() + minutes * 60000);
    },

    // Format Date -> HH:MM:SS
    formatTime(date) {
        if (!date) return '-';
        return date.toTimeString().split(' ')[0];
    },

    // Format minuti -> "Hh MMmin"
    formatDuration(minutes) {
        if (minutes == null) return '-';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0) return `${h}h ${m}min`;
        return `${m}min`;
    },

    // Estrarre solo HH:MM da HH:MM:SS
    hhmm(timeString) {
        if (!timeString) return '-';
        const parts = timeString.split(':');
        return `${parts[0]}:${parts[1]}`;
    },

    // Show/hide loading screen
    showLoading(show) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = show ? 'flex' : 'none';
            loadingEl.style.opacity = show ? '1' : '0';
        }
    },

    // Show error toast
    error(...args) {
        console.error('[ERR]', ...args);
        const el = document.getElementById('errorToast');
        if (el) {
            el.textContent = args.join(' ');
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', 5000);
        }
    },

    // Simple log
    log(...args) {
        console.log('[LOG]', ...args);
    }
};

// === GEO helpers ===
Utils.haversine = function(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Ritorna l'indice del punto della shape più vicino a (lat, lon)
 */
Utils.nearestIndexOnShape = function(shape, lat, lon) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < shape.length; i++) {
    const p = shape[i];
    const plat = Array.isArray(p) ? +p[0] : +p.lat;
    const plon = Array.isArray(p) ? +p[1] : +(p.lon ?? p.lng);
    const d = Utils.haversine(lat, lon, plat, plon);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
};

Utils.getModeColor = mode => (mode === 'bus' ? '#FF9800' : '#DA1D2A');
Utils.createBusIcon = () => L.divIcon({ html: '🚌', className: 'bus-icon', iconSize: [24,24], iconAnchor: [12,12] });
Utils.createTrainIcon = () => L.divIcon({ html: '🚆', className: 'train-icon', iconSize: [24,24], iconAnchor: [12,12] });

/* === AGGIUNTE === */

// Normalizza un punto (array o oggetto {lat, lon|lng}) in [lat, lon]
Utils.pointToArray = function(p) {
  if (Array.isArray(p)) return [ +p[0], +p[1] ];
  return [ +p.lat, +(p.lon ?? p.lng) ];
};

/**
 * Indice più vicino MA vincolato al range [start, end]
 */
Utils.nearestIndexOnShapeInRange = function(shape, lat, lon, start, end) {
  let best = start, bestD = Infinity;
  for (let i = start; i <= end; i++) {
    const [plat, plon] = Utils.pointToArray(shape[i]);
    const d = Utils.haversine(lat, lon, plat, plon);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
};

/**
 * NUOVA FUNZIONE: Crea un marker di cambio personalizzato
 */
Utils.createChangeMarkerIcon = function() {
  return L.divIcon({
    html: '<div style="background: #3182CE; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; border: 3px solid #2C5282; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">CAMBIO</div>',
    className: 'change-marker-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
};

/**
 * NUOVA FUNZIONE: Crea un marker di partenza personalizzato
 */
Utils.createStartMarkerIcon = function() {
  return L.divIcon({
    html: '<div style="background: #48BB78; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 3px solid #2F855A; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚀</div>',
    className: 'start-marker-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

/**
 * NUOVA FUNZIONE: Crea un marker di arrivo personalizzato
 */
Utils.createEndMarkerIcon = function() {
  return L.divIcon({
    html: '<div style="background: #F56565; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 3px solid #C53030; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🎯</div>',
    className: 'end-marker-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

/**
 * NUOVA FUNZIONE: Verifica se due coordinate sono sufficientemente vicine
 */
Utils.areCoordinatesClose = function(lat1, lon1, lat2, lon2, thresholdMeters = 100) {
  const distance = Utils.haversine(lat1, lon1, lat2, lon2);
  return distance <= thresholdMeters;
};

/**
 * NUOVA FUNZIONE: Ottimizza un array di coordinate rimuovendo punti troppo vicini
 */
Utils.optimizeCoordinates = function(coords, minDistanceMeters = 10) {
  if (!coords || coords.length <= 2) return coords;
  
  const optimized = [coords[0]]; // Mantieni sempre il primo punto
  
  for (let i = 1; i < coords.length - 1; i++) {
    const current = Utils.pointToArray(coords[i]);
    const last = Utils.pointToArray(optimized[optimized.length - 1]);
    
    const distance = Utils.haversine(last[0], last[1], current[0], current[1]);
    
    if (distance >= minDistanceMeters) {
      optimized.push(coords[i]);
    }
  }
  
  // Mantieni sempre l'ultimo punto
  if (coords.length > 1) {
    optimized.push(coords[coords.length - 1]);
  }
  
  return optimized;
};