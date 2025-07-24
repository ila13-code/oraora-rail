const DataManager = {
    DATA_URL: '/data/',
    
    routes: null,
    shapes: null,
    stops: null,
    timetable: null,
    calendar: null,
    stats: null,


    async loadData() {
        try {
            Utils.log('Caricamento dati GTFS...');
            
            const [routesData, shapesData, stopsData, timetableData, calendarData, statsData] = await Promise.all([
                this.fetchJSON('routes.json'),
                this.fetchJSON('shapes.json'),
                this.fetchJSON('stops.json'),
                this.fetchJSON('timetable.json'),
                this.fetchJSON('calendar.json', true),
                this.fetchJSON('stats.json', true)
            ]);

            this.routes = routesData;
            this.shapes = shapesData;
            this.stops = stopsData;
            this.timetable = timetableData;
            this.calendar = calendarData || {};
            this.stats = statsData || {};

            Utils.log('Dati GTFS caricati:', {
                routes: Object.keys(this.routes).length,
                shapes: Object.keys(this.shapes).length,
                stops: Object.keys(this.stops).length,
                trips: Object.keys(this.timetable).length
            });

            return true;
        } catch (error) {
            Utils.error('Errore caricamento dati GTFS', error);
            throw error;
        }
    },

    async fetchJSON(filename, optional = false) {
        try {
            const response = await fetch(this.DATA_URL + filename);
            if (!response.ok) {
                if (optional) {
                    Utils.log(`File opzionale non trovato: ${filename}`);
                    return null;
                }
                throw new Error(`${filename} non trovato`);
            }
            return await response.json();
        } catch (error) {
            if (!optional) {
                throw error;
            }
            return null;
        }
    },

    getRoute(routeId) {
        return this.routes[routeId] || null;
    },

    getStop(stopId) {
        return this.stops[stopId] || null;
    },

    getShape(shapeId) {
        return this.shapes[shapeId] || null;
    },

    getTrip(tripId) {
        return this.timetable[tripId] || null;
    },

    getAllRoutes() {
        return Object.entries(this.routes).map(([id, route]) => ({
            id,
            ...route
        }));
    },

    getTripsForRoute(routeId) {
        return Object.entries(this.timetable)
            .filter(([id, trip]) => trip.route_id === routeId)
            .map(([id, trip]) => ({ id, ...trip }));
    },


    getAllStops() {
        return Object.entries(this.stops || {}).map(([id, s]) => ({ id, ...s }));
    },

    _findIndicesInTrip(trip, originId, destinationId) {
        let idxO = -1, idxD = -1;
        if (!trip.stops) return { idxO, idxD };
        for (let i = 0; i < trip.stops.length; i++) {
            const sid = trip.stops[i][0];
            if (sid === originId && idxO === -1) idxO = i;
            if (sid === destinationId) idxD = i;
        }
        return { idxO, idxD };
    },


    /**
     * Tutte le fermate toccate da QUALSIASI trip della route
     */
    getOriginsForRoute(routeId) {
        const trips = this.getTripsForRoute(routeId);
        const origins = new Map();

        trips.forEach(trip => {
            if (!trip.stops) return;
            trip.stops.forEach(st => {
                const stopId = st[0];
                const stop = this.getStop(stopId);
                if (stop) {
                    origins.set(stopId, stop);
                }
            });
        });

        return Array.from(origins.entries())
            .map(([id, stop]) => ({ id, ...stop }))
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    /**
     * Tutte le fermate raggiungibili DOPO originId (all'interno di ogni trip della route)
     */
    getDestinationsFromOrigin(routeId, originId) {
        const trips = this.getTripsForRoute(routeId);
        const destinations = new Map();

        trips.forEach(trip => {
            if (!trip.stops || trip.stops.length < 2) return;

            const idxOrigin = trip.stops.findIndex(s => s[0] === originId);
            if (idxOrigin === -1) return;

            for (let i = idxOrigin + 1; i < trip.stops.length; i++) {
                const stopId = trip.stops[i][0];
                const stop = this.getStop(stopId);
                if (stop) destinations.set(stopId, stop);
            }
        });

        return Array.from(destinations.entries())
            .map(([id, stop]) => ({ id, ...stop }))
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    /**
     * Ritorna le date in cui c'è almeno un trip che passa da originId a destinationId (origin prima di destination)
     */
    getAvailableDates(routeId, originId, destinationId) {
        const trips = this.getTripsForRoute(routeId);
        const dates = new Set();

        trips.forEach(trip => {
            if (!trip.stops || trip.stops.length < 2) return;

            const { idxO, idxD } = this._findIndicesInTrip(trip, originId, destinationId);
            if (idxO === -1 || idxD === -1 || idxD <= idxO) return;

            if (trip.service_dates) {
                Object.entries(trip.service_dates).forEach(([date, active]) => {
                    if (active === 1) dates.add(date);
                });
            }

            const cal = this.calendar[trip.service_id];
            if (cal) {
                Object.entries(cal).forEach(([date, exceptionType]) => {
                    if (exceptionType === 1) dates.add(date);
                });
            }
        });

        return Array.from(dates).sort();
    },

    /**
     * Trips che coprono originId -> destinationId (origin prima di destination) nel giorno richiesto.
     * Ordina per orario di partenza reale dall'origine (non per la prima fermata del trip).
     */
    getTripsForCriteria(routeId, originId, destinationId, date) {
        const trips = this.getTripsForRoute(routeId);
        const result = [];

        trips.forEach(trip => {
            if (!trip.stops || trip.stops.length < 2) return;

            const { idxO, idxD } = this._findIndicesInTrip(trip, originId, destinationId);
            if (idxO === -1 || idxD === -1 || idxD <= idxO) return;

            // attivo nel giorno
            let active = false;
            if (trip.service_dates && trip.service_dates[date] === 1) active = true;
            const cal = this.calendar[trip.service_id];
            if (!active && cal && cal[date] === 1) active = true;
            if (!active) return;

            const depFromOrigin = trip.stops[idxO][1]; // orario di partenza dalla fermata origin
            const arrToDest = trip.stops[idxD][2];     // orario di arrivo alla fermata destinazione

            result.push({
                ...trip,
                _dep_from_origin: depFromOrigin,
                _arr_to_destination: arrToDest,
                _origin_index: idxO,
                _destination_index: idxD
            });
        });

        return result.sort((a, b) => {
            const da = a._dep_from_origin || a.departure || '';
            const db = b._dep_from_origin || b.departure || '';
            return da.localeCompare(db);
        });
    },

    getPolylineForTripSegment(tripId, originId, destinationId) {
        const trip = this.getTrip(tripId);
        if (!trip || !originId || !destinationId) return null;
        
        const shape = this.getShape(trip.shape_id);
        if (!shape || shape.length === 0) return null;

        const oStop = this.getStop(originId);
        const dStop = this.getStop(destinationId);
        if (!oStop || !dStop) return shape;

        const { idxO, idxD } = this._findIndicesInTrip(trip, originId, destinationId);
        
        //se non trovo entrambe le fermate nel trip nell'ordine giusto, uso la shape completa
        if (idxO === -1 || idxD === -1 || idxO >= idxD) {
            console.log(`Trip ${tripId}: fermate non trovate o ordine sbagliato (${idxO} -> ${idxD}), usando shape completa`);
            return shape;
        }

        const i1 = Utils.nearestIndexOnShape(shape, oStop.lat, oStop.lon);
        const i2 = Utils.nearestIndexOnShape(shape, dStop.lat, dStop.lon);

        let segment;
        if (i1 <= i2) {
        segment = shape.slice(i1, i2 + 1);
        } else {
        segment = shape.slice(i2, i1 + 1).reverse(); 
        }
        return segment.length > 1 ? segment : shape;

    },

    findIndicesInTrip(trip, originId, destinationId) {
        return this._findIndicesInTrip(trip, originId, destinationId);
    }
};

window.DataManager = DataManager;