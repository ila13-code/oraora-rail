const Utils = {
    // Format date from YYYYMMDD to DD/MM/YYYY
    formatDate(dateString) {
        if (!dateString || dateString.length !== 8) return '-';
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        return `${day}/${month}/${year}`;
    },

    // Format date for timeline (YYYY-MM-DD)
    formatDateForTimeline(dateString) {
        if (!dateString || dateString.length !== 8) return null;
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        return `${year}-${month}-${day}`;
    },

    // Parse time string (HH:MM:SS to HH:MM)
    formatTime(timeString) {
        if (!timeString) return '-';
        const parts = timeString.split(':');
        return `${parts[0]}:${parts[1]}`;
    },

    // Show/hide loading screen
    showLoading(show) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = show ? 'flex' : 'none';
            loadingEl.style.opacity = show ? '1' : '0';
        }
    },

    // Show error message
    showError(message) {
        this.showLoading(false);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-panel';
        errorDiv.innerHTML = `
            <h3>⚠️ Errore Sistema</h3>
            <p>${message}</p>
            <button onclick="location.reload()" class="btn-primary" style="margin-top: 1rem;">
                🔄 Ricarica
            </button>
        `;
        document.body.appendChild(errorDiv);
    },

    // Create custom train icon
    createTrainIcon() {
        return L.icon({
            iconUrl    : 'favicon.ico', // <-- tua icona
            iconSize   : [32, 32],      // grandezza marker
            iconAnchor : [16, 16],      // punto (x,y) “di punta” del marker
            popupAnchor: [0, -16],      // dove comparirà il popup rispetto al marker
            className  : 'custom-train-marker'
        });
    },

    // Log with OraOra branding
    log(message, data = null) {
        const prefix = '🚆 OraOra Rail:';
        if (data) {
            console.log(prefix, message, data);
        } else {
            console.log(prefix, message);
        }
    },

    // Error logging
    error(message, error = null) {
        const prefix = '❌ OraOra Rail Error:';
        if (error) {
            console.error(prefix, message, error);
        } else {
            console.error(prefix, message);
        }
    }
};