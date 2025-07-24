const UIManager = {
    selectedRouteId: null,
    selectedOrigin: null,
    selectedDestination: null,
    selectedDate: null,
    selectedTime: null,
    selectedTrip: null,
    filteredTrips: [],


    init() {
        this.initRouteSelector();
        this.initEventListeners();
        Utils.log('UI inizializzata');
    },

    initRouteSelector() {
        const routeSelect = document.getElementById('routeSelect');
        routeSelect.innerHTML = '<option value="">Seleziona una linea...</option>';
        
        const routes = DataManager.getAllRoutes();
        routes.forEach(route => {
            const option = document.createElement('option');
            option.value = route.id;
            option.textContent = `${route.short} - ${route.long}`;
            routeSelect.appendChild(option);
        });
    },

    initEventListeners() {
        document.getElementById('routeSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectRoute(e.target.value);
            } else {
                this.resetAll();
            }
        });


        document.getElementById('originSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectOrigin(e.target.value);
            } else {
                this.resetFromOrigin();
            }
        });

        document.getElementById('destinationSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectDestination(e.target.value);
            } else {
                this.resetFromDestination();
            }
        });

        document.getElementById('dateSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectDate(e.target.value);
            } else {
                this.resetFromDate();
            }
        });

        document.getElementById('timeSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectTime(e.target.value);
            } else {
                this.selectedTrip = null;
                this.selectedTime = null;
                this.updatePlayButton();
            }
        });

        document.getElementById('playButton').addEventListener('click', () => {
            if (this.selectedTrip) {
                AnimationManager.animateTrip(this.selectedTrip);
            }
        });

        document.getElementById('resetButton').addEventListener('click', () => {
            this.resetAll();
        });
    },

    selectRoute(routeId) {
        Utils.log('Selezione linea:', routeId);
        
        this.selectedRouteId = routeId;
        AnimationManager.stopAnimation();
        
        this.resetFromOrigin();

        MapManager.clearLayers();
        this.populateOrigins();
        this.updateStatusPanel();
    },

    selectOrigin(originId) {
        Utils.log('Selezione partenza:', originId);
        
        this.selectedOrigin = originId;

        this.resetFromDestination();
        this.populateDestinations();
        this.updateStatusPanel();
    },

    selectDestination(destinationId) {
        Utils.log('Selezione destinazione:', destinationId);
        
        this.selectedDestination = destinationId;
        this.resetFromDate();
        this.populateDates();
        this.updateStatusPanel();
    },

    selectDate(date) {
        Utils.log('Selezione data:', date);
        
        this.selectedDate = date;

        this.resetFromTime();
        this.populateTimes();
        this.updateStatusPanel();
    },

    selectTime(tripId) {
        Utils.log('Selezione orario/viaggio:', tripId);
        
        this.selectedTrip = tripId;
        const trip = DataManager.getTrip(tripId);
        if (trip) {
            this.selectedTime = trip.departure;

            MapManager.drawRouteAndStations(
                this.selectedRouteId,
                this.filteredTrips, 
                this.selectedOrigin,
                this.selectedDestination
            );
            
            TimelineManager.updateForSingleTrip(tripId, this.selectedDate);
        }
        
        this.updateStatusPanel();
        this.updatePlayButton();
    },


    populateOrigins() {
        const originSelect = document.getElementById('originSelect');
        const origins = DataManager.getOriginsForRoute(this.selectedRouteId);
        
        originSelect.innerHTML = '<option value="">Seleziona stazione di partenza...</option>';
        origins.forEach(origin => {
            const option = document.createElement('option');
            option.value = origin.id;
            option.textContent = origin.name;
            originSelect.appendChild(option);
        });
        
        originSelect.disabled = false;
        Utils.log(`Trovate ${origins.length} stazioni di partenza`);
    },

    populateDestinations() {
        const destinationSelect = document.getElementById('destinationSelect');
        const destinations = DataManager.getDestinationsFromOrigin(
            this.selectedRouteId,
            this.selectedOrigin
        );
        
        destinationSelect.innerHTML = '<option value="">Seleziona destinazione...</option>';
        destinations.forEach(dest => {
            const option = document.createElement('option');
            option.value = dest.id;
            option.textContent = dest.name;
            destinationSelect.appendChild(option);
        });
        
        destinationSelect.disabled = false;
        Utils.log(`Trovate ${destinations.length} destinazioni`);
    },

    populateDates() {
        const dateSelect = document.getElementById('dateSelect');
        const dates = DataManager.getAvailableDates(
            this.selectedRouteId,
            this.selectedOrigin,
            this.selectedDestination
        );
        
        if (dates.length === 0) {
            dateSelect.innerHTML = '<option value="">Nessuna data disponibile</option>';
            dateSelect.disabled = true;
            return;
        }
        
        dateSelect.innerHTML = '<option value="">Seleziona una data...</option>';
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = Utils.formatDate(date);
            dateSelect.appendChild(option);
        });
        
        dateSelect.disabled = false;
        Utils.log(`Trovate ${dates.length} date disponibili`);
    },

    populateTimes() {
        const timeSelect = document.getElementById('timeSelect');
        const trips = DataManager.getTripsForCriteria(
            this.selectedRouteId,
            this.selectedOrigin,
            this.selectedDestination,
            this.selectedDate
        );
        
        this.filteredTrips = trips;
        
        if (trips.length === 0) {
            timeSelect.innerHTML = '<option value="">Nessun viaggio disponibile</option>';
            timeSelect.disabled = true;
            return;
        }
        
        timeSelect.innerHTML = '<option value="">Seleziona orario di partenza...</option>';
        trips.forEach(trip => {
            const option = document.createElement('option');
            option.value = trip.id;
            option.textContent = `${trip.departure} → ${trip.arrival} (${trip.duration_minutes} min)`;
            timeSelect.appendChild(option);
        });
        
        timeSelect.disabled = false;

        MapManager.drawRouteAndStations(
            this.selectedRouteId,
            trips,
            this.selectedOrigin,
            this.selectedDestination
        );
        
        TimelineManager.updateWithTrips(
            trips,
            this.selectedDate,
            this.selectedOrigin,
            this.selectedDestination
        );
        
        Utils.log(`Trovati ${trips.length} viaggi`);
    },

    // Reset methods with proper cascading
    resetAll() {
        this.selectedRouteId = null;
        this.selectedOrigin = null;
        this.selectedDestination = null;
        this.selectedDate = null;
        this.selectedTime = null;
        this.selectedTrip = null;
        this.filteredTrips = [];
        
        document.getElementById('routeSelect').value = '';
        this.resetFromOrigin();
        
        AnimationManager.stopAnimation();
        MapManager.clearLayers();
        TimelineManager.clear();
        this.updateStatusPanel();
    },

    resetFromOrigin() {
        this.selectedOrigin = null;
        this.selectedDestination = null;
        this.selectedDate = null;
        this.selectedTime = null;
        this.selectedTrip = null;
        this.filteredTrips = [];
        
        const originSelect = document.getElementById('originSelect');
        originSelect.innerHTML = '<option value="">Prima seleziona linea</option>';
        originSelect.disabled = true;
        
        this.resetFromDestination();
    },

    resetFromDestination() {
        this.selectedDestination = null;
        this.selectedDate = null;
        this.selectedTime = null;
        this.selectedTrip = null;
        this.filteredTrips = [];
        
        const destinationSelect = document.getElementById('destinationSelect');
        destinationSelect.innerHTML = '<option value="">Prima seleziona partenza</option>';
        destinationSelect.disabled = true;
        
        this.resetFromDate();
    },

    resetFromDate() {
        this.selectedDate = null;
        this.selectedTime = null;
        this.selectedTrip = null;
        
        const dateSelect = document.getElementById('dateSelect');
        dateSelect.innerHTML = '<option value="">Prima seleziona destinazione</option>';
        dateSelect.disabled = true;
        
        this.resetFromTime();
    },

    resetFromTime() {
        this.selectedTime = null;
        this.selectedTrip = null;
        
        const timeSelect = document.getElementById('timeSelect');
        timeSelect.innerHTML = '<option value="">Prima seleziona data</option>';
        timeSelect.disabled = true;
        
        this.updatePlayButton();
    },


    updatePlayButton() {
        const playButton = document.getElementById('playButton');
        playButton.disabled = !this.selectedTrip;
    },

    updateStatusPanel() {
        const route = this.selectedRouteId ? DataManager.getRoute(this.selectedRouteId) : null;
        const origin = this.selectedOrigin ? DataManager.getStop(this.selectedOrigin) : null;
        const destination = this.selectedDestination ? DataManager.getStop(this.selectedDestination) : null;
        const trip = this.selectedTrip ? DataManager.getTrip(this.selectedTrip) : null;
        
        document.getElementById('routeName').textContent = route ? route.short : '-';
        document.getElementById('currentOrigin').textContent = origin ? origin.name : '-';
        document.getElementById('currentDestination').textContent = destination ? destination.name : '-';
        document.getElementById('currentDate').textContent = this.selectedDate ? Utils.formatDate(this.selectedDate) : '-';
        document.getElementById('currentTime').textContent = trip ? trip.departure : '-';
        document.getElementById('currentDuration').textContent = trip ? `${trip.duration_minutes} min` : '-';
        document.getElementById('currentStops').textContent = trip ? trip.stop_count : '-';

        let status = 'In Attesa';
        if (this.selectedTrip) {
            status = 'Pronto per Simulazione';
        } else if (this.selectedDate && this.filteredTrips.length > 0) {
            status = 'Seleziona Orario';
        } else if (this.selectedDestination) {
            status = 'Seleziona Data';
        } else if (this.selectedOrigin) {
            status = 'Seleziona Destinazione';
        } else if (this.selectedRouteId) {
            status = 'Seleziona Partenza';
        }
        
        document.getElementById('routeStatus').textContent = status;
    },

    updateStatus(status) {
        document.getElementById('routeStatus').textContent = status;
    },

    restoreStatus() {
        this.updateStatusPanel();
    }
};