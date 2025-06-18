const AnimationManager = {
    // Animation state
    currentAnimation: null,
    animationSpeed: 5,
    isAnimating: false,
    
    // Animation elements
    trainMarker: null,
    animationTimeout: null,

    // Initialize animation controls
    init() {
        // Speed slider
        const speedSlider = document.getElementById('speedSlider');
        const speedValue = document.getElementById('speedValue');
        
        speedSlider.addEventListener('input', (e) => {
            this.animationSpeed = parseInt(e.target.value);
            speedValue.textContent = this.animationSpeed + 'x';
        });

        // Stop button
        document.getElementById('stopAnimation').addEventListener('click', () => {
            this.stopAnimation();
        });

        Utils.log('Controlli animazione inizializzati');
    },

    // Animate specific trip
    animateTrip(tripId) {
        const trip = DataManager.getTrip(tripId);
        if (!trip) {
            Utils.error('Trip non trovato:', tripId);
            return;
        }

        // Stop any current animation
        this.stopAnimation();

        // Get shape coordinates
        const shapeCoords = DataManager.getShape(trip.shape_id);
        if (!shapeCoords || shapeCoords.length === 0) {
            alert('⚠️ Percorso non disponibile per questo viaggio');
            return;
        }

        Utils.log(`Avvio animazione viaggio ${tripId}`, {
            shape: trip.shape_id,
            points: shapeCoords.length
        });

        // Show animation controls
        document.getElementById('animationControls').style.display = 'block';
        UIManager.updateStatus('Simulazione Attiva');

        // Create train marker
        this.trainMarker = MapManager.addTrainMarker(shapeCoords[0]);
        this.bindTrainPopup(trip);

        // Start animation
        this.isAnimating = true;
        this.animateAlongPath(shapeCoords, trip);
    },

    // Animate along path
    animateAlongPath(coordinates, trip) {
        let currentIndex = 0;
        const totalPoints = coordinates.length;
        const progressDiv = document.getElementById('animationProgress');
        const progressBar = document.getElementById('progressBar');

        const animate = () => {
            if (!this.isAnimating) return;

            if (currentIndex >= totalPoints - 1) {
                // Animation complete
                this.onAnimationComplete();
                return;
            }

            // Update train position
            if (this.trainMarker) {
                this.trainMarker.setLatLng(coordinates[currentIndex]);
            }

            // Update progress
            const progress = Math.round((currentIndex / totalPoints) * 100);
            const destination = DataManager.getStop(UIManager.selectedDestination);
            progressDiv.textContent = `🚂 Verso ${destination?.name || 'destinazione'} - ${progress}%`;
            progressBar.style.width = progress + '%';

            // Pan map periodically
            if (currentIndex % 20 === 0) {
                MapManager.panTo(coordinates[currentIndex]);
            }

            currentIndex++;
            
            // Calculate delay based on speed
            const delay = 150 / this.animationSpeed;
            this.animationTimeout = setTimeout(animate, delay);
        };

        animate();
    },

    // Stop animation
    stopAnimation() {
        this.isAnimating = false;
        
        if (this.animationTimeout) {
            clearTimeout(this.animationTimeout);
            this.animationTimeout = null;
        }

        // Hide controls
        document.getElementById('animationControls').style.display = 'none';
        document.getElementById('progressBar').style.width = '0%';

        // Clear train
        MapManager.trainLayer.clearLayers();
        this.trainMarker = null;

        UIManager.updateStatus('Simulazione Fermata');
    },

    // Animation complete
    onAnimationComplete() {
        const destination = DataManager.getStop(UIManager.selectedDestination);
        const progressDiv = document.getElementById('animationProgress');
        const progressBar = document.getElementById('progressBar');

        Utils.log('Animazione completata');
        
        UIManager.updateStatus('Arrivo Completato');
        progressDiv.textContent = `🎯 Treno arrivato a ${destination?.name || 'destinazione'}!`;
        progressBar.style.width = '100%';

        // Auto-stop after 3 seconds
        setTimeout(() => {
            this.stopAnimation();
            UIManager.restoreStatus();
        }, 3000);
    },

    // Bind popup to train
    bindTrainPopup(trip) {
        if (!this.trainMarker) return;

        const origin = DataManager.getStop(UIManager.selectedOrigin);
        const destination = DataManager.getStop(UIManager.selectedDestination);

        const popupContent = `
            <div class="custom-tooltip">
                <div class="tooltip-title">🚂 Treno in Movimento</div>
                <div class="tooltip-info"><strong>Da:</strong> ${origin?.name || '-'}</div>
                <div class="tooltip-info"><strong>A:</strong> ${destination?.name || '-'}</div>
                <div class="tooltip-info"><strong>Partenza:</strong> ${trip.departure}</div>
                <div class="tooltip-info"><strong>Arrivo:</strong> ${trip.arrival}</div>
                <div class="tooltip-info"><strong>Durata:</strong> ${trip.duration_minutes} min</div>
            </div>
        `;

        this.trainMarker.bindPopup(popupContent);
        this.trainMarker.openPopup();
    }
};