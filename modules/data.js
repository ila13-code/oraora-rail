const DataManager = {
    // Data URLs
    DATA_URL: './out/',
    
    // Loaded data
    routes: null,
    shapes: null,
    stops: null,
    timetable: null,
    calendar: null,
    stats: null,

    // Load all GTFS data
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

    // Fetch JSON file
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

    // Get route by ID
    getRoute(routeId) {
        return this.routes[routeId] || null;
    },

    // Get stop by ID
    getStop(stopId) {
        return this.stops[stopId] || null;
    },

    // Get shape by ID
    getShape(shapeId) {
        return this.shapes[shapeId] || null;
    },

    // Get trip by ID
    getTrip(tripId) {
        return this.timetable[tripId] || null;
    },

    // Get all routes
    getAllRoutes() {
        return Object.entries(this.routes).map(([id, route]) => ({
            id,
            ...route
        }));
    },

    // Get trips for a specific route
    getTripsForRoute(routeId) {
        return Object.entries(this.timetable)
            .filter(([id, trip]) => trip.route_id === routeId)
            .map(([id, trip]) => ({ id, ...trip }));
    },

    // Get origin stations for a route
    getOriginsForRoute(routeId) {
        const trips = this.getTripsForRoute(routeId);
        const origins = new Map();

        trips.forEach(trip => {
            if (trip.stops && trip.stops.length > 0) {
                const firstStopId = trip.stops[0][0];
                const firstStop = this.getStop(firstStopId);
                if (firstStop) {
                    origins.set(firstStopId, firstStop);
                }
            }
        });

        return Array.from(origins.entries())
            .map(([id, stop]) => ({ id, ...stop }))
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    // Get destinations from a specific origin
    getDestinationsFromOrigin(routeId, originId) {
        const trips = this.getTripsForRoute(routeId);
        const destinations = new Map();

        trips.forEach(trip => {
            if (trip.stops && trip.stops.length > 1) {
                const firstStopId = trip.stops[0][0];
                if (firstStopId === originId) {
                    const lastStopId = trip.stops[trip.stops.length - 1][0];
                    const lastStop = this.getStop(lastStopId);
                    if (lastStop && lastStopId !== originId) {
                        destinations.set(lastStopId, lastStop);
                    }
                }
            }
        });

        return Array.from(destinations.entries())
            .map(([id, stop]) => ({ id, ...stop }))
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    // Get available dates for origin-destination pair
    getAvailableDates(routeId, originId, destinationId) {
        const trips = this.getTripsForRoute(routeId);
        const dates = new Set();

        trips.forEach(trip => {
            if (trip.stops && trip.stops.length >= 2) {
                const firstStopId = trip.stops[0][0];
                const lastStopId = trip.stops[trip.stops.length - 1][0];

                if (firstStopId === originId && lastStopId === destinationId) {
                    // Check service dates
                    if (trip.service_dates) {
                        Object.entries(trip.service_dates).forEach(([date, active]) => {
                            if (active === 1) {
                                dates.add(date);
                            }
                        });
                    }
                    // Also check calendar
                    else if (this.calendar[trip.service_id]) {
                        Object.entries(this.calendar[trip.service_id]).forEach(([date, exceptionType]) => {
                            if (exceptionType === 1) {
                                dates.add(date);
                            }
                        });
                    }
                }
            }
        });

        return Array.from(dates).sort();
    },

    // Get trips for specific criteria
    getTripsForCriteria(routeId, originId, destinationId, date) {
        return this.getTripsForRoute(routeId).filter(trip => {
            if (!trip.stops || trip.stops.length < 2) return false;

            const firstStopId = trip.stops[0][0];
            const lastStopId = trip.stops[trip.stops.length - 1][0];

            if (firstStopId !== originId || lastStopId !== destinationId) return false;

            // Check if trip runs on selected date
            if (trip.service_dates && trip.service_dates[date] === 1) {
                return true;
            }

            if (this.calendar[trip.service_id] && this.calendar[trip.service_id][date] === 1) {
                return true;
            }

            return false;
        }).sort((a, b) => a.departure.localeCompare(b.departure));
    }
};