const TimelineManager = {
    timeline: null,

    init() {
        Utils.log('Inizializzazione timeline...');
        
        const container = document.getElementById('timeline');
        const items = new vis.DataSet();
        
        const options = {
            stack: true,
            orientation: 'top',
            zoomMin: 1000 * 60 * 5, // 5 minuti
            height: '120px',
            margin: { item: 4 },
            selectable: true,
            tooltip: {
                followMouse: true,
                overflowMethod: 'flip'
            }
        };

        this.timeline = new vis.Timeline(container, items, options);
        
        this.timeline.on('select', (properties) => {
            if (properties.items.length > 0) {
                const tripId = properties.items[0];
                AnimationManager.animateTrip(tripId);
            }
        });

        Utils.log('Timeline inizializzata');
    },

    clear() {
        if (this.timeline) {
            this.timeline.setItems(new vis.DataSet([]));
        }
    },

    updateWithTrips(trips, date, originId, destinationId) {
        if (!this.timeline || trips.length === 0) return;

        const formattedDate = Utils.formatDateForTimeline(date);
        if (!formattedDate) return;

        const items = trips.map(trip => {
            const origin = DataManager.getStop(originId);
            const destination = DataManager.getStop(destinationId);

            return {
                id: trip.id,
                content: `🚂 ${trip.departure} → ${trip.arrival}`,
                start: `${formattedDate}T${trip.departure}`,
                end: `${formattedDate}T${trip.arrival}`,
                title: this.createTripTooltip(trip, origin, destination),
                className: 'trip-item'
            };
        });

        this.timeline.setItems(new vis.DataSet(items));

        if (trips.length > 0) {
            const firstTrip = trips[0];
            const lastTrip = trips[trips.length - 1];
            
            const startTime = new Date(`${formattedDate}T${firstTrip.departure}`);
            const endTime = new Date(`${formattedDate}T${lastTrip.arrival}`);
            const buffer = 60 * 60 * 1000; // 1 ora di buffer

            this.timeline.setWindow(
                new Date(startTime.getTime() - buffer),
                new Date(endTime.getTime() + buffer)
            );
        }
    },

    updateForSingleTrip(tripId, date) {
        const trip = DataManager.getTrip(tripId);
        if (!trip || !this.timeline) return;

        const formattedDate = Utils.formatDateForTimeline(date);
        if (!formattedDate) return;

        const origin = DataManager.getStop(UIManager.selectedOrigin);
        const destination = DataManager.getStop(UIManager.selectedDestination);

        const item = {
            id: tripId,
            content: `${trip.departure} → ${trip.arrival} (${trip.duration_minutes}min)`,
            start: `${formattedDate}T${trip.departure}`,
            end: `${formattedDate}T${trip.arrival}`,
            title: this.createTripTooltip(trip, origin, destination),
            className: 'trip-item-selected'
        };

        this.timeline.setItems(new vis.DataSet([item]));

        const startTime = new Date(`${formattedDate}T${trip.departure}`);
        const endTime = new Date(`${formattedDate}T${trip.arrival}`);
        const buffer = 30 * 60 * 1000; // 30 minuti di buffer

        this.timeline.setWindow(
            new Date(startTime.getTime() - buffer),
            new Date(endTime.getTime() + buffer)
        );

        this.timeline.setSelection([tripId]);
    },

    createTripTooltip(trip, origin, destination) {
        return `Da: ${origin?.name || '-'}
A: ${destination?.name || '-'}
Partenza: ${trip.departure}
Arrivo: ${trip.arrival}
Durata: ${trip.duration_minutes} min
Fermate: ${trip.stop_count}`;
    },
    redraw() {
        if (this.timeline) {
            this.timeline.redraw();
        }
    }
};