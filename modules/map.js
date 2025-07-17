const MapManager = {
    // Istanza Leaflet
    map: null,

    // Layer
    routeLayer : null,   // polilinee del percorso
    stationLayer : null, // marker stazioni
    trainLayer : null,   // marker treno

    /* ------------------------------------------------------------------
     *  INIT
     * ----------------------------------------------------------------*/
    init () {
        Utils.log('Inizializzazione mappa…');

        this.map = L.map('map', {
            zoomSnap     : 0.1,
            preferCanvas : true,
            zoomControl  : false
        }).setView([41.9, 12.5], 6);          // Italia

        L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

        L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            { attribution:'© OpenStreetMap / CARTO | OraOra Rail', maxZoom:18 }
        ).addTo(this.map);

        /* featureGroup anziché layerGroup → ha getBounds nativamente   */
        this.routeLayer   = L.featureGroup().addTo(this.map);  // sotto
        this.stationLayer = L.featureGroup().addTo(this.map);  // sopra
        this.trainLayer   = L.featureGroup().addTo(this.map);  // top

        // (route → stazioni → treno)
        this.routeLayer.bringToBack();
        Utils.log('Mappa pronta');
    },

    /* ------------------------------------------------------------------
     *  CLEAR
     * ----------------------------------------------------------------*/
    clearLayers () {
        this.routeLayer .clearLayers();
        this.stationLayer.clearLayers();
        this.trainLayer .clearLayers();
    },

    /* ------------------------------------------------------------------
     *  DRAW ROUTE + STATIONS
     * ----------------------------------------------------------------*/
    drawRouteAndStations (routeId, trips, originId, destinationId) {

        this.clearLayers();

        const route = DataManager.getRoute(routeId);
        if (!route) return;                                   // safety

        /* === 1) LINEA DEL PERCORSO ================================== */
        /* shape_id univoci dei viaggi filtrati                         */
        const shapeIds = new Set(trips.map(t => t.shape_id));
        Utils.log(`Disegno ${shapeIds.size} shape…`);

        shapeIds.forEach(shapeId => {
            const rawShape = DataManager.getShape(shapeId);
            if (!rawShape || rawShape.length === 0) return;

            const latlngs = rawShape.map(pt =>
                Array.isArray(pt)
                    ? [ +pt[0], +pt[1] ]                       // [lat, lon]
                    : [ +pt.lat, +(pt.lon ?? pt.lng) ]         // {lat, lon}
            );

            const poly = L.polyline(latlngs, {
                color       : route.color || '#47B8FF',
                weight      : 5,
                opacity     : 0.9,
                smoothFactor: 1.3,
                className   : 'route-line'
            })
            .bindPopup(this.createRoutePopup(route, shapeId, latlngs.length));

            this.routeLayer.addLayer(poly);
        });

        /* === 2) MARKER STAZIONI ===================================== */
        const stationIds = new Set();
        trips.forEach(t => t.stops?.forEach(([stopId]) => stationIds.add(stopId)));

        stationIds.forEach(stopId => {
            const stop = DataManager.getStop(stopId);
            if (!stop) return;

            const marker = this.createStationMarker(stop, stopId, route, originId, destinationId);
            this.stationLayer.addLayer(marker);
        });


        if (this.routeLayer.getLayers().length || this.stationLayer.getLayers().length) {
            const g = L.featureGroup([ this.routeLayer, this.stationLayer ]);
            this.map.fitBounds(g.getBounds().pad(0.12));
        }
    },

    createStationMarker (stop, stopId, route, originId, destinationId) {
        const style = {
            radius     : 6,
            fillColor  : '#fff',
            color      : route.color || '#47B8FF',
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

        m.bindPopup(this.createStationPopup(stop, type))
         .bindTooltip(stop.name, { direction:'top' });

        return m;
    },

    createRoutePopup (route, shapeId, points) { /* … */ },
    createStationPopup (stop, type)           { /* … */ },

    addTrainMarker (pos) {
        this.trainLayer.clearLayers();
        return L.marker(pos, { icon: Utils.createTrainIcon(), zIndexOffset: 1000 })
                .addTo(this.trainLayer);
    },
    panTo        (pos){ this.map?.panTo(pos);           },
    invalidateSize(){ this.map?.invalidateSize();       }
};

