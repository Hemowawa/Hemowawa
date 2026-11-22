document.addEventListener('DOMContentLoaded', () => {
  // Utilidad para notificaciones Toast
  const toast = document.getElementById('toastMessage');
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 4000);
  }

  // Navegación Responsive (Menú hamburguesa)
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  menuToggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', isOpen);
  });

  // Cambio de pestañas por segmento objetivo
  const tabBtns = document.querySelectorAll('.tab-btn');
  const rolePanels = document.querySelectorAll('.role-panel');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      rolePanels.forEach(p => {
        p.classList.remove('active');
        p.hidden = true;
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const target = document.getElementById(`panel-${btn.dataset.role}`);
      target.classList.add('active');
      target.hidden = false;
    });
  });

  // HU-003: Selector de niño activo
  const childSelector = document.getElementById('childSelector');
  childSelector.addEventListener('change', (e) => {
    const [name, months, sup, dose, dur] = e.target.value.split('|');
    document.getElementById('indSup').textContent = sup;
    document.getElementById('indDose').textContent = `${dose} diarias`;
    document.getElementById('indDur').textContent = dur;
    showToast(`Perfil cambiado a ${name} (${months} meses).`);
  });

  // HU-002: Registro del perfil del niño y validación de 6 a 35 meses
  const addChildForm = document.getElementById('addChildForm');
  addChildForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('childName').value.trim();
    const birth = document.getElementById('childBirth').value;
    const weight = document.getElementById('childWeight').value;
    const ageWarning = document.getElementById('ageWarning');

    if (!name || !birth || !weight) {
      showToast('Completa todos los campos obligatorios del niño.');
      return;
    }

    const birthDate = new Date(birth);
    const today = new Date();
    const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());

    if (months < 6 || months > 35) {
      ageWarning.hidden = false;
    } else {
      ageWarning.hidden = true;
    }

    const option = document.createElement('option');
    option.value = `${name}|${Math.max(0, months)}|Sulfato Ferroso|15 gotas|3 meses`;
    option.textContent = `${name} (${Math.max(0, months)} meses)`;
    childSelector.appendChild(option);
    childSelector.value = option.value;
    showToast(`Perfil de ${name} guardado (${Math.max(0, months)} meses).`);
    addChildForm.reset();
  });

  // HU-004, HU-005, HU-006: Actualización de indicación médica
  const indicationForm = document.getElementById('indicationForm');
  indicationForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const sup = document.getElementById('newSup').value;
    const dose = document.getElementById('newDose').value.trim();
    const dur = document.getElementById('newDur').value.trim();

    if (!dose || !dur) {
      showToast('Error: La dosis y la duración son campos obligatorios.');
      return;
    }

    document.getElementById('indSup').textContent = sup;
    document.getElementById('indDose').textContent = dose;
    document.getElementById('indDur').textContent = dur;
    document.getElementById('indUpdated').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    showToast('Indicación de hierro actualizada correctamente.');
    indicationForm.reset();
  });

  // HU-008 & HU-010: Recordatorio diario y posposición
  const reminderTime = document.getElementById('reminderTime');
  const reminderStatus = document.getElementById('reminderStatus');
  reminderTime.addEventListener('change', () => {
    reminderStatus.textContent = `Aviso configurado diariamente a las ${reminderTime.value}.`;
    showToast(`Recordatorio actualizado a las ${reminderTime.value}.`);
  });

  document.getElementById('snoozeBtn').addEventListener('click', () => {
    reminderStatus.textContent = 'Recordatorio pospuesto 30 minutos.';
    showToast('Aviso pospuesto 30 minutos.');
  });

  // HU-011, HU-013, HU-014, HU-035: Registro de dosis con un toque + sincronización con cuidador
  let doseRegistered = false;
  const registerDoseBtn = document.getElementById('registerDoseBtn');
  registerDoseBtn.addEventListener('click', () => {
    if (doseRegistered) {
      showToast('La dosis de hoy ya fue registrada.');
      return;
    }
    doseRegistered = true;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('todayDoseState').textContent = `Registrada hoy (${now})`;
    document.getElementById('heroDoseBadge').textContent = `Dosis diaria: Cumplida (${now})`;
    document.getElementById('heroDoseBadge').className = 'status-pill status-done';
    document.getElementById('caregiverSyncStatus').textContent = `Ya administrada hoy a las ${now} por Madre/Padre (Evita duplicar)`;
    
    // Actualizar KPIs (HU-014) y calendario (HU-013)
    document.getElementById('daysCompleted').textContent = '19';
    document.getElementById('credDays').textContent = '19';
    document.getElementById('adherencePct').textContent = '95%';
    const calToday = document.getElementById('calToday');
    calToday.className = 'day done';
    calToday.textContent = 'S ✓';
    showToast(`¡Dosis registrada a las ${now}! Avisos del día cancelados.`);
  });

  // HU-012 & HU-015: Registro de dosis no administrada y guía de olvido
  document.getElementById('missedDoseToggle').addEventListener('click', () => {
    const form = document.getElementById('missedDoseForm');
    form.hidden = !form.hidden;
  });

  document.getElementById('saveMissedBtn').addEventListener('click', () => {
    const reason = document.getElementById('missedReason').value;
    if (!reason) {
      showToast('Por favor selecciona un motivo antes de guardar.');
      return;
    }
    document.getElementById('todayDoseState').textContent = `No administrada (${reason})`;
    document.getElementById('calToday').className = 'day missed';
    document.getElementById('calToday').textContent = 'S ✕';
    document.getElementById('forgottenGuide').hidden = false;
    showToast('Motivo guardado en el historial.');
  });

  // HU-016: Resumen para control CRED
  document.getElementById('credSummaryBtn').addEventListener('click', () => {
    const modal = document.getElementById('credModal');
    modal.hidden = !modal.hidden;
  });

  // HU-018, HU-019, HU-020: Reporte de molestias y signos de alarma
  document.getElementById('symptomForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = document.getElementById('symptomSelect').value;
    const feedback = document.getElementById('symptomFeedback');
    if (!val) {
      showToast('Selecciona una molestia para recibir orientación.');
      return;
    }
    feedback.hidden = false;
    if (val === 'alarma') {
      feedback.className = 'alert alert-danger mt-1';
      feedback.innerHTML = '<strong>⚠️ SIGNO DE ALARMA DETECTADO (HU-020):</strong> Acude de inmediato al establecimiento de salud más cercano. <em>Esta app no reemplaza la atención médica.</em>';
    } else if (val === 'estreñimiento') {
      feedback.className = 'info-box mt-1';
      feedback.innerHTML = '<strong>Orientación clínica (HU-019):</strong> El estreñimiento leve y las heces oscuras son efectos esperables del hierro. Aumenta el consumo de agua, frutas y verduras sin suspender el suplemento.';
    } else {
      feedback.className = 'info-box mt-1';
      feedback.innerHTML = '<strong>Consejo práctico (HU-021):</strong> Administra el suplemento junto con jugo de naranja o mezclado en 2 cucharadas de comida espesa.';
    }
    showToast('Reporte registrado con fecha y hora.');
  });

  // HU-024 a HU-027: Recetario con filtros y favoritos
  const recipesData = [
    { id: 1, name: 'Puré de zapallo con sangrecita', age: '6-8', ing: 'sangrecita', time: '15 min', cost: 'S/ 3.50', fav: true },
    { id: 2, name: 'Hígado aplastado con papa amarilla', age: '6-8', ing: 'higado', time: '20 min', cost: 'S/ 4.00', fav: false },
    { id: 3, name: 'Guiso picadito de lentejas y pollo', age: '9-11', ing: 'lentejas', time: '25 min', cost: 'S/ 4.50', fav: false },
    { id: 4, name: 'Saltadito de sangrecita con verduras', age: '12-35', ing: 'sangrecita', time: '15 min', cost: 'S/ 4.00', fav: true },
    { id: 5, name: 'Hígado encebollado suave con arroz', age: '12-35', ing: 'higado', time: '20 min', cost: 'S/ 5.00', fav: false },
    { id: 6, name: 'Torrejitas de lentejas ricas en hierro', age: '9-11', ing: 'lentejas', time: '20 min', cost: 'S/ 3.80', fav: false }
  ];

  const recipesGrid = document.getElementById('recipesGrid');
  const noRecipesMsg = document.getElementById('noRecipesMsg');

  function renderRecipes() {
    const ageVal = document.getElementById('filterAge').value;
    const ingVal = document.getElementById('filterIng').value;
    const favVal = document.getElementById('filterFav').value;

    const filtered = recipesData.filter(r => {
      const matchAge = ageVal === 'all' || r.age === ageVal;
      const matchIng = ingVal === 'all' || r.ing === ingVal;
      const matchFav = favVal === 'all' || r.fav;
      return matchAge && matchIng && matchFav;
    });

    recipesGrid.innerHTML = '';
    noRecipesMsg.hidden = filtered.length > 0;

    filtered.forEach(r => {
      const card = document.createElement('div');
      card.className = 'recipe-card';
      card.innerHTML = `
        <div>
          <h4>${r.name}</h4>
          <p class="recipe-meta">Edad: ${r.age} meses • Tiempo: ${r.time} • Costo: ${r.cost}</p>
        </div>
        <button type="button" class="btn btn-outline btn-sm fav-btn" data-id="${r.id}">
          ${r.fav ? '★ Guardada en favoritos' : '☆ Guardar favorita'}
        </button>
      `;
      recipesGrid.appendChild(card);
    });

    document.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recipe = recipesData.find(x => x.id === Number(btn.dataset.id));
        recipe.fav = !recipe.fav;
        renderRecipes();
        showToast(recipe.fav ? 'Receta guardada en favoritos.' : 'Receta quitada de favoritos.');
      });
    });
  }

  ['filterAge', 'filterIng', 'filterFav'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderRecipes);
  });
  renderRecipes();

  // HU-031, HU-034, HU-037: Cuidadores secundarios
  document.getElementById('copyCodeBtn').addEventListener('click', () => {
    navigator.clipboard?.writeText('HEMO-2026-MATEO');
    showToast('Código HEMO-2026-MATEO copiado para compartir.');
  });

  document.getElementById('caregiverDoseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const cname = document.getElementById('caregiverName').value.trim();
    const amount = document.getElementById('doseAmount').value;
    const obs = document.getElementById('caregiverObs').value.trim() || 'Sin observaciones';
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    document.getElementById('caregiverLog').innerHTML = `
      <strong>Notificación enviada a padres (HU-036):</strong><br>
      Responsable: ${cname} • Toma: ${amount} (${now})<br>
      Detalle: ${obs}
    `;
    document.getElementById('caregiverSyncStatus').textContent = `Registrada por ${cname} a las ${now}`;
    showToast(`Registro guardado y notificado a los padres.`);
  });

  // HU-041 a HU-044: Personal de Salud
  const patientsData = [
    { name: 'Ana Torres', age: '14 m', adherence: 86, last: 'Hoy 08:00 a. m.', risk: 'optimo', detail: 'Sin incidencias recientes. Próximo control CRED: 28/11/2026.' },
    { name: 'Luis Mendoza', age: '8 m', adherence: 62, last: 'Hace 4 días', risk: 'riesgo', detail: '⚠️ ALERTA DE POSIBLE ABANDONO (HU-044): 4 días sin registro. Última molestia: Estreñimiento.' },
    { name: 'Sofía Quispe', age: '20 m', adherence: 48, last: 'Hace 6 días', risk: 'riesgo', detail: '⚠️ ALERTA DE POSIBLE ABANDONO (HU-044): 6 días sin registro. Se recomienda visita domiciliaria.' }
  ];

  const patientsTableBody = document.getElementById('patientsTableBody');
  const patientDetailBox = document.getElementById('patientDetailBox');

  function renderPatients() {
    const query = document.getElementById('searchPatient').value.toLowerCase();
    const riskFilter = document.getElementById('filterRisk').value;

    const filtered = patientsData.filter(p => {
      const matchName = p.name.toLowerCase().includes(query);
      const matchRisk = riskFilter === 'all' || p.risk === riskFilter;
      return matchName && matchRisk;
    });

    patientsTableBody.innerHTML = '';
    filtered.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${p.name}</strong></td>
        <td>${p.age}</td>
        <td>${p.adherence}%</td>
        <td>${p.last}</td>
        <td><span class="${p.risk === 'riesgo' ? 'badge-risk' : 'badge-ok'}">${p.risk === 'riesgo' ? 'En riesgo' : 'Al día'}</span></td>
        <td><button type="button" class="btn btn-outline btn-sm view-pat-btn" data-name="${p.name}">Ver detalle</button></td>
      `;
      patientsTableBody.appendChild(tr);
    });

    document.querySelectorAll('.view-pat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pat = patientsData.find(x => x.name === btn.dataset.name);
        patientDetailBox.hidden = false;
        patientDetailBox.innerHTML = `<strong>Expediente de ${pat.name} (${pat.age}):</strong> ${pat.detail}`;
      });
    });
  }

  document.getElementById('searchPatient').addEventListener('input', renderPatients);
  document.getElementById('filterRisk').addEventListener('change', renderPatients);
  renderPatients();

  document.getElementById('linkPatientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('patientCodeInput').value.trim();
    if (!code) {
      showToast('Ingresa un código de vinculación válido.');
      return;
    }
    patientsData.unshift({
      name: 'Mateo Álvarez',
      age: '14 m',
      adherence: 90,
      last: 'Hoy',
      risk: 'optimo',
      detail: 'Paciente recién vinculado con autorización familiar.'
    });
    renderPatients();
    showToast(`Paciente vinculado con código ${code}.`);
    e.target.reset();
  });

  // HU-001: Registro de cuenta
  document.getElementById('registerAccountForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const pass = document.getElementById('regPass').value;
    const regError = document.getElementById('regError');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !email || !phone || pass.length < 8) {
      regError.textContent = 'Completa todos los campos y asegúrate de que la contraseña tenga al menos 8 caracteres.';
      regError.hidden = false;
      return;
    }
    if (!emailRegex.test(email)) {
      regError.textContent = 'Ingresa un correo electrónico con formato válido (ej. nombre@correo.com).';
      regError.hidden = false;
      return;
    }

    regError.hidden = true;
    showToast(`¡Cuenta creada para ${name}! Ahora puedes registrar el perfil de tu hijo.`);
    e.target.reset();
  });
});
