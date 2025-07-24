const MapManager = {
    map: null,

    routeLayer   : null,
    stationLayer : null,
    trainLayer   : null,

    plannerLayer      : null,
    plannerStopsLayer : null,

    init () {
        Utils.log('Inizializzazione mappa…');

        this.map = L.map('map', {
            zoomSnap     : 0.1,
            preferCanvas : true,
            zoomControl  : false
        }).setView([41.9, 12.5], 6);

        L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

        L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            { attribution:'© OpenStreetMap | OraOra Rail', maxZoom:18 }
        ).addTo(this.map);

        this.routeLayer        = L.featureGroup().addTo(this.map);
        this.stationLayer      = L.featureGroup().addTo(this.map);
        this.trainLayer        = L.featureGroup().addTo(this.map);

        this.plannerLayer      = L.featureGroup().addTo(this.map);
        this.plannerStopsLayer = L.featureGroup().addTo(this.map);

        this.routeLayer.bringToBack();
        Utils.log('Mappa pronta');
    },

    clearLayers () {
        this.routeLayer .clearLayers();
        this.stationLayer.clearLayers();
        this.trainLayer .clearLayers();
    },

    clearPlannerLayers () {
        this.plannerLayer.clearLayers();
        this.plannerStopsLayer.clearLayers();
    },

    /* ------------------------------------------------------------------
     *  Vista normale (linea → trip singolo)
     * ----------------------------------------------------------------*/
    drawRouteAndStations (routeId, trips, originId, destinationId) {
        this.clearLayers();

        const route = DataManager.getRoute(routeId);
        if (!route) return;

        const mode  = route.mode || (route.type === '3' ? 'bus' : 'train');
        const color = Utils.getModeColor(mode);

        let boundsGroup = [];

        if (originId && destinationId) {
            const validTrip = trips.find(t => {
                const { idxO, idxD } = DataManager.findIndicesInTrip(t, originId, destinationId);
                return idxO !== -1 && idxD !== -1 && idxO < idxD;
            });

            if (validTrip) {
                const tripId = validTrip.id || validTrip.trip_id || validTrip.tripId;
                const coords = DataManager.getPolylineForTripSegment(tripId, originId, destinationId);

                if (coords && coords.length) {
                    const latlngs = coords.map(pt =>
                        Array.isArray(pt) ? [ +pt[0], +pt[1] ] : [ +pt.lat, +(pt.lon ?? pt.lng) ]
                    );
                    const poly = L.polyline(latlngs, {
                        color,
                        weight: 5,
                        opacity: 0.9,
                        smoothFactor: 1.3,
                        className: 'route-line'
                    });
                    this.routeLayer.addLayer(poly);
                    boundsGroup.push(poly);

                    const { idxO, idxD } = DataManager.findIndicesInTrip(validTrip, originId, destinationId);
                    const sliceStops = validTrip.stops.slice(idxO, idxD + 1);

                    sliceStops.forEach(([stopId]) => {
                        const stop = DataManager.getStop(stopId);
                        if (!stop) return;
                        const marker = this.createStationMarker(stop, stopId, route, originId, destinationId);
                        this.stationLayer.addLayer(marker);
                    });
                }
            } else {
                console.log('Nessun trip valido trovato per il segmento, fallback completo');
                // Fallback: disegna tutte le shape della route
                const shapeIds = new Set(trips.map(t => t.shape_id));
                shapeIds.forEach(shapeId => {
                    const rawShape = DataManager.getShape(shapeId);
                    if (!rawShape || rawShape.length === 0) return;

                    const latlngs = rawShape.map(pt =>
                        Array.isArray(pt) ? [ +pt[0], +pt[1] ] : [ +pt.lat, +(pt.lon ?? pt.lng) ]
                    );

                    const poly = L.polyline(latlngs, {
                        color,
                        weight: 5,
                        opacity: 0.9,
                        smoothFactor: 1.3,
                        className: 'route-line'
                    });

                    this.routeLayer.addLayer(poly);
                    boundsGroup.push(poly);
                });

                // Solo le fermate origin/destination
                [originId, destinationId].forEach(stopId => {
                    const stop = DataManager.getStop(stopId);
                    if (!stop) return;
                    const marker = this.createStationMarker(stop, stopId, route, originId, destinationId);
                    this.stationLayer.addLayer(marker);
                });
            }
        } else {
            // fallback: disegna tutte le shape della route
            const shapeIds = new Set(trips.map(t => t.shape_id));
            shapeIds.forEach(shapeId => {
                const rawShape = DataManager.getShape(shapeId);
                if (!rawShape || rawShape.length === 0) return;

                const latlngs = rawShape.map(pt =>
                    Array.isArray(pt) ? [ +pt[0], +pt[1] ] : [ +pt.lat, +(pt.lon ?? pt.lng) ]
                );

                const poly = L.polyline(latlngs, {
                    color,
                    weight: 5,
                    opacity: 0.9,
                    smoothFactor: 1.3,
                    className: 'route-line'
                });

                this.routeLayer.addLayer(poly);
                boundsGroup.push(poly);
            });

            const stationIds = new Set();
            trips.forEach(t => t.stops?.forEach(([stopId]) => stationIds.add(stopId)));

            stationIds.forEach(stopId => {
                const stop = DataManager.getStop(stopId);
                if (!stop) return;
                const marker = this.createStationMarker(stop, stopId, route, originId, destinationId);
                this.stationLayer.addLayer(marker);
            });
        }

        if (boundsGroup.length || this.stationLayer.getLayers().length) {
            const g = L.featureGroup([...boundsGroup, this.stationLayer]);
            this.map.fitBounds(g.getBounds().pad(0.12));
        }
    },

    drawItineraryFromLegs(legs) {
        this.clearPlannerLayers();

        if (!legs || !legs.length) return;

        const allBounds = [];

        legs.forEach((leg) => {
            let shapeCoords = null;

            if (leg.trip_id) {
                const originId = leg.segments?.[0]?.from_stop?.id;
                const destId   = leg.segments?.[leg.segments.length - 1]?.to_stop?.id;
                
                // USA il metodo corretto per ottenere solo il segmento necessario
                shapeCoords = DataManager.getPolylineForTripSegment(leg.trip_id, originId, destId);
                
                // Se non funziona, fallback alla shape completa
                if (!shapeCoords || !shapeCoords.length) {
                    const trip = DataManager.getTrip(leg.trip_id);
                    if (trip) shapeCoords = DataManager.getShape(trip.shape_id);
                }
            }

            if (!shapeCoords && leg.segments && leg.segments[0]?.shape_id) {
                shapeCoords = DataManager.getShape(leg.segments[0].shape_id);
            }
            if (!shapeCoords || shapeCoords.length === 0) return;

            const latlngs = shapeCoords.map(pt =>
                Array.isArray(pt) ? [ +pt[0], +pt[1] ] : [ +pt.lat, +(pt.lon ?? pt.lng) ]
            );

            const color = Utils.getModeColor(leg.mode);
            const poly = L.polyline(latlngs, {
                color,
                weight: 6,
                opacity: 0.95,
                smoothFactor: 1.2,
                dashArray: leg.mode === 'bus' ? '6 6' : null,
                className: 'plan-line'
            }).bindPopup(`
                <div class="custom-tooltip">
                  <div class="tooltip-title">${leg.mode === 'bus' ? '🚌 BUS' : '🚆 TRENO'} • ${leg.route_short || leg.route_id}</div>
                  <div class="tooltip-info"><strong>${leg.departure}</strong> → <strong>${leg.arrival}</strong> (${leg.duration} min)</div>
                  <div class="tooltip-info">${leg.from_stop.name} → ${leg.to_stop.name}</div>
                </div>
            `);

            this.plannerLayer.addLayer(poly);
            allBounds.push(poly.getBounds());
        });

        this.addPlannerStops(legs);

        const fg = L.featureGroup([this.plannerLayer, this.plannerStopsLayer]);
        if (fg.getLayers().length) {
            this.map.fitBounds(fg.getBounds().pad(0.15));
        }
    },

    addPlannerStops(legs) {
        if (!legs || !legs.length) return;

        const allStops = new Set();
        const changeStops = new Set();
        
        //raccogli tutte le fermate e identifica i punti di cambio
        legs.forEach((leg, legIndex) => {
            if (!leg.segments) return;
            
            leg.segments.forEach(segment => {
                allStops.add(segment.from_stop.id);
                allStops.add(segment.to_stop.id);
            });

            //se non è l'ultima leg, la fermata finale è un cambio
            if (legIndex < legs.length - 1) {
                const lastSegment = leg.segments[leg.segments.length - 1];
                changeStops.add(lastSegment.to_stop.id);
            }
        });

        const startStopId = legs[0].segments?.[0]?.from_stop?.id;
        const endStopId = legs[legs.length - 1].segments?.[legs[legs.length - 1].segments.length - 1]?.to_stop?.id;

        allStops.forEach(stopId => {
            const stop = DataManager.getStop(stopId);
            if (!stop) return;

            let marker;
            
            if (stopId === startStopId) {
                // Fermata di PARTENZA (Verde)
                marker = this.createPlannerMarker(stop, 'start');
            } else if (stopId === endStopId) {
                // Fermata di ARRIVO (Rosso)
                marker = this.createPlannerMarker(stop, 'end');
            } else if (changeStops.has(stopId)) {
                // Fermata di CAMBIO (Blu con scritta "CAMBIO")
                marker = this.createPlannerMarker(stop, 'change');
            } else {
                // Fermata intermedia - marker normale
                marker = this.createPlannerMarker(stop, 'intermediate');
            }

            this.plannerStopsLayer.addLayer(marker);
        });
    },

    createPlannerMarker(stop, type) {
        let style, tooltip;

        switch (type) {
            case 'start':
                style = {
                    radius: 12,
                    fillColor: '#48BB78',
                    color: '#2F855A',
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                };
                tooltip = `🟢 PARTENZA: ${stop.name}`;
                break;
                
            case 'end':
                style = {
                    radius: 12,
                    fillColor: '#F56565',
                    color: '#C53030',
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                };
                tooltip = `🔴 ARRIVO: ${stop.name}`;
                break;
                
            case 'change':
                const changeIcon = L.divIcon({
                    html: '<div style="background: #3182CE; color: white; border-radius: 50%; width: 45px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; border: 2px solid #2C5282;">CAMBIO</div>',
                    className: 'change-marker',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                });
                
                const changeMarker = L.marker([stop.lat, stop.lon], { icon: changeIcon });
                changeMarker.bindTooltip(`🔵 CAMBIO: ${stop.name}`, { direction: 'top' });
                changeMarker.bindPopup(`
                    <div class="custom-tooltip">
                        <div class="tooltip-title">🔵 Punto di Cambio</div>
                        <div>${stop.name}</div>
                    </div>
                `);
                return changeMarker;
                
            default:
                style = {
                    radius: 4,
                    fillColor: '#fff',
                    color: '#666',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 1
                };
                tooltip = stop.name;
        }

        const marker = L.circleMarker([stop.lat, stop.lon], style);
        marker.bindTooltip(tooltip, { direction: 'top' });
        
        if (type === 'start' || type === 'end') {
            marker.bindPopup(`
                <div class="custom-tooltip">
                    <div class="tooltip-title">${type === 'start' ? '🟢 Partenza' : '🔴 Arrivo'}</div>
                    <div>${stop.name}</div>
                </div>
            `);
        }
        
        return marker;
    },

    createStationMarker (stop, stopId, route, originId, destinationId) {
        const mode  = route.mode || (route.type === '3' ? 'bus' : 'train');
        const color = Utils.getModeColor(mode);

        const style = {
            radius     : 6,
            fillColor  : '#fff',
            color      : color,
            weight     : 3,
            opacity    : 1,
            fillOpacity: 1,
            className  : 'station-marker'
        };

        if (stopId === originId) {
            Object.assign(style, { radius:10, fillColor:'#48BB78', color:'#2F855A' });
        } else if (stopId === destinationId) {
            Object.assign(style, { radius:10, fillColor:'#F56565', color:'#C53030' });
        }

        const m = L.circleMarker([stop.lat, stop.lon], style);
        const type = stopId === originId ? 'Partenza'
                  : stopId === destinationId ? 'Arrivo'
                  : 'Fermata';

        m.bindTooltip(stop.name, { direction:'top' });
        m.bindPopup(`<div class="custom-tooltip"><div class="tooltip-title">${type}</div><div>${stop.name}</div></div>`);
        return m;
    },

    addVehicleMarker(mode, pos) {
        this.trainLayer.clearLayers();
        const icon = (mode === 'bus') ? Utils.createBusIcon() : Utils.createTrainIcon();
        return L.marker(pos, { icon, zIndexOffset: 1000 }).addTo(this.trainLayer);
    },

    panTo(pos){ this.map?.panTo(pos); },
    invalidateSize(){ this.map?.invalidateSize(); }
};

window.MapManager = MapManager;