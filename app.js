const OraOraRail = {
    async init() {
        try {
            Utils.log('Inizializzazione OraOra Rail...');
            Utils.showLoading(true);
            
            await DataManager.loadData();
            
            MapManager.init();
            TimelineManager.init();
            AnimationManager.init();
            UIManager.init();
            
            Utils.showLoading(false);
            
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

    handleResize() {
        MapManager.invalidateSize();
        TimelineManager.redraw();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    OraOraRail.init();
});

window.addEventListener('resize', () => {
    OraOraRail.handleResize();
});

window.OraOraRail = OraOraRail;