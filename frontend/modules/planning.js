const PlanningManager = {
  init() {
    this.cacheDom();
    this.bindEvents();
    this.fillStops();
  },

  cacheDom() {
    this.btnOpen = document.getElementById('openPlanner');
    this.panel = document.getElementById('plannerPanel');
    this.closeBtn = document.getElementById('plannerClose');

    this.originSel = document.getElementById('plannerOrigin');
    this.destSel = document.getElementById('plannerDestination');
    this.dateInput = document.getElementById('plannerDate');
    this.optimizeSel = document.getElementById('plannerOptimize');
    this.departAfterInput = document.getElementById('plannerDepartAfter');

    this.runBtn = document.getElementById('plannerRun');
    this.resultDiv = document.getElementById('plannerResult');
  },

  bindEvents() {
    this.btnOpen?.addEventListener('click', () => this.panel.style.display = 'block');
    this.closeBtn?.addEventListener('click', () => {
      this.panel.style.display = 'none';
      MapManager.clearPlannerLayers?.();
    });
    this.runBtn?.addEventListener('click', () => this.run());
  },

  fillStops() {
    const stops = DataManager.getAllStops();
    const opts = stops
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => `<option value="${s.id}">${s.name}</option>`)
      .join('');
    this.originSel.innerHTML = `<option value="">Seleziona.</option>${opts}`;
    this.destSel.innerHTML = `<option value="">Seleziona.</option>${opts}`;
  },

  async run() {
    const origin = this.originSel.value;
    const dest = this.destSel.value;
    const date = (this.dateInput.value || '').replace(/-/g, '');
    const optimize = this.optimizeSel.value;
    const departAfter = this.departAfterInput.value || "00:00:00";

    if (!origin || !dest || !date) {
      this.resultDiv.innerHTML = `<div class="planner-error">Compila tutti i campi obbligatori</div>`;
      return;
    }

    try {
      const res = await fetch('/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination: dest, date, optimize, depart_after: departAfter })
      });
      const data = await res.json();
      if (!data.found) {
        this.resultDiv.innerHTML = `<div class="planner-error">${data.message || 'Nessun itinerario'}</div>`;
        return;
      }
      
      const processedLegs = this.processLegsForVisualization(data.legs || []);
      
      this.renderPlan(data, processedLegs);
      MapManager.drawItineraryFromLegs(processedLegs);
    } catch (e) {
      console.error(e);
      this.resultDiv.innerHTML = `<div class="planner-error">Errore di rete / BE</div>`;
    }
  },

  processLegsForVisualization(legs) {
    return legs.map((leg, legIndex) => {

      const processedLeg = { ...leg };
      
      if (leg.segments && leg.segments.length > 0) {
        const firstSegment = leg.segments[0];
        const lastSegment = leg.segments[leg.segments.length - 1];
        
       
        processedLeg.from_stop = firstSegment.from_stop;
        processedLeg.to_stop = lastSegment.to_stop;
        
        processedLeg.isFirstLeg = legIndex === 0;
        processedLeg.isLastLeg = legIndex === legs.length - 1;
        processedLeg.legIndex = legIndex;
        
        if (leg.trip_id) {
          const originId = firstSegment.from_stop.id;
          const destId = lastSegment.to_stop.id;

          processedLeg._visualOriginId = originId;
          processedLeg._visualDestId = destId;
          
          console.log(`Leg ${legIndex + 1}: ${leg.mode} da ${firstSegment.from_stop.name} (${originId}) a ${lastSegment.to_stop.name} (${destId})`);
        }
      }
      
      return processedLeg;
    });
  },

  renderPlan(plan, processedLegs) {
    const total = plan.total_minutes;
    const transfers = plan.transfers;
    const legs = processedLegs || plan.legs || [];
    const segmentsCount = plan.segments_count ?? (plan.segments ? plan.segments.length : 0);

    let html = `
      <div class="planner-summary">
        <strong>Tempo totale:</strong> ${total} min &nbsp;&nbsp; 
        <strong>Cambi (veicolo):</strong> ${transfers} &nbsp;&nbsp;
        <strong>Segmenti:</strong> ${segmentsCount} &nbsp;&nbsp;
        <span class="planner-solver">Solver: ${plan.solver}</span>
        <div style="margin-top:8px;">
          <button id="plannerSimAll" class="btn-primary">▶️ Simula tutto</button>
        </div>
      </div>
      <div class="planner-legs">
        ${legs.map((leg, i) => {
          const originId = leg._visualOriginId || leg.segments?.[0]?.from_stop?.id;
          const destId = leg._visualDestId || leg.segments?.[leg.segments.length - 1]?.to_stop?.id;
          
          return `
          <div class="planner-leg">
            <div class="planner-seg-head">
              <span class="planner-seg-idx">${i+1}</span>
              <span class="planner-seg-mode">${leg.mode === 'train' ? '🚆' : '🚌'}</span>
              <span class="planner-seg-time">${leg.departure} → ${leg.arrival} (${leg.duration} min)</span>
              <span class="planner-seg-route">${leg.route_short || leg.route_id}</span>
              ${leg.isFirstLeg ? '<span class="planner-leg-badge" style="background: #48BB78; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">PARTENZA</span>' : ''}
              ${leg.isLastLeg ? '<span class="planner-leg-badge" style="background: #F56565; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">ARRIVO</span>' : ''}
              ${!leg.isFirstLeg && !leg.isLastLeg ? '<span class="planner-leg-badge" style="background: #3182CE; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">CAMBIO</span>' : ''}
            </div>
            <div class="planner-seg-body">
              <div><strong>Da:</strong> ${leg.from_stop.name}</div>
              <div><strong>A:</strong> ${leg.to_stop.name}</div>
              ${
                leg.trip_id
                  ? `<button class="btn-secondary"
                             data-trip="${leg.trip_id}"
                             data-origin="${originId}"
                             data-dest="${destId}"
                             data-mode="${leg.mode}">▶️ Simula solo questo</button>`
                  : ''
              }
              <details>
                <summary>${leg.segments.length} segmenti</summary>
                ${leg.segments.map((s,j) => `
                  <div class="planner-subseg">
                    ${j+1}. ${s.departure} → ${s.arrival} — ${s.from_stop.name} → ${s.to_stop.name}
                  </div>
                `).join('')}
              </details>
            </div>
          </div>
        `}).join('')}
      </div>
    `;

    this.resultDiv.innerHTML = html;

    // Simula TUTTO
    const simAllBtn = document.getElementById('plannerSimAll');
    simAllBtn?.addEventListener('click', () => {
      AnimationManager.animatePlan(legs);
    });

    this.resultDiv.querySelectorAll('button[data-trip]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tripId = e.currentTarget.getAttribute('data-trip');
        const originId = e.currentTarget.getAttribute('data-origin');
        const destId = e.currentTarget.getAttribute('data-dest');
        const mode = e.currentTarget.getAttribute('data-mode') || 'train';
        if (!tripId || !originId || !destId) return;

        const correspondingLeg = legs.find(l => l.trip_id === tripId);
        
        AnimationManager.animateTripSegment(tripId, originId, destId, mode, correspondingLeg);
      });
    });
  }
};

window.PlanningManager = PlanningManager;