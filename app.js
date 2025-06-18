// app.js - Main application for OraOra Rail

// Application namespace
const OraOraRail = {
    // Initialize application
    async init() {
        try {
            Utils.log('Inizializzazione OraOra Rail...');
            Utils.showLoading(true);
            
            // Load GTFS data
            await DataManager.loadData();
            
            // Initialize components
            MapManager.init();
            TimelineManager.init();
            AnimationManager.init();
            UIManager.init();
            
            // Hide loading
            Utils.showLoading(false);
            
            // Auto-select first route if available
            const routes = DataManager.getAllRoutes();
            if (routes.length > 0) {
                document.getElementById('routeSelect').value = routes[0].id;
                UIManager.selectRoute(routes[0].id);
            }
            
            Utils.log('OraOra Rail pronto!');
            
        } catch (error) {
            Utils.error('Errore inizializzazione', error);
            Utils.showError('Errore nel caricamento dei dati GTFS. Verificare che i file JSON siano presenti nella cartella out/');
        }
    },

    // Handle window resize
    handleResize() {
        MapManager.invalidateSize();
        TimelineManager.redraw();
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    OraOraRail.init();
});

// Handle window resize
window.addEventListener('resize', () => {
    OraOraRail.handleResize();
});

// Export for debugging
window.OraOraRail = OraOraRail;