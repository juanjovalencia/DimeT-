// Spanish Word Lists (160 Nouns + 160 Adjectives)
// Total combinations: 160 * 160 = 25,600 (0.0039% guess probability)
const NOUNS = [
  "Cóndor", "Puma", "Sol", "Río", "Cerro", "Árbol", "Mar", "Luna", "Valle", "Fuego",
  "Bosque", "Viento", "Cielo", "Luz", "Tierra", "Playa", "Nube", "Estrella", "Flor", "Pez",
  "Canto", "Sendero", "Monte", "Humedal", "Brisa", "Copihue", "Girasol", "Volcán", "Faro", "Trigo",
  "Arena", "Roca", "Isla", "Lago", "Ola", "Selva", "Cueva", "Nieve", "Glaciar", "Desierto",
  "Oasis", "Prado", "Huerto", "Campo", "Jardín", "Semilla", "Fruta", "Hoja", "Raíz", "Puente",
  "Camino", "Llave", "Timón", "Brújula", "Reloj", "Cofre", "Espejo", "Libro", "Pluma", "Vela",
  "Campana", "Ancla", "Nido", "Refugio", "Cabaña", "Taller", "Molino", "Pozo", "Puerta", "Ventana",
  "Rueda", "Red", "Hilo", "Escudo", "Corona", "Trono", "Delfín", "Gato", "Perro", "Zorro",
  "Cisne", "Halcón", "Águila", "Búho", "Garza", "Tortuga", "Caballo", "Oveja", "León", "Tigre",
  "Oso", "Ballena", "Colibrí", "Llama", "Alpaca", "Liebre", "Ciervo", "Carpintero", "Queltehue", "Huemul",
  "Pudú", "Trineo", "Castillo", "Torre", "Muralla", "Portal", "Quebrada", "Cascada", "Arroyo", "Vertiente",
  "Laguna", "Bahía", "Península", "Cabo", "Acantilado", "Duna", "Pradera", "Pampa", "Cordillera", "Nevado",
  "Cumbre", "Pico", "Loma", "Llanura", "Estero", "Pantano", "Parque", "Invernadero", "Parra", "Olivo",
  "Manzano", "Peral", "Limonero", "Naranjo", "Almendro", "Nogal", "Cactus", "Helecho", "Musgo", "Alga",
  "Coral", "Caracol", "Cangrejo", "Pulpo", "Lobo", "Foca", "Pingüino", "Pelícano", "Gaviota", "Albatros",
  "Chinchilla", "Guanaco", "GatoAndino", "MonitoDelMonte", "Quique", "Vizcacha", "Yeco", "Bandurria", "Loica", "Chucao"
];

const ADJECTIVES = [
  "Azul", "Verde", "Dorado", "Claro", "Rápido", "Fuerte", "Alegre", "Tranquilo", "Cálido", "Brillante",
  "Fresco", "Libre", "Noble", "Eterno", "Fiel", "Seguro", "Firme", "Hermoso", "Silencioso", "Puro",
  "Valiente", "Sabio", "Altivo", "Profundo", "Blanco", "Rojo", "Gris", "Plácido", "Sereno", "Fecundo",
  "Amarillo", "Negro", "Violeta", "Naranja", "Rosado", "Marrón", "Celeste", "Turquesa", "Plateado", "Bronceado",
  "Luminoso", "Oscuro", "Opaco", "Tenue", "Intenso", "Suave", "Áspero", "Liso", "Rugoso", "Caliente",
  "Helado", "Tibio", "Seco", "Húmedo", "Mojado", "Lluvioso", "Soleado", "Nublado", "Ventoso", "Calmo",
  "Agitado", "Lento", "Veloz", "Pesado", "Ligero", "Grande", "Pequeño", "Gigante", "Diminuto", "Alto",
  "Bajo", "Ancho", "Estrecho", "Largo", "Corto", "Grueso", "Delgado", "Liviano", "Nuevo", "Viejo",
  "Antiguo", "Moderno", "Joven", "Anciano", "Rico", "Pobre", "Abundante", "Escaso", "Lleno", "Vacío",
  "Limpio", "Sucio", "Ordenado", "Desordenado", "Fácil", "Difícil", "Sencillo", "Complejo", "Dulce", "Salado",
  "Amargo", "Ácido", "Picante", "Sabroso", "Aromático", "Perfumado", "Oloroso", "Ruidoso", "Melódico", "Armonioso",
  "Agradable", "Placentero", "Cómodo", "Incómodo", "Útil", "Inútil", "Valioso", "Barato", "Caro", "Precioso",
  "Fino", "Común", "Raro", "Extraño", "Mágico", "Misterioso", "Secreto", "Oculto", "Visible", "Invisible",
  "Redondo", "Cuadrado", "Triangular", "Recto", "Curvo", "Inclinado", "Plano", "Espacioso", "Sano", "Débil",
  "Ágil", "Robusto", "Delicado", "Protegido", "Peligroso", "Acogedor", "Sincero", "Honesto", "Justo", "Amable",
  "Brillante", "Radiante", "Majestuoso", "Supremo", "Leal", "Generoso", "Atento", "Paciente", "Dócil", "Vigilante"
];

