/**
 * ============================================
 * VALTEK SECURITY — App Principal
 * Sistema de Control de Acceso Escolar
 * Orquestador de módulos y UI
 * ============================================
 */

'use strict';

const App = {
  // ---- State ----
  currentView: 'dashboard',
  alertCount: 0,
  doorAlarmAudio: null,
  doorTimerInterval: null,
  clockInterval: null,
  dashboardRefreshInterval: null,
  activeAlerts: [],

  // ---- Page Titles ----
  pageTitles: {
    dashboard: { title: 'Dashboard de Conserjería', desc: 'Vista general del recinto en tiempo real' },
    airlock: { title: 'Esclusa & Lectores', desc: 'Control de la esclusa bidireccional y simulación de lectores' },
    users: { title: 'Directorio de Usuarios', desc: 'Listado completo de usuarios enrolados' },
    enrollment: { title: 'Pre-Enrolamiento', desc: 'Formulario de registro de nuevos usuarios' },
    scanner: { title: 'Parseo de Cédula', desc: 'Decodificación de QR y PDF417 de cédula chilena' },
    hardware: { title: 'Configuración de Hardware', desc: 'Administración de controladoras y lectores' },
    alerts: { title: 'Alertas de Seguridad', desc: 'Registro de alertas anti-passback y de sensores' }
  },

  // ============================================
  // INITIALIZATION
  // ============================================
  init() {
    // Load data from localStorage or demo data
    if (window.Analytics) {
      window.Analytics.loadFromLocalStorage();
      if (window.Analytics.getUserCount() === 0) {
        window.Analytics.loadDemoData();
        window.Analytics.saveToLocalStorage();
      }
    }

    // Setup relay callbacks
    this.setupRelayCallbacks();

    // Setup all event listeners
    this.setupNavigation();
    this.setupDashboard();
    this.setupAirlock();
    this.setupEnrollment();
    this.setupScanner();
    this.setupHardware();
    this.setupAlerts();
    this.setupOfflineToggle();
    this.setupEmailModal();
    this.setupCameraScanner();

    // Start live clock
    this.startClock();

    // Initial render
    this.refreshDashboard();
    this.populateSimUserSelect();

    // Auto-refresh dashboard every 5 seconds
    this.dashboardRefreshInterval = setInterval(() => {
      if (this.currentView === 'dashboard') {
        this.refreshDashboard();
      }
    }, 5000);

    console.log('[Valtek Security] Sistema iniciado correctamente.');
  },

  // ============================================
  // LIVE CLOCK
  // ============================================
  startClock() {
    const update = () => {
      const now = new Date();
      const clockEl = document.getElementById('live-clock');
      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('es-CL', {
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
      }
      // Also update phone status bar time if visible
      this.updateDoorTimer();
    };
    update();
    this.clockInterval = setInterval(update, 1000);
  },

  // ============================================
  // NAVIGATION
  // ============================================
  setupNavigation() {
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.navigateTo(view);
      });
    });

    // Refresh button
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.refreshDashboard();
      this.addEventLog('Sistema actualizado manualmente', 'system');
    });
  },

  navigateTo(view) {
    // Hide all views
    document.querySelectorAll('.view-page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Show target view
    const viewEl = document.getElementById(`view-${view}`);
    const navEl = document.getElementById(`nav-${view}`);
    if (viewEl) viewEl.classList.add('active');
    if (navEl) navEl.classList.add('active');

    // Update top bar
    const meta = this.pageTitles[view];
    if (meta) {
      document.getElementById('page-title').textContent = meta.title;
      document.getElementById('page-desc').textContent = meta.desc;
    }

    this.currentView = view;

    // Refresh view-specific data
    if (view === 'dashboard') this.refreshDashboard();
    if (view === 'users') this.renderEnrolledUsers();
    if (view === 'alerts') this.renderAlerts();
  },

  // ============================================
  // DASHBOARD
  // ============================================
  setupDashboard() {
    // Search filter
    document.getElementById('search-users-input')?.addEventListener('input', (e) => {
      this.renderUserStatusTable(e.target.value);
    });

    // Door sensor buttons
    document.getElementById('btn-sim-door-open')?.addEventListener('click', () => {
      if (window.RelaySimulator) {
        window.RelaySimulator.setDoorOpen(true);
        this.updateDoorSensorUI();
        document.getElementById('btn-sim-door-open').disabled = true;
        document.getElementById('btn-sim-door-close').disabled = false;
        this.addEventLog('Portón exterior ABIERTO (sensor magnético)', 'alert');
      }
    });

    document.getElementById('btn-sim-door-close')?.addEventListener('click', () => {
      if (window.RelaySimulator) {
        window.RelaySimulator.setDoorOpen(false);
        this.updateDoorSensorUI();
        document.getElementById('btn-sim-door-open').disabled = false;
        document.getElementById('btn-sim-door-close').disabled = true;
        document.getElementById('btn-ack-alarm').classList.add('hidden');
        this.addEventLog('Portón exterior CERRADO', 'system');
      }
    });

    document.getElementById('btn-ack-alarm')?.addEventListener('click', () => {
      if (window.RelaySimulator) {
        window.RelaySimulator.acknowledgeDoorAlarm();
        document.getElementById('btn-ack-alarm').classList.add('hidden');
        this.addEventLog('Alarma de puerta abierta SILENCIADA', 'system');
      }
    });
  },

  refreshDashboard() {
    if (!window.Analytics) return;

    const metrics = window.Analytics.getDashboardMetrics();

    // Animate KPI values
    this.animateValue('kpi-poblacion', metrics.poblacionActual);
    this.animateValue('kpi-ingresados', metrics.totalIngresados);
    this.animateValue('kpi-egresados', metrics.totalEgresados);
    this.animateValue('kpi-recinto', metrics.enRecintoTotal);

    // Render user status table
    this.renderUserStatusTable();

    // Update offline sync badge
    const pendingCount = window.Analytics.getOfflineQueueSize();
    const syncBadge = document.getElementById('sync-badge-count');
    const offlinePending = document.getElementById('offline-pending-count');
    if (pendingCount > 0) {
      syncBadge.style.display = 'inline';
      syncBadge.textContent = pendingCount;
    } else {
      syncBadge.style.display = 'none';
    }
    if (offlinePending) offlinePending.textContent = pendingCount;

    // Update force sync button
    const forceSyncBtn = document.getElementById('btn-force-batch-sync');
    if (forceSyncBtn) forceSyncBtn.disabled = pendingCount === 0 || !window.Analytics.getOnlineStatus();
  },

  renderUserStatusTable(filter = '') {
    if (!window.Analytics) return;

    const tbody = document.getElementById('users-status-tbody');
    if (!tbody) return;

    const matrix = window.Analytics.getUserDayMatrix();
    const filterLower = filter.toLowerCase();

    const filtered = matrix.filter(u =>
      !filter ||
      u.name.toLowerCase().includes(filterLower) ||
      u.run.toLowerCase().includes(filterLower)
    );

    tbody.innerHTML = filtered.map(user => {
      const isInside = user.estadoActual === 'DENTRO DEL COLEGIO';
      const statusClass = isInside ? 'inside' : 'outside';
      const roleClass = user.role ? user.role.toLowerCase() : 'visita';

      return `
        <tr>
          <td><strong style="color:var(--text-primary)">${user.name}</strong></td>
          <td><span class="text-mono" style="font-size:0.78rem;">${user.run}</span></td>
          <td><span class="role-badge ${roleClass}">${user.role || 'N/A'}</span></td>
          <td><span class="text-mono">${user.horaEntrada}</span></td>
          <td><span class="text-mono">${user.horaSalida}</span></td>
          <td><span class="status-badge ${statusClass}"><span class="badge-dot"></span>${user.estadoActual}</span></td>
        </tr>
      `;
    }).join('');

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">No se encontraron usuarios</td></tr>`;
    }
  },

  animateValue(elementId, newValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    if (current === newValue) return;

    const duration = 400;
    const start = performance.now();
    const diff = newValue - current;

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(current + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  },

  // ============================================
  // DOOR SENSOR
  // ============================================
  updateDoorTimer() {
    if (!window.RelaySimulator) return;
    const state = window.RelaySimulator.getDoorSensorState();
    this.updateDoorSensorUI(state);
  },

  updateDoorSensorUI(state) {
    if (!state && window.RelaySimulator) {
      state = window.RelaySimulator.getDoorSensorState();
    }
    if (!state) return;

    const icon = document.getElementById('door-icon');
    const timer = document.getElementById('door-timer');
    const msg = document.getElementById('door-msg');
    const badge = document.getElementById('door-status-badge');
    const ackBtn = document.getElementById('btn-ack-alarm');

    if (state.isOpen) {
      const elapsed = state.elapsedSeconds || 0;
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      if (state.alarmTriggered) {
        icon.className = 'door-icon-big alarm';
        icon.innerHTML = '<i class="fa-solid fa-door-open"></i>';
        timer.className = 'door-timer alarm';
        msg.textContent = '🚨 ALARMA: Puerta de la calle abierta permanentemente';
        msg.style.color = 'var(--danger)';
        badge.textContent = 'ALARMA';
        badge.className = 'card-badge';
        badge.style.background = 'var(--danger-bg)';
        badge.style.color = 'var(--danger)';
        badge.style.border = '1px solid var(--danger-border)';
        ackBtn.classList.remove('hidden');

        // Show global alert
        this.showGlobalAlert('danger', 'fa-triangle-exclamation',
          '🚨 Puerta de la calle abierta permanentemente — Más de 60 segundos sin cerrar',
          'door-alarm-alert'
        );
      } else {
        icon.className = 'door-icon-big open';
        icon.innerHTML = '<i class="fa-solid fa-door-open"></i>';
        timer.className = elapsed > 30 ? 'door-timer warning' : 'door-timer';
        msg.textContent = 'Portón abierto — Temporizador activo';
        msg.style.color = 'var(--warning)';
        badge.textContent = 'ABIERTO';
        badge.className = 'card-badge';
        badge.style.background = 'var(--warning-bg)';
        badge.style.color = 'var(--warning)';
        badge.style.border = '1px solid var(--warning-border)';
      }
    } else {
      icon.className = 'door-icon-big closed';
      icon.innerHTML = '<i class="fa-solid fa-door-closed"></i>';
      timer.textContent = '00:00';
      timer.className = 'door-timer';
      msg.textContent = 'Portón cerrado — Sin alertas';
      msg.style.color = 'var(--text-secondary)';
      badge.textContent = 'CERRADO';
      badge.className = 'card-badge live';
      badge.style = '';
      this.removeGlobalAlert('door-alarm-alert');
    }
  },

  // ============================================
  // RELAY CALLBACKS
  // ============================================
  setupRelayCallbacks() {
    if (!window.RelaySimulator) return;

    window.RelaySimulator.onRelayActivate = (relayId) => {
      const ledId = `relay-${relayId.split('_')[1]}-led`;
      const testLedId = `test-relay-${relayId.split('_')[1]}-led`;
      const led = document.getElementById(ledId);
      const testLed = document.getElementById(testLedId);
      if (led) led.classList.add('on');
      if (testLed) testLed.classList.add('on');

      // Animate gate in airlock diagram
      const gateId = (relayId === 'RELAY_1') ? 'gate-porton' : 'gate-torniquete';
      const gate = document.getElementById(gateId);
      if (gate) gate.classList.add('active');
    };

    window.RelaySimulator.onRelayDeactivate = (relayId) => {
      const ledId = `relay-${relayId.split('_')[1]}-led`;
      const testLedId = `test-relay-${relayId.split('_')[1]}-led`;
      const led = document.getElementById(ledId);
      const testLed = document.getElementById(testLedId);
      if (led) led.classList.remove('on');
      if (testLed) testLed.classList.remove('on');

      const gateId = (relayId === 'RELAY_1') ? 'gate-porton' : 'gate-torniquete';
      const gate = document.getElementById(gateId);
      if (gate) gate.classList.remove('active');
    };

    window.RelaySimulator.onScanProcessed = (result) => {
      if (result && result.success) {
        // Log to analytics
        if (window.Analytics) {
          window.Analytics.logAccess(result.run, result.hito, result.reader, result.relay);
          window.Analytics.saveToLocalStorage();
        }

        // Add to event log
        const isEntry = result.hito.includes('Ingreso');
        const user = window.Analytics?.getUser(result.run);
        const userName = user ? user.name : result.run;
        this.addEventLog(
          `<strong>${userName}</strong> — ${result.hito} via ${result.reader}`,
          isEntry ? 'entry' : 'exit'
        );

        // Add to relay activity log
        this.addRelayActivity(
          `✅ ${userName} — ${result.hito} (${result.reader})`,
          isEntry ? 'entry' : 'exit'
        );

        // Refresh dashboard
        this.refreshDashboard();
      }
    };

    window.RelaySimulator.onAlert = (alert) => {
      this.alertCount++;
      this.updateAlertBadge();
      this.activeAlerts.push({
        ...alert,
        timestamp: new Date()
      });

      const user = window.Analytics?.getUser(alert.run);
      const userName = user ? user.name : alert.run;

      this.addEventLog(
        `⚠️ <strong>ANTI-PASSBACK</strong>: ${userName} — ${alert.reason}`,
        'alert'
      );

      this.addRelayActivity(
        `🚫 BLOQUEADO: ${userName} — ${alert.reason}`,
        'alert'
      );

      this.showGlobalAlert('warning', 'fa-shield-exclamation',
        `Anti-Passback: ${userName} (${alert.run}) — ${alert.reason}`
      );
    };

    window.RelaySimulator.onDoorAlarm = () => {
      this.alertCount++;
      this.updateAlertBadge();
      this.activeAlerts.push({
        type: 'door_alarm',
        message: 'Puerta de la calle abierta por más de 60 segundos',
        timestamp: new Date()
      });
      this.addEventLog('🚨 ALARMA: Puerta del portón exterior abierta permanentemente (>60s)', 'alert');
    };
  },

  // ============================================
  // AIRLOCK & READERS
  // ============================================
  setupAirlock() {
    // Process scan button
    document.getElementById('btn-process-scan')?.addEventListener('click', () => {
      this.processScan();
    });

    // Enter key on input
    document.getElementById('airlock-run-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.processScan();
    });

    // Quick reader buttons
    document.querySelectorAll('.reader-btn[data-reader]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const readerId = e.currentTarget.dataset.reader;
        const userSelect = document.getElementById('sim-user-select');
        const run = userSelect?.value;
        if (!run) {
          this.showGlobalAlert('warning', 'fa-exclamation', 'Seleccione un usuario para simular');
          return;
        }
        this.processReaderScan(readerId, run);
      });
    });

    // Force relay buttons (in airlock page)
    document.querySelectorAll('[data-relay][data-action="force"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const relayId = e.currentTarget.dataset.relay;
        if (window.RelaySimulator) {
          const state = window.RelaySimulator.getRelayState(relayId);
          if (state && state.state) {
            window.RelaySimulator.forceCloseRelay(relayId);
            e.currentTarget.innerHTML = '<i class="fa-solid fa-bolt"></i> Force Open';
          } else {
            window.RelaySimulator.forceOpenRelay(relayId);
            e.currentTarget.innerHTML = '<i class="fa-solid fa-xmark"></i> Force Close';
          }
        }
      });
    });
  },

  processScan() {
    const input = document.getElementById('airlock-run-input');
    const reader = document.getElementById('airlock-reader-select');
    const resultMsg = document.getElementById('scan-result-msg');

    if (!input || !reader) return;

    const rawRun = input.value.trim();
    if (!rawRun) {
      resultMsg.textContent = 'Ingrese un RUN para procesar';
      resultMsg.className = 'form-hint error';
      return;
    }

    // Try auto-detect (could be QR/PDF417 raw)
    let parsedRun = rawRun;
    if (window.IDParser && (rawRun.includes('http') || rawRun.length > 20)) {
      const parsed = window.IDParser.autoDetectAndParse(rawRun);
      if (parsed.success) {
        parsedRun = parsed.run;
        resultMsg.textContent = `Parseado desde ${parsed.method}: ${parsed.run}`;
        resultMsg.className = 'form-hint success';
      }
    }

    this.processReaderScan(reader.value, parsedRun);
    input.value = '';
  },

  processReaderScan(readerId, run) {
    if (!window.Analytics) return;

    const resultMsg = document.getElementById('scan-result-msg');
    const cleanRun = window.RUNValidator ? window.RUNValidator.sanitizeRUN(run) : run;
    const user = window.Analytics.getUser(cleanRun);
    const isEnrolled = window.Analytics.isEnrolled(cleanRun);

    if (!isEnrolled) {
      if (resultMsg) {
        resultMsg.innerHTML = `<span style="color:var(--danger); font-weight:700;"><i class="fa-solid fa-lock"></i> ⛔ ACCESO DENEGADO — RUN ${run} NO figura en la lista de enrolados. La Puerta P1 permanece bloqueada.</span>`;
      }
      this.addRelayActivity(`⛔ ACCESO DENEGADO (P1) — RUN ${run} NO ENROLADO`, 'alert');
      this.addEventLog(`⛔ Intento de acceso denegado en P1 — RUN ${run} no enrolado`, 'exit');
      this.showGlobalAlert('danger', 'fa-lock', `⛔ <strong>Acceso Denegado (P1):</strong> RUN <strong>${run}</strong> no enrolado. Puerta P1 BLOQUEADA.`);
      return;
    }

    // Is Enrolled! Log access event and trigger RELAY_1 signal automatically to open Puerta P1!
    window.Analytics.logAccess(cleanRun, 'Ingreso_P1', 'P1_Puerta_Principal', 'RELAY_1');
    window.Analytics.saveToLocalStorage();

    // Automatically trigger Relé 1 (Puerta P1) for 4 seconds
    if (window.RelaySimulator) {
      window.RelaySimulator.activateRelay('RELAY_1', 4000);
    }

    const userName = user ? user.name : cleanRun;
    const formattedRun = window.RUNValidator ? window.RUNValidator.formatRUN(cleanRun) : cleanRun;

    if (resultMsg) {
      resultMsg.innerHTML = `<span style="color:var(--success); font-weight:700;"><i class="fa-solid fa-door-open"></i> 🔓 ACCESO AUTORIZADO — Puerta P1 ABIERTA para <strong>${userName}</strong> (${user.role}). Señal enviada automáticamente a Relé 1.</span>`;
    }

    this.addEventLog(`🔓 <strong>Acceso Autorizado P1</strong> — ${userName} (${formattedRun}) — Señal enviada a Relé 1 (Puerta Abierta)`, 'entry');
    this.addRelayActivity(`🔓 APERTURA P1: ${userName} — Enrolado Válido (${user.role}). Relé 1 Activo (4s)`, 'entry');

    this.showGlobalAlert(
      'success',
      'fa-door-open',
      `🔓 <strong>PUERTA P1 ABIERTA:</strong> Usuario <strong>${userName}</strong> enrolado como ${user.role}. Señal de apertura enviada a Relé 1.`
    );

    // Refresh metrics & dashboard tables
    this.refreshDashboard();
  },

  populateSimUserSelect() {
    const select = document.getElementById('sim-user-select');
    if (!select || !window.Analytics) return;

    const users = window.Analytics.getAllUsers();
    select.innerHTML = users.map(u =>
      `<option value="${u.run}">${u.name} (${window.RUNValidator?.formatRUN(u.run) || u.run}) — ${u.role}</option>`
    ).join('');
  },

  // ============================================
  // CAMERA QR SCANNER (Html5Qrcode)
  // ============================================
  setupCameraScanner() {
    const startBtn = document.getElementById('btn-start-camera-scan');
    const stopBtn = document.getElementById('btn-stop-camera-scan');
    const viewport = document.getElementById('camera-reader-viewport');
    const badge = document.getElementById('camera-status-badge');
    const resultDiv = document.getElementById('camera-scan-result');

    if (!startBtn || !viewport) return;

    let html5QrCode = null;

    startBtn.addEventListener('click', async () => {
      try {
        if (typeof Html5Qrcode === 'undefined') {
          alert('La biblioteca Html5Qrcode se está cargando. Verifique conexión a internet.');
          return;
        }

        viewport.classList.remove('hidden');
        startBtn.classList.add('hidden');
        stopBtn?.classList.remove('hidden');
        if (badge) {
          badge.textContent = '🟢 CÁMARA ESCANEANDO...';
          badge.className = 'card-badge live';
        }

        html5QrCode = new Html5Qrcode("camera-reader-viewport");
        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            console.log(`[Cámara QR] Leído: ${decodedText}`);

            let scannedRun = decodedText;
            if (window.IDParser) {
              const parsed = window.IDParser.autoDetectAndParse(decodedText);
              if (parsed.success) scannedRun = parsed.run;
            }

            if (resultDiv) {
              resultDiv.innerHTML = `<div class="alert-banner info"><i class="fa-solid fa-qrcode"></i> Leído por Cámara Móvil: <strong>${scannedRun}</strong></div>`;
            }

            // Verify and trigger automatic P1 door opening
            this.processReaderScan('L1', scannedRun);
          },
          () => {}
        );
      } catch (err) {
        console.error('[Cámara QR Error]', err);
        alert(`No se pudo acceder a la cámara del dispositivo: ${err.message || err}`);
        viewport.classList.add('hidden');
        startBtn.classList.remove('hidden');
        stopBtn?.classList.add('hidden');
      }
    });

    stopBtn?.addEventListener('click', async () => {
      if (html5QrCode) {
        try { await html5QrCode.stop(); } catch (e) {}
      }
      viewport.classList.add('hidden');
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      if (badge) {
        badge.textContent = 'CÁMARA LISTA';
        badge.className = 'card-badge';
      }
    });
  },

  // ============================================
  // ENROLLMENT
  // ============================================
  setupEnrollment() {
    const form = document.getElementById('enrollment-form');
    const runInput = document.getElementById('enroll-run');
    const indicator = document.getElementById('enroll-run-indicator');

    // Real-time RUN validation
    runInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (!val || !window.RUNValidator) {
        indicator.textContent = '';
        indicator.className = 'run-validation-indicator';
        runInput.classList.remove('valid', 'invalid');
        return;
      }

      const result = window.RUNValidator.validateRUN(val);
      if (result.valid) {
        indicator.innerHTML = '<i class="fa-solid fa-check-circle"></i> RUN válido: ' + result.formatted;
        indicator.className = 'run-validation-indicator valid';
        runInput.classList.add('valid');
        runInput.classList.remove('invalid');
      } else {
        indicator.innerHTML = '<i class="fa-solid fa-times-circle"></i> ' + (result.error || 'RUN inválido');
        indicator.className = 'run-validation-indicator invalid';
        runInput.classList.add('invalid');
        runInput.classList.remove('valid');
      }
    });

    // Form submit
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleEnrollment();
    });
  },

  handleEnrollment() {
    const resultDiv = document.getElementById('enrollment-result');
    const name = document.getElementById('enroll-name')?.value.trim();
    const run = document.getElementById('enroll-run')?.value.trim();
    const role = document.getElementById('enroll-role')?.value;
    const phone = document.getElementById('enroll-phone')?.value.trim();
    const email = document.getElementById('enroll-email')?.value.trim();

    if (!name || !run || !role || !phone || !email) {
      resultDiv.innerHTML = '<div class="alert-banner warning"><i class="fa-solid fa-exclamation"></i> Todos los campos son obligatorios</div>';
      return;
    }

    if (!window.Analytics) return;

    const result = window.Analytics.enrollUser({ name, run, phone, email, role });

    if (result.success) {
      resultDiv.innerHTML = `
        <div class="alert-banner success" style="flex-direction:column; align-items:flex-start; gap:0.5rem;">
          <div>
            <i class="fa-solid fa-check-circle"></i>
            Usuario <strong>${result.user.name}</strong> enrolado exitosamente con RUN ${window.RUNValidator?.formatRUN(result.user.run) || result.user.run}
          </div>
          <button class="btn btn-sm btn-primary" onclick="App.sendQREmailForUser('${result.user.run}')">
            <i class="fa-solid fa-envelope-open-text"></i> Ver Email Enviado con Pase QR
          </button>
        </div>
      `;
      document.getElementById('enrollment-form')?.reset();
      document.getElementById('enroll-run-indicator').textContent = '';
      document.getElementById('enroll-run')?.classList.remove('valid', 'invalid');

      // Update recent enrollments list
      this.addRecentEnrollment(result.user);

      // Save and refresh
      window.Analytics.saveToLocalStorage();
      this.populateSimUserSelect();
      this.refreshDashboard();
    } else {
      resultDiv.innerHTML = `
        <div class="alert-banner danger">
          <i class="fa-solid fa-times-circle"></i>
          ${result.error}
        </div>
      `;
    }
  },

  addRecentEnrollment(user) {
    const container = document.getElementById('recent-enrollments');
    if (!container) return;

    // Clear empty state if present
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const entry = document.createElement('div');
    entry.className = 'event-entry system';
    entry.innerHTML = `
      <span class="event-time">${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
      <div class="event-icon"><i class="fa-solid fa-user-plus"></i></div>
      <span class="event-text">
        <strong>${user.name}</strong> — ${user.role} — ${window.RUNValidator?.formatRUN(user.run) || user.run}
      </span>
    `;
    container.insertBefore(entry, container.firstChild);
  },

  // ============================================
  // SCANNER / ID PARSER
  // ============================================
  setupScanner() {
    // Tab switching
    document.querySelectorAll('[data-scanner-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-scanner-tab]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Parse button
    document.getElementById('btn-parse-id')?.addEventListener('click', () => {
      this.parseIDCard();
    });

    // Clear button
    document.getElementById('btn-clear-scanner')?.addEventListener('click', () => {
      document.getElementById('scanner-raw-input').value = '';
      document.getElementById('scanner-result').innerHTML = '';
    });

    // Test examples
    document.querySelectorAll('.test-example').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const example = e.currentTarget.dataset.example;
        document.getElementById('scanner-raw-input').value = example;
        this.parseIDCard();
      });
    });
  },

  parseIDCard() {
    const input = document.getElementById('scanner-raw-input');
    const resultDiv = document.getElementById('scanner-result');
    const activeTab = document.querySelector('[data-scanner-tab].active')?.dataset.scannerTab || 'auto';

    if (!input || !resultDiv || !window.IDParser) return;

    const raw = input.value.trim();
    if (!raw) {
      resultDiv.innerHTML = '<div class="alert-banner warning"><i class="fa-solid fa-exclamation"></i> Ingrese un string para parsear</div>';
      return;
    }

    let result;
    if (activeTab === 'qr') {
      result = window.IDParser.parseQRFront(raw);
    } else if (activeTab === 'pdf417') {
      result = window.IDParser.parsePDF417(raw);
    } else {
      result = window.IDParser.autoDetectAndParse(raw);
    }

    if (result.success) {
      const validation = window.RUNValidator ? window.RUNValidator.validateRUN(result.run) : null;
      const isEnrolled = window.Analytics ? window.Analytics.isEnrolled(result.run) : false;

      resultDiv.innerHTML = `
        <div class="alert-banner success">
          <i class="fa-solid fa-check-circle"></i>
          <div>
            <strong>RUN extraído exitosamente</strong><br>
            <span class="text-mono" style="font-size:1.1rem;">${validation ? validation.formatted : result.run}</span><br>
            <span style="font-size:0.75rem;">
              Método: ${result.method} | 
              Validación Módulo 11: ${validation?.valid ? '✅ Válido' : '❌ Inválido'} |
              Enrolado: ${isEnrolled ? '✅ Sí' : '❌ No'}
            </span>
          </div>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="alert-banner danger">
          <i class="fa-solid fa-times-circle"></i>
          No se pudo extraer el RUN del string proporcionado. ${result.error || ''}
        </div>
      `;
    }
  },

  // ============================================
  // HARDWARE CONFIG
  // ============================================
  setupHardware() {
    // Save config
    document.getElementById('btn-save-hw')?.addEventListener('click', () => {
      if (!window.RelaySimulator) return;
      const config = {
        ip: document.getElementById('hw-ip')?.value,
        port: parseInt(document.getElementById('hw-port')?.value),
        subnet: document.getElementById('hw-subnet')?.value,
        gateway: document.getElementById('hw-gateway')?.value,
        protocol: document.getElementById('hw-protocol')?.value
      };
      window.RelaySimulator.updateControllerConfig(config);
      document.getElementById('hw-result').textContent = '✅ Configuración guardada exitosamente';
      document.getElementById('hw-result').className = 'form-hint success';
    });

    // Ping
    document.getElementById('btn-ping-hw')?.addEventListener('click', () => {
      if (!window.RelaySimulator) return;
      const result = window.RelaySimulator.pingController();
      const resultEl = document.getElementById('hw-result');
      if (result.success) {
        resultEl.textContent = `✅ Ping exitoso — Latencia: ${result.latency}ms`;
        resultEl.className = 'form-hint success';
      } else {
        resultEl.textContent = `❌ Sin respuesta — Controladora desconectada`;
        resultEl.className = 'form-hint error';
      }
    });

    // Test relay buttons
    ['1', '2', '3'].forEach(num => {
      document.getElementById(`btn-test-relay-${num}`)?.addEventListener('click', () => {
        if (window.RelaySimulator) {
          window.RelaySimulator.activateRelay(`RELAY_${num}`, 3000);
          this.addEventLog(`Test: Relé ${num} activado por 3 segundos`, 'system');
        }
      });
    });

    // Force batch sync
    document.getElementById('btn-force-batch-sync')?.addEventListener('click', async () => {
      if (!window.Analytics) return;
      const progressFill = document.getElementById('sync-progress-fill');
      const btn = document.getElementById('btn-force-batch-sync');
      btn.disabled = true;

      await window.Analytics.syncOfflineQueue((progress) => {
        if (progressFill) progressFill.style.width = `${progress}%`;
      });

      setTimeout(() => {
        if (progressFill) progressFill.style.width = '0%';
        btn.disabled = false;
        this.refreshDashboard();
        this.showGlobalAlert('success', 'fa-check-circle', 'Sincronización completada — Todos los datos se han subido');
      }, 500);
    });

    // Export data
    document.getElementById('btn-export-data')?.addEventListener('click', () => {
      if (!window.Analytics) return;
      const data = window.Analytics.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valtek-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  },

  // ============================================
  // ALERTS
  // ============================================
  setupAlerts() {
    document.getElementById('btn-clear-alerts')?.addEventListener('click', () => {
      this.activeAlerts = [];
      this.alertCount = 0;
      this.updateAlertBadge();
      if (window.AntiPassback) window.AntiPassback.clearAlerts();
      this.renderAlerts();
    });
  },

  renderAlerts() {
    const container = document.getElementById('alerts-log');
    if (!container) return;

    if (this.activeAlerts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-shield-check"></i>
          <h3>Sin alertas</h3>
          <p>No se han registrado alertas de seguridad</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.activeAlerts.map(alert => {
      const time = alert.timestamp ? alert.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
      return `
        <div class="event-entry alert">
          <span class="event-time">${time}</span>
          <div class="event-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <span class="event-text">
            ${alert.type === 'door_alarm' ? '🚨 ' : '⚠️ '}
            <strong>${alert.type === 'door_alarm' ? 'SENSOR PUERTA' : 'ANTI-PASSBACK'}</strong>: 
            ${alert.message || alert.reason || 'Alerta de seguridad'}
            ${alert.run ? `<br><span class="text-mono" style="font-size:0.72rem;">RUN: ${alert.run}</span>` : ''}
          </span>
        </div>
      `;
    }).reverse().join('');
  },

  updateAlertBadge() {
    const badge = document.getElementById('alerts-badge');
    if (badge) {
      if (this.alertCount > 0) {
        badge.style.display = 'inline';
        badge.textContent = this.alertCount;
      } else {
        badge.style.display = 'none';
      }
    }
  },

  // ============================================
  // USERS LIST
  // ============================================
  renderEnrolledUsers(filter = '') {
    if (!window.Analytics) return;

    const tbody = document.getElementById('enrolled-users-tbody');
    const badge = document.getElementById('enrolled-count-badge');
    if (!tbody) return;

    const users = window.Analytics.getAllUsers();
    const filterLower = filter.toLowerCase();

    const filtered = users.filter(u =>
      !filter ||
      u.name.toLowerCase().includes(filterLower) ||
      u.run.toLowerCase().includes(filterLower)
    );

    if (badge) badge.textContent = `${users.length} registrados`;

    tbody.innerHTML = filtered.map(user => {
      const roleClass = user.role ? user.role.toLowerCase() : 'visita';
      const formattedRun = window.RUNValidator ? window.RUNValidator.formatRUN(user.run) : user.run;
      const enrolledDate = user.enrolledAt ? new Date(user.enrolledAt).toLocaleDateString('es-CL') : 'N/A';

      return `
        <tr>
          <td><strong style="color:var(--text-primary)">${user.name}</strong></td>
          <td><span class="text-mono" style="font-size:0.78rem;">${formattedRun}</span></td>
          <td><span class="role-badge ${roleClass}">${user.role}</span></td>
          <td>${user.phone || 'N/A'}</td>
          <td>${user.email || 'N/A'}</td>
          <td><span style="font-size:0.75rem;">${enrolledDate}</span></td>
          <td>
            <button class="btn btn-sm btn-secondary" style="margin-right:4px;" title="Ver/Enviar Email con QR" onclick="App.sendQREmailForUser('${user.run}')">
              <i class="fa-solid fa-envelope"></i> QR
            </button>
            <button class="btn btn-sm btn-danger btn-icon" title="Eliminar" onclick="App.removeUser('${user.run}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">No se encontraron usuarios</td></tr>`;
    }

    // Setup search
    document.getElementById('search-all-users')?.addEventListener('input', (e) => {
      this.renderEnrolledUsers(e.target.value);
    });
  },

  removeUser(run) {
    if (!window.Analytics) return;
    if (!confirm(`¿Eliminar usuario con RUN ${run}?`)) return;

    window.Analytics.removeUser(run);
    window.Analytics.saveToLocalStorage();
    this.renderEnrolledUsers();
    this.populateSimUserSelect();
    this.refreshDashboard();
  },

  // ============================================
  // OFFLINE TOGGLE
  // ============================================
  setupOfflineToggle() {
    const toggle = document.getElementById('toggle-offline');
    toggle?.addEventListener('change', (e) => {
      const isOffline = e.target.checked;
      if (window.Analytics) {
        window.Analytics.setOnlineStatus(!isOffline);
      }

      const dot = document.getElementById('connection-dot');
      const label = document.getElementById('connection-label');
      const controllerDot = document.getElementById('hw-controller-dot');
      const controllerStatus = document.getElementById('hw-controller-status');

      if (isOffline) {
        dot.className = 'status-dot offline';
        label.textContent = 'Sistema Offline';
        if (controllerDot) controllerDot.className = 'status-dot offline';
        if (controllerStatus) controllerStatus.textContent = 'Desconectada';
        this.showGlobalAlert('danger', 'fa-wifi-slash',
          'Conexión perdida — Los eventos se encolarán localmente y se sincronizarán al reconectar',
          'offline-alert'
        );
        if (window.RelaySimulator) {
          window.RelaySimulator.updateControllerConfig({ connected: false });
        }
      } else {
        dot.className = 'status-dot online';
        label.textContent = 'Sistema Online';
        if (controllerDot) controllerDot.className = 'status-dot online';
        if (controllerStatus) controllerStatus.textContent = 'Conectada';
        this.removeGlobalAlert('offline-alert');
        if (window.RelaySimulator) {
          window.RelaySimulator.updateControllerConfig({ connected: true });
        }

        // Auto-sync if there are pending items
        const pending = window.Analytics?.getOfflineQueueSize() || 0;
        if (pending > 0) {
          this.showGlobalAlert('info', 'fa-cloud-arrow-up',
            `Reconexión detectada — ${pending} eventos pendientes de sincronización`
          );
        }
      }
      this.refreshDashboard();
    });
  },

  // ============================================
  // EVENT LOG (Dashboard)
  // ============================================
  addEventLog(text, type = 'system') {
    const container = document.getElementById('event-log');
    if (!container) return;

    // Clear empty state
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const iconMap = {
      entry: 'fa-right-to-bracket',
      exit: 'fa-right-from-bracket',
      alert: 'fa-triangle-exclamation',
      system: 'fa-gear'
    };

    const entry = document.createElement('div');
    entry.className = `event-entry ${type}`;
    entry.innerHTML = `
      <span class="event-time">${time}</span>
      <div class="event-icon"><i class="fa-solid ${iconMap[type] || 'fa-gear'}"></i></div>
      <span class="event-text">${text}</span>
    `;

    container.insertBefore(entry, container.firstChild);

    // Keep max 50 entries
    while (container.children.length > 50) {
      container.removeChild(container.lastChild);
    }
  },

  addRelayActivity(text, type = 'system') {
    const container = document.getElementById('relay-activity-log');
    if (!container) return;

    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const iconMap = {
      entry: 'fa-right-to-bracket',
      exit: 'fa-right-from-bracket',
      alert: 'fa-triangle-exclamation',
      system: 'fa-bolt'
    };

    const entry = document.createElement('div');
    entry.className = `event-entry ${type}`;
    entry.innerHTML = `
      <span class="event-time">${time}</span>
      <div class="event-icon"><i class="fa-solid ${iconMap[type] || 'fa-bolt'}"></i></div>
      <span class="event-text">${text}</span>
    `;

    container.insertBefore(entry, container.firstChild);

    while (container.children.length > 30) {
      container.removeChild(container.lastChild);
    }
  },

  // ============================================
  // GLOBAL ALERTS
  // ============================================
  showGlobalAlert(type, icon, message, id = null) {
    const container = document.getElementById('global-alerts-container');
    if (!container) return;

    // Remove existing alert with same id
    if (id) {
      const existing = document.getElementById(id);
      if (existing) existing.remove();
    }

    const alertEl = document.createElement('div');
    alertEl.className = `alert-banner ${type}${type === 'danger' ? ' door-alarm-banner' : ''}`;
    if (id) alertEl.id = id;
    alertEl.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${message}</span>
      <button class="alert-close" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    `;

    container.appendChild(alertEl);

    // Auto-remove after 10 seconds (except door alarm)
    if (type !== 'danger' && !id) {
      setTimeout(() => alertEl.remove(), 10000);
    }
  },

  removeGlobalAlert(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  },

  // ============================================
  // EMAIL & QR CODE PASS MODAL
  // ============================================
  setupEmailModal() {
    // Quick triggers for P1 (Juan Pérez)
    document.getElementById('btn-send-qr-p1')?.addEventListener('click', () => {
      this.sendQREmailForUser('12345678-5');
    });

    document.getElementById('btn-quick-send-p1')?.addEventListener('click', () => {
      this.sendQREmailForUser('12345678-5');
    });

    // Close buttons
    const closeBtn = document.getElementById('modal-email-close');
    const closeFooter = document.getElementById('btn-modal-close-footer');
    const modalBackdrop = document.getElementById('modal-email-qr');

    const closeModal = () => modalBackdrop?.classList.add('hidden');

    closeBtn?.addEventListener('click', closeModal);
    closeFooter?.addEventListener('click', closeModal);
    modalBackdrop?.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });

    // Resend email button
    document.getElementById('btn-modal-resend')?.addEventListener('click', () => {
      const currentRun = document.getElementById('pass-user-run')?.dataset.run || '12345678-5';
      this.sendQREmailForUser(currentRun, true);
    });
  },

  sendQREmailForUser(run, isResend = false) {
    if (!run) run = '12345678-5';

    // Retrieve user from Analytics or default to P1 (Juan Pérez)
    let user = window.Analytics ? window.Analytics.getUser(run) : null;
    if (!user && (run.includes('12345678') || run === 'P1' || run === 'p1')) {
      user = {
        name: 'Juan Pérez González',
        run: '12345678-5',
        email: 'juan.perez@colegio.cl',
        phone: '+56 9 1234 5678',
        role: 'Alumno'
      };
    } else if (!user) {
      user = {
        name: 'Usuario P1 (Demo)',
        run: run,
        email: 'usuario@colegio.cl',
        phone: '+56 9 1234 5678',
        role: 'Alumno'
      };
    }

    const cleanRun = window.RUNValidator ? window.RUNValidator.sanitizeRUN(user.run) : user.run.replace(/[^0-9kK]/g, '');
    const formattedRun = window.RUNValidator ? window.RUNValidator.formatRUN(user.run) : user.run;

    // Generate QR Code image URL via QRServer API
    const qrData = `https://portal.sidiv.registrocivil.cl/docstatus?RUN=${cleanRun}&type=CI`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

    // Update Email Modal fields
    const toEl = document.getElementById('email-to-val');
    const greetingEl = document.getElementById('email-greeting');
    const passNameEl = document.getElementById('pass-user-name');
    const passRunEl = document.getElementById('pass-user-run');
    const passEmailEl = document.getElementById('pass-user-email');
    const passRoleEl = document.getElementById('pass-role-badge');
    const qrImgEl = document.getElementById('pass-qr-img');

    if (toEl) toEl.textContent = `${user.name} <${user.email}>`;
    if (greetingEl) greetingEl.textContent = `Estimado(a) ${user.name},`;
    if (passNameEl) passNameEl.textContent = user.name;
    if (passRunEl) {
      passRunEl.textContent = `RUN: ${formattedRun}`;
      passRunEl.dataset.run = user.run;
    }
    if (passEmailEl) passEmailEl.textContent = user.email;
    if (passRoleEl) passRoleEl.textContent = (user.role || 'ALUMNO').toUpperCase();
    if (qrImgEl) {
      qrImgEl.src = qrUrl;
    }

    // Attach simulation scan buttons in email modal
    const scanL1Btn = document.getElementById('btn-modal-scan-l1');

    if (scanL1Btn) {
      scanL1Btn.onclick = () => {
        document.getElementById('modal-email-qr')?.classList.add('hidden');
        this.switchView('airlock');
        const input = document.getElementById('airlock-run-input');
        if (input) input.value = user.run;
        this.processReaderScan('L1', user.run);
      };
    }

    // Show Global Alert banner
    const actionText = isResend ? 'Reenviado' : 'Enviado con éxito';
    this.addGlobalAlert(
      'success',
      `📧 <strong>Email con Código QR (${actionText}):</strong> Pase Digital entregado a <strong>${user.email}</strong> para ${user.name} (${formattedRun}).`,
      'fa-paper-plane'
    );

    // Open Modal
    document.getElementById('modal-email-qr')?.classList.remove('hidden');
  }
};

// ============================================
// INIT ON DOM READY
// ============================================
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
