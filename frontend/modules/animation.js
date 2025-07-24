const AnimationManager = {
    // State
    animationSpeed: 1,
    isAnimating: false,
    animationTimeout: null,

    // Map things
    trainMarker: null,   // usato anche per il bus (vehicleMarker)
    currentLegIndex: 0,
    playingLegs: [],

    init() {
        const speedSlider = document.getElementById('speedSlider');
        const speedValue = document.getElementById('speedValue');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.animationSpeed = parseInt(e.target.value);
                speedValue.textContent = this.animationSpeed + 'x';
            });
        }

        const stopBtn = document.getElementById('stopAnimation');
        stopBtn?.addEventListener('click', () => this.stopAnimation());

        Utils.log('Controlli animazione inizializzati');
    },

    /* ------------------------------------------------------------------
     *  SIMULAZIONE PIANO MULTI-LEG (planner)
     * ----------------------------------------------------------------*/
    animatePlan(legs) {
        if (!legs || !legs.length) return;
        this.stopAnimation();

        this.playingLegs = legs;
        this.currentLegIndex = 0;

        const ctrl = document.getElementById('animationControls');
        if (ctrl) ctrl.style.display = 'block';
        UIManager.updateStatus?.('Simulazione Attiva');

        const playNext = () => {
            if (this.currentLegIndex >= this.playingLegs.length) {
                this.onPlanComplete();
                return;
            }
            const leg = this.playingLegs[this.currentLegIndex];
            const isBus = leg.mode === 'bus';
            let coords = null;

            if (leg.trip_id) {
                const originId = leg.segments?.[0]?.from_stop?.id;
                const destId   = leg.segments?.[leg.segments.length - 1]?.to_stop?.id;
                coords = DataManager.getPolylineForTripSegment(leg.trip_id, originId, destId);
            }
            if (!coords && leg.segments?.length) {
                // fallback "grezzo": solo le coordinate delle fermate
                coords = leg.segments.map(s => {
                    const st = DataManager.getStop(s.from_stop.id);
                    return st ? [st.lat, st.lon] : null;
                }).filter(Boolean);
                const lastStop = DataManager.getStop(leg.segments[leg.segments.length - 1].to_stop.id);
                if (lastStop) coords.push([lastStop.lat, lastStop.lon]);
            }

            if (!coords || coords.length < 2) {
                Utils.log('Leg senza shape utile, salto', leg);
                this.currentLegIndex++;
                playNext();
                return;
            }

            this.trainMarker = MapManager.addVehicleMarker(isBus ? 'bus' : 'train', coords[0]);
            this.bindVehiclePopup({
                departure: leg.departure, arrival: leg.arrival,
                duration_minutes: leg.duration
            }, leg);

            this.isAnimating = true;
            this.animateAlongPath(coords, null, () => {
                this.currentLegIndex++;
                playNext();
            }, leg);
        };

        playNext();
    },

    onPlanComplete() {
        const progressDiv = document.getElementById('animationProgress');
        const progressBar = document.getElementById('progressBar');

        Utils.log('Simulazione piano completata');
        UIManager.updateStatus?.('Arrivo Completato');
        if (progressDiv) progressDiv.textContent = `🎯 Piano completato!`;
        if (progressBar) progressBar.style.width = '100%';

        setTimeout(() => {
            this.stopAnimation();
            UIManager.restoreStatus?.();
        }, 2500);
    },

    /* ------------------------------------------------------------------
     *  SIMULAZIONE SINGOLO TRIP (vista normale)
     * ----------------------------------------------------------------*/
    animateTrip(tripId) {
        const trip = DataManager.getTrip(tripId);
        if (!trip) {
            Utils.error('Trip non trovato:', tripId);
            return;
        }

        this.stopAnimation();

        const origin = UIManager.selectedOrigin;
        const dest   = UIManager.selectedDestination;

        const segmentShape = DataManager.getPolylineForTripSegment(tripId, origin, dest)
                            || DataManager.getShape(trip.shape_id);

        if (!segmentShape || segmentShape.length === 0) {
            alert('⚠️ Percorso non disponibile per questo viaggio');
            return;
        }

        const ctrl = document.getElementById('animationControls');
        if (ctrl) ctrl.style.display = 'block';
        UIManager.updateStatus?.('Simulazione Attiva');

        this.trainMarker = MapManager.addVehicleMarker('train', segmentShape[0]);
        this.bindVehiclePopup(trip);

        this.isAnimating = true;
        this.animateAlongPath(segmentShape, trip, () => {
            this.onAnimationComplete();
        });
    },

    /* ------------------------------------------------------------------
     *  SIMULAZIONE DI UN SEGMENTO DI TRIP (usato dal planner per "Simula solo questo")
     * ----------------------------------------------------------------*/
    animateTripSegment(tripId, originId, destinationId, mode = 'train', legInfo = null) {
        const trip = DataManager.getTrip(tripId);
        if (!trip) {
            Utils.error('Trip non trovato:', tripId);
            return;
        }

        this.stopAnimation();

        const coords = DataManager.getPolylineForTripSegment(tripId, originId, destinationId)
                    || DataManager.getShape(trip.shape_id);

        if (!coords || coords.length < 2) {
            alert('⚠️ Segmento non disponibile per questo viaggio');
            return;
        }

        const ctrl = document.getElementById('animationControls');
        if (ctrl) ctrl.style.display = 'block';
        UIManager.updateStatus?.('Simulazione Attiva');

        this.trainMarker = MapManager.addVehicleMarker(mode === 'bus' ? 'bus' : 'train', coords[0]);

        // costruisco una "leg" minimale per il popup
        const fromStop = DataManager.getStop(originId);
        const toStop   = DataManager.getStop(destinationId);
        const leg = legInfo || {
            mode,
            from_stop: { name: fromStop?.name || originId },
            to_stop  : { name: toStop?.name   || destinationId },
            departure: trip.departure,
            arrival  : trip.arrival,
            duration : trip.duration_minutes
        };

        this.bindVehiclePopup({
            departure: leg.departure, arrival: leg.arrival,
            duration_minutes: leg.duration
        }, leg);

        this.isAnimating = true;
        this.animateAlongPath(coords, null, () => {
            this.onAnimationComplete();
        }, leg);
    },

    /* ------------------------------------------------------------------
     *  CORE
     * ----------------------------------------------------------------*/
    animateAlongPath(coordinates, trip, onEnd, leg = null) {
    const coords = coordinates.map(p =>
        Array.isArray(p) ? [ +p[0], +p[1] ] : [ +p.lat, +(p.lon ?? p.lng) ]
    );

    let currentIndex = 0;
    const totalPoints = coords.length;
    const progressDiv = document.getElementById('animationProgress');
    const progressBar = document.getElementById('progressBar');

    const destName = leg?.to_stop?.name ||
                     DataManager.getStop(UIManager?.selectedDestination)?.name ||
                     'destinazione';

    const prefix = leg ? (leg.mode === 'bus' ? '🚌' : '🚂') : '🚂';

    const animate = () => {
        if (!this.isAnimating) return;
        
        // Muovi il marker alla posizione corrente
        if (this.trainMarker) {
            this.trainMarker.setLatLng(coords[currentIndex]);
        }

        // Aggiorna il progresso
        const progress = Math.round((currentIndex / (totalPoints - 1)) * 100);
        if (progressDiv) progressDiv.textContent = `${prefix} Verso ${destName} - ${progress}%`;
        if (progressBar) progressBar.style.width = progress + '%';

        // Pan della mappa ogni 20 punti
        if (currentIndex % 20 === 0) {
            MapManager.panTo(coords[currentIndex]);
        }

        MapManager.panTo(coords[currentIndex]);
        
        // Incrementa l'indice
        currentIndex++;
        
        // Controlla se abbiamo raggiunto la fine DOPO aver mosso il marker
        if (currentIndex >= totalPoints) {
            if (typeof onEnd === 'function') onEnd();
            return;
        }

        // Continua l'animazione
        const delay = 500 / this.animationSpeed;
        this.animationTimeout = setTimeout(animate, delay);
    };
    
    animate();
},

    stopAnimation() {
        this.isAnimating = false;
        if (this.animationTimeout) {
            clearTimeout(this.animationTimeout);
            this.animationTimeout = null;
        }

        const ctrl = document.getElementById('animationControls');
        if (ctrl) ctrl.style.display = 'none';
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = '0%';

        MapManager.trainLayer?.clearLayers();
        this.trainMarker = null;
        this.playingLegs = [];
        this.currentLegIndex = 0;

        UIManager.updateStatus?.('Simulazione Fermata');
    },

    onAnimationComplete() {
        const destination = DataManager.getStop(UIManager?.selectedDestination);
        const progressDiv = document.getElementById('animationProgress');
        const progressBar = document.getElementById('progressBar');

        Utils.log('Animazione completata');
        UIManager.updateStatus?.('Arrivo Completato');
        if (progressDiv) progressDiv.textContent = `🎯 Arrivato a ${destination?.name || 'destinazione'}!`;
        if (progressBar) progressBar.style.width = '100%';

        setTimeout(() => {
            this.stopAnimation();
            UIManager.restoreStatus?.();
        }, 3000);
    },

    bindVehiclePopup(trip, leg = null) {
        if (!this.trainMarker) return;

        const from = leg?.from_stop?.name || DataManager.getStop(UIManager?.selectedOrigin)?.name || '-';
        const to   = leg?.to_stop?.name   || DataManager.getStop(UIManager?.selectedDestination)?.name || '-';
        const dep  = trip?.departure || leg?.departure || '-';
        const arr  = trip?.arrival   || leg?.arrival   || '-';
        const dur  = trip?.duration_minutes || leg?.duration || '-';
        const mode = leg ? (leg.mode === 'bus' ? '🚌 Bus' : '🚆 Treno') : '🚂 Treno';

        const popupContent = `
            <div class="custom-tooltip">
                <div class="tooltip-title">${mode} in movimento</div>
                <div class="tooltip-info"><strong>Da:</strong> ${from}</div>
                <div class="tooltip-info"><strong>A:</strong> ${to}</div>
                <div class="tooltip-info"><strong>Partenza:</strong> ${dep}</div>
                <div class="tooltip-info"><strong>Arrivo:</strong> ${arr}</div>
                <div class="tooltip-info"><strong>Durata:</strong> ${dur} min</div>
            </div>
        `;

        this.trainMarker.bindPopup(popupContent);
        this.trainMarker.openPopup();
    }
};

window.AnimationManager = AnimationManager;