// Helper to format Date objects as YYYY-MM-DD
function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Simple deterministic string hashing (Polynomial Rolling Hash)
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 1000000007;
  }
  return hash;
}

// Generate the daily word combination based on a specific date
function getWordForDate(date) {
  const dateStr = formatDate(date);
  const hash = hashString(dateStr);
  
  const nounIndex = hash % NOUNS.length;
  // Use a different hash salt for the adjective to prevent correlation
  const adjHash = hashString(dateStr + "-salt");
  const adjIndex = adjHash % ADJECTIVES.length;
  
  return {
    noun: NOUNS[nounIndex],
    adjective: ADJECTIVES[adjIndex],
    combination: `${NOUNS[nounIndex]} ${ADJECTIVES[adjIndex]}`
  };
}

// Global Application State Manager
const AppState = {
  currentDate: new Date(),
  correctPin: "1234",
  inputPin: "",
  biometricsFailSimulated: false,
  remoteAccessDetected: false,
  isCallActive: false,
  callStep: 0,
  
  init() {
    // Synchronize simulator inputs on load in case browser cached them
    this.biometricsFailSimulated = document.getElementById('biometrics-fail').checked;
    this.remoteAccessDetected = document.getElementById('remote-control').checked;
    
    this.renderWords();
    this.setupEventListeners();
    this.showScreen('state-lock');
  },
  
  // Get word of the simulated date
  getDailyWord() {
    return getWordForDate(this.currentDate);
  },
  
  // Render calculated word details across the dashboard and executive console
  renderWords() {
    const word = this.getDailyWord();
    
    // Client view elements
    document.getElementById('client-word').innerText = word.combination;
    
    // Executive console elements
    document.getElementById('exec-word-display').innerText = word.combination;
    document.getElementById('exec-word-date').innerText = formatDate(this.currentDate);
    
    // SMS / Email text updates
    const formattedDate = formatDate(this.currentDate);
    document.getElementById('sms-content-text').innerHTML = `
      <span class="sms-header-prefix">DimeTú: ${word.combination}</span>Banco de Chile informa: Se ha programado una transferencia de $150.000 a la cuenta *8932. Si no la realizó, llame al 600 637 3000.
    `;
    document.getElementById('sms-time-stamp').innerText = `${formattedDate} 15:34`;
    
    document.getElementById('email-subject-text').innerText = `[DimeTú: ${word.combination}] Notificación de Ingreso a tu Banca en Línea`;
    document.getElementById('email-date-text').innerText = `${formattedDate} 15:34`;
    document.getElementById('email-badge-word').innerText = word.combination;
  },
  
  // Navigation helper for phone screen states
  showScreen(screenId) {
    // Hide all states
    document.querySelectorAll('.screen-state').forEach(el => el.classList.remove('active'));
    
    // Remote control active security takes absolute precedence
    if (this.remoteAccessDetected) {
      document.getElementById('state-remote-blocked').classList.add('active');
      return;
    }
    
    document.getElementById(screenId).classList.add('active');
  },
  
  // Event registration
  setupEventListeners() {
    // Face ID area simulation trigger
    const faceidScanner = document.getElementById('faceid-scanner');
    faceidScanner.addEventListener('click', () => this.triggerBiometricAuth());
    
    // Fallback to PIN trigger button
    document.getElementById('fallback-to-pin-btn').addEventListener('click', () => {
      this.inputPin = "";
      this.updatePinDots();
      this.showScreen('state-pin');
    });
    
    // PIN pad keys
    document.querySelectorAll('.pin-key').forEach(key => {
      key.addEventListener('click', (e) => {
        const val = e.currentTarget.dataset.val;
        if (val === 'clear') {
          this.inputPin = "";
          this.updatePinDots();
        } else if (val) {
          if (this.inputPin.length < 4) {
            this.inputPin += val;
            this.updatePinDots();
            if (this.inputPin.length === 4) {
              // Check PIN after tiny delay for visual effect
              setTimeout(() => this.verifyPIN(), 250);
            }
          }
        }
      });
    });
    
    // Back from PIN screen to Lock screen
    document.getElementById('back-to-lock-btn').addEventListener('click', () => {
      this.showScreen('state-lock');
    });
    
    // Reveal daily code button (Verify)
    document.getElementById('verify-trigger').addEventListener('click', () => {
      document.getElementById('verify-trigger').style.display = 'none';
      document.getElementById('word-result-card').classList.add('visible');
      this.logSystemEvent("Cliente reveló la contra-clave en la aplicación.");
    });
    
    // Text-To-Speech audio reader button
    document.getElementById('audio-speaker-btn').addEventListener('click', () => this.speakWordOutLoud());
    
    // Lock app back manually
    document.getElementById('lock-app-manual').addEventListener('click', () => {
      // Re-lock app
      document.getElementById('word-result-card').classList.remove('visible');
      document.getElementById('verify-trigger').style.display = 'flex';
      this.showScreen('state-lock');
      this.logSystemEvent("Aplicación bloqueada manualmente.");
    });
    
    // Open History Screen
    document.getElementById('open-history-btn').addEventListener('click', () => {
      this.populateHistory();
      this.showScreen('state-history');
    });
    
    // Back from History to Dashboard
    document.getElementById('back-to-dash-btn').addEventListener('click', () => {
      this.showScreen('state-dashboard');
    });
    
    // SIMULATOR CONTROLS (Right Panel)
    
    // Toggle Biometrics Failure Simulation
    document.getElementById('biometrics-fail').addEventListener('change', (e) => {
      this.biometricsFailSimulated = e.currentTarget.checked;
    });
    
    // Toggle Remote Control App Detection
    document.getElementById('remote-control').addEventListener('change', (e) => {
      this.remoteAccessDetected = e.currentTarget.checked;
      if (this.remoteAccessDetected) {
        this.logSystemEvent("ALERTA: Se detectó ejecución de AnyDesk en segundo plano.");
        this.showScreen('state-remote-blocked');
      } else {
        this.logSystemEvent("Seguridad: Software de control remoto cerrado. Desbloqueando app.");
        // Returns to lock screen
        this.showScreen('state-lock');
      }
    });
    
    // Tab switching for SMS / Email simulator
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabTarget = e.currentTarget.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        e.target.classList.add('active');
        document.getElementById(`tab-${tabTarget}`).classList.add('active');
      });
    });
    
    // Call Center: Dial Call Simulator
    document.getElementById('dial-client-btn').addEventListener('click', () => this.toggleCallSimulation());
    
    // Call Center Script Action Buttons
    document.getElementById('script-action-next').addEventListener('click', () => this.advanceCallScript());
    document.getElementById('script-action-reset').addEventListener('click', () => this.resetCallScript());
    
    // Date Shifter Control (Testing future/past words)
    document.getElementById('sim-date-shift').addEventListener('change', (e) => {
      const shiftDays = parseInt(e.target.value, 10);
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + shiftDays);
      this.currentDate = newDate;
      
      this.renderWords();
      this.logSystemEvent(`Simulador: Fecha desplazada a ${formatDate(this.currentDate)}`);
    });
  },
  
  // Simulate Face ID / Fingerprint Auth scanning
  triggerBiometricAuth() {
    const scanner = document.getElementById('faceid-scanner');
    const statusText = document.getElementById('biometric-status-msg');
    
    // Prevent double clicking while scanning
    if (scanner.classList.contains('scanning') || scanner.classList.contains('success')) return;
    
    scanner.className = 'faceid-scanner scanning';
    statusText.innerText = "Escaneando rostro...";
    this.logSystemEvent("Autenticación biométrica iniciada (Face ID/Huella)...");
    
    setTimeout(() => {
      if (this.biometricsFailSimulated) {
        // Fail biometrics
        scanner.className = 'faceid-scanner error';
        statusText.innerHTML = `<span style="color:var(--danger)">Huella o rostro no reconocidos</span>`;
        this.logSystemEvent("Autenticación biométrica fallida. Solicitando PIN de respaldo.");
        
        // Auto navigate to PIN after 1.2 seconds
        setTimeout(() => {
          scanner.className = 'faceid-scanner';
          statusText.innerText = "Presione el icono para ingresar";
          this.inputPin = "";
          this.updatePinDots();
          this.showScreen('state-pin');
        }, 1200);
      } else {
        // Success biometrics
        scanner.className = 'faceid-scanner success';
        statusText.innerHTML = `<span style="color:var(--success)">¡Autenticado con éxito!</span>`;
        this.logSystemEvent("Autenticación biométrica exitosa.");
        
        setTimeout(() => {
          scanner.className = 'faceid-scanner';
          statusText.innerText = "Presione el icono para ingresar";
          this.showScreen('state-dashboard');
        }, 800);
      }
    }, 1500);
  },
  
  // Update visual dots on PIN screen
  updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
      dot.className = 'pin-dot';
      if (idx < this.inputPin.length) {
        dot.classList.add('filled');
      }
    });
  },
  
  // Check Pin code matching
  verifyPIN() {
    const dots = document.querySelectorAll('.pin-dot');
    
    if (this.inputPin === this.correctPin) {
      this.logSystemEvent("PIN verificado con éxito.");
      this.showScreen('state-dashboard');
    } else {
      // Show error feedback
      this.logSystemEvent("Error: PIN de dispositivo incorrecto.");
      dots.forEach(dot => dot.classList.add('error'));
      
      setTimeout(() => {
        this.inputPin = "";
        this.updatePinDots();
      }, 500);
    }
  },
  
  // Web Speech synthesis to vocalize the daily combination
  speakWordOutLoud() {
    const word = this.getDailyWord().combination;
    
    if ('speechSynthesis' in window) {
      // Cancel any current speaking
      window.speechSynthesis.cancel();
      
      const textToSpeak = `La contra-clave de hoy es: ${word}. Repito. ${word}.`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'es-CL'; // Chilean Spanish
      utterance.rate = 0.8;    // Slightly slower rate for elderly accessibility
      utterance.pitch = 1.0;
      
      window.speechSynthesis.speak(utterance);
      this.logSystemEvent("Lector de voz activado.");
    } else {
      alert("La lectura por voz no está disponible en este navegador.");
    }
  },
  
  // Generate 7-day word history deterministically
  populateHistory() {
    const listContainer = document.getElementById('history-list-container');
    listContainer.innerHTML = "";
    
    const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    
    for (let i = 0; i < 7; i++) {
      const histDate = new Date(this.currentDate);
      histDate.setDate(this.currentDate.getDate() - i);
      
      const wordObj = getWordForDate(histDate);
      const isToday = i === 0;
      
      // Calculate readable title
      let dayLabel = "";
      if (isToday) dayLabel = "Hoy (Actual)";
      else if (i === 1) dayLabel = "Ayer";
      else dayLabel = weekdays[histDate.getDay()];
      
      const formattedDate = formatDate(histDate);
      
      const historyItem = document.createElement('div');
      historyItem.className = `history-item ${isToday ? 'today' : ''}`;
      historyItem.innerHTML = `
        <div class="history-date-info">
          <span class="history-date">${formattedDate}</span>
          <span class="history-label">${dayLabel}</span>
        </div>
        <span class="history-word">${wordObj.combination}</span>
      `;
      
      listContainer.appendChild(historyItem);
    }
  },
  
  // Log event text into the operator console log
  logSystemEvent(msg, type = "system") {
    const logContainer = document.getElementById('script-logs');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.innerHTML = `<strong>[${time}]</strong> ${msg}`;
    
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  },
  
  // CALL CENTER OPERATOR SIMULATION
  
  toggleCallSimulation() {
    const dialBtn = document.getElementById('dial-client-btn');
    const nextBtn = document.getElementById('script-action-next');
    
    if (this.isCallActive) {
      // Hang up
      this.isCallActive = false;
      this.callStep = 0;
      dialBtn.innerHTML = `<i class="fas fa-phone-alt"></i> Llamar Cliente`;
      dialBtn.className = "call-btn";
      nextBtn.disabled = true;
      this.logSystemEvent("Llamada finalizada por el ejecutivo.", "system");
      document.getElementById('exec-call-status').innerText = "Inactiva";
      document.getElementById('exec-call-status').style.color = "var(--text-secondary)";
    } else {
      // Start calling
      this.isCallActive = true;
      this.callStep = 1;
      dialBtn.innerHTML = `<i class="fas fa-phone-slash"></i> Cortar`;
      dialBtn.className = "call-btn active-call";
      nextBtn.disabled = false;
      
      document.getElementById('exec-call-status').innerText = "Conectada";
      document.getElementById('exec-call-status').style.color = "var(--success)";
      
      // Clear logs and print step 1
      document.getElementById('script-logs').innerHTML = "";
      this.logSystemEvent("Ejecutivo del Banco de Chile inició llamada de contacto.", "system");
      this.logSystemEvent("Ejecutivo: 'Buenas tardes Sr. Juan José, le llamamos del área de seguridad de Banco de Chile. Se ha retenido una transferencia sospechosa de su cuenta por $300.000.'", "executive");
      this.logSystemEvent("Sugerencia del sistema: Para validar, desafíe al ejecutivo preguntando por la palabra del día en DimeTú.", "system");
    }
  },
  
  advanceCallScript() {
    if (!this.isCallActive) return;
    
    const word = this.getDailyWord().combination;
    const nextBtn = document.getElementById('script-action-next');
    
    this.callStep++;
    
    if (this.callStep === 2) {
      this.logSystemEvent("Cliente: 'Mire señorita, hay muchas estafas telefónicas en estos días. Antes de darle ningún dato, ¿me podría decir cuál es la Contra-Clave del día de DimeTú?'", "client");
      this.logSystemEvent("Sugerencia del sistema: El ejecutivo ahora revisa su pantalla de la API del banco y responde.", "system");
    } 
    else if (this.callStep === 3) {
      this.logSystemEvent(`Ejecutivo: 'Claro don Juan José, me parece perfecto su cuidado. Consultando nuestro canal oficial, la palabra del día en DimeTú es "${word}". Por favor verifíquela.'`, "executive");
      this.logSystemEvent("Sugerencia del sistema: En el simulador de celular de la izquierda, inicie sesión con Face ID y presione 'Verificar' para corroborar.", "system");
    } 
    else if (this.callStep === 4) {
      this.logSystemEvent("Cliente: 'A ver, déjeme abrir la aplicación... Sí, efectivamente aquí me figura la palabra del día como \"" + word + "\". Excelente, ahora sé que la llamada es auténtica. Cuénteme del problema.'", "client");
      this.logSystemEvent("Sistema: ¡Identidad verificada exitosamente! Se evitó el fraude y se generó un canal seguro bidireccional.", "system");
      nextBtn.disabled = true;
    }
  },
  
  resetCallScript() {
    document.getElementById('script-logs').innerHTML = "";
    this.isCallActive = false;
    this.callStep = 0;
    
    const dialBtn = document.getElementById('dial-client-btn');
    dialBtn.innerHTML = `<i class="fas fa-phone-alt"></i> Llamar Cliente`;
    dialBtn.className = "call-btn";
    
    document.getElementById('script-action-next').disabled = true;
    document.getElementById('exec-call-status').innerText = "Inactiva";
    document.getElementById('exec-call-status').style.color = "var(--text-secondary)";
    
    this.logSystemEvent("Consola de simulación reseteada.");
  }
};

// Initialize the app once the page is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  AppState.init();
});
