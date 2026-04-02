import { navigate, state } from '../app.js';
import { renderSteps } from './details.js';
import { parseAndMergeFiles } from '../utils/file-parser.js';
import { generateQRDataURL, buildVerifyURL } from '../utils/qr-generator.js';
import { generateHallTicketPDF } from '../utils/pdf-generator.js';
import { supabase } from '../supabase.js';

export async function renderGenerator(container) {
  if (!state.files || state.files.length === 0) {
    navigate('/details');
    return;
  }

  container.innerHTML = `
    <div class="bg-orbs"><div class="orb orb-2"></div></div>
    <div class="page-container">
      ${renderSteps(3)}
      <div style="max-width: 750px; margin: 0 auto;">
        <h1 class="heading-lg text-center animate-in mb-8">
          <span class="text-gradient">Configure & Generate</span>
        </h1>
        <p class="text-secondary text-center animate-in animate-in-delay-1 mb-24">
          Set up batch configuration and generate hall tickets.
        </p>
        <div id="generator-content">
          <div class="text-center" style="padding:40px 0;">
            <div class="spinner"></div>
            <p class="loading-text">Parsing uploaded files...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const students = await parseAndMergeFiles(state.files, state.nameCol, state.urnCol);
    state.students = students;
    renderConfigPanel(students);
  } catch (err) {
    document.getElementById('generator-content').innerHTML = `
      <div class="glass-card-static text-center">
        <p style="color: var(--color-danger); font-size: 1.1rem;">❌ ${err.message}</p>
        <button class="btn btn-outline mt-24" onclick="window.location.hash='/details'">← Go Back</button>
      </div>
    `;
  }
}

function renderConfigPanel(students) {
  const content = document.getElementById('generator-content');

  content.innerHTML = `
    <div class="glass-card-static animate-in">
      <div class="flex flex-between" style="align-items:center; flex-wrap: wrap; gap: 8px;">
        <h3 class="heading-md">📋 Student Data</h3>
        <span class="text-muted" style="font-size: 0.85rem;">${students.length} students loaded</span>
      </div>

      <div class="data-table-wrapper mt-16" style="max-height: 200px; overflow-y: auto;">
        <table class="data-table">
          <thead><tr><th>#</th><th>Name</th><th>URN</th></tr></thead>
          <tbody>
            ${students
              .slice(0, 20)
              .map(
                (s, i) => `<tr><td>${i + 1}</td><td>${s.name}</td><td>${s.urn || '—'}</td></tr>`
              )
              .join('')}
            ${students.length > 20 ? `<tr><td colspan="3" class="text-muted text-center" style="padding:8px;">... and ${students.length - 20} more</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>

    <div class="glass-card-static animate-in animate-in-delay-1 mt-24">
      <h3 class="heading-md mb-16">⚙️ Batch Configuration</h3>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="batch-count">Number of Batches</label>
          <input class="form-input" type="number" id="batch-count" min="1" max="50" value="1">
        </div>
        <div class="form-group">
          <label class="form-label" for="assign-mode">Assignment Mode</label>
          <select class="form-select" id="assign-mode">
            <option value="asis">As Uploaded (Per File)</option>
            <option value="random">Random</option>
            <option value="sequential">Sequential</option>
          </select>
        </div>
      </div>

      <div id="time-slots" class="mt-16">
        <label class="form-label">Time Slots</label>
        <div id="slots-container"></div>
      </div>
    </div>

    <div id="generation-area" class="mt-24 animate-in animate-in-delay-2">
      <div class="flex flex-center" style="gap: 16px;">
        <button id="btn-back-gen" class="btn btn-outline">← Back</button>
        <button id="btn-generate" class="btn btn-primary btn-lg">
          <span class="btn-icon">🚀</span>
          Generate Hall Tickets
        </button>
      </div>
    </div>

    <div id="progress-area" class="hidden mt-24">
      <div class="glass-card-static">
        <h3 class="heading-md mb-16">Generating Hall Tickets...</h3>
        <div class="progress-container">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" id="progress-fill"></div>
          </div>
          <div class="progress-text">
            <span id="progress-label">Preparing...</span>
            <span id="progress-percent">0%</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const uniqueFiles = [...new Set(students.map((s) => s.sourceFile).filter(Boolean))];
  const batchCountInput = document.getElementById('batch-count');
  const assignModeInput = document.getElementById('assign-mode');

  function updateBatchCountState() {
    if (assignModeInput.value === 'asis' && uniqueFiles.length > 0) {
      batchCountInput.value = uniqueFiles.length;
      batchCountInput.disabled = true;
    } else {
      batchCountInput.disabled = false;
    }
    const count = Math.max(1, Math.min(50, parseInt(batchCountInput.value) || 1));
    updateTimeSlots(count, assignModeInput.value === 'asis' ? uniqueFiles : []);
  }

  assignModeInput.addEventListener('change', updateBatchCountState);

  batchCountInput.addEventListener('input', (e) => {
    const count = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
    updateTimeSlots(count, assignModeInput.value === 'asis' ? uniqueFiles : []);
  });

  updateBatchCountState();

  document.getElementById('btn-back-gen').addEventListener('click', () => navigate('/details'));
  document.getElementById('btn-generate').addEventListener('click', () => handleGenerate(students));
}

function updateTimeSlots(count, fileNames = []) {
  const slotsContainer = document.getElementById('slots-container');
  slotsContainer.innerHTML = '';

  for (let i = 1; i <= count; i++) {
    const div = document.createElement('div');
    div.className = 'batch-slot';
    const label = fileNames[i - 1] ? `Batch ${i} (${fileNames[i - 1]})` : `Batch ${i}`;
    div.innerHTML = `
      <span class="batch-slot-label">${label}</span>
      <input class="form-input" type="text" id="slot-${i}"
        placeholder="e.g., 10:00 AM - 11:00 AM"
        style="padding: 10px 14px; font-size: 0.9rem;">
    `;
    slotsContainer.appendChild(div);
  }
}

async function handleGenerate(students) {
  const batchCount = parseInt(document.getElementById('batch-count').value) || 1;
  const assignMode = document.getElementById('assign-mode').value;
  const uniqueFiles = [...new Set(students.map((s) => s.sourceFile).filter(Boolean))];

  // Collect time slots
  const timeSlots = [];
  for (let i = 1; i <= batchCount; i++) {
    const slot = document.getElementById(`slot-${i}`).value.trim() || `Batch ${i}`;
    timeSlots.push(slot);
  }

  // Assign students to batches
  const batches = [];

  if (assignMode === 'asis' && uniqueFiles.length > 0) {
    for (let i = 0; i < uniqueFiles.length; i++) {
      const file = uniqueFiles[i];
      const batchStudents = students.filter((s) => s.sourceFile === file);
      batches.push({
        batchNumber: i + 1,
        timeSlot: timeSlots[i] || `Batch ${i + 1}`,
        students: batchStudents
      });
    }
  } else {
    let studentList = [...students];
    if (assignMode === 'random') {
      studentList = shuffleArray(studentList);
    }

    const perBatch = Math.ceil(studentList.length / batchCount);
    for (let i = 0; i < batchCount; i++) {
      const batchStudents = studentList.slice(i * perBatch, (i + 1) * perBatch);
      batches.push({
        batchNumber: i + 1,
        timeSlot: timeSlots[i],
        students: batchStudents,
      });
    }
  }

  // Show progress UI
  document.getElementById('generation-area').classList.add('hidden');
  document.getElementById('progress-area').classList.remove('hidden');

  const totalStudents = students.length;
  let processed = 0;
  const tickets = [];

  try {
    for (const batch of batches) {
      for (const student of batch.students) {
        // 1. Insert into Supabase
        updateProgress(processed, totalStudents, `Inserting ${student.name}...`);

        const { data, error } = await supabase
          .from('students')
          .insert({
            student_name: student.name,
            urn: student.urn || null,
            institution_name: state.institutionName,
            event_name: state.eventName,
            year: state.year || null,
            batch_number: batch.batchNumber,
            time_slot: batch.timeSlot,
          })
          .select('id')
          .single();

        if (error) {
          throw new Error(`Database error for ${student.name}: ${error.message}`);
        }

        const ticketId = data.id;

        // 2. Generate QR code
        updateProgress(processed, totalStudents, `Generating QR for ${student.name}...`);
        const verifyURL = buildVerifyURL(ticketId);
        const qrDataURL = await generateQRDataURL(verifyURL);

        // 3. Generate PDF
        updateProgress(processed, totalStudents, `Creating PDF for ${student.name}...`);
        const pdfBlob = generateHallTicketPDF({
          studentName: student.name,
          urn: student.urn,
          institutionName: state.institutionName,
          eventName: state.eventName,
          year: state.year,
          batchNumber: batch.batchNumber,
          timeSlot: batch.timeSlot,
          ticketId,
          qrDataURL,
        });

        tickets.push({
          batchNumber: batch.batchNumber,
          studentName: student.name,
          pdfBlob,
          ticketId,
        });

        processed++;
        updateProgress(processed, totalStudents, `Completed ${student.name}`);
      }
    }

    // Save results to state
    state.generatedTickets = tickets;
    state.batches = batches;

    updateProgress(totalStudents, totalStudents, 'All done!');

    // Navigate to download after a brief pause
    setTimeout(() => navigate('/download'), 800);
  } catch (err) {
    const progressArea = document.getElementById('progress-area');
    progressArea.innerHTML = `
      <div class="glass-card-static">
        <p style="color: var(--color-danger); font-size: 1rem; margin-bottom: 16px;">
          ❌ ${err.message}
        </p>
        <p class="text-muted mb-24" style="font-size: 0.85rem;">
          ${processed} of ${totalStudents} tickets were generated before the error.
        </p>
        <button class="btn btn-outline" onclick="window.location.hash='/generator'">Try Again</button>
      </div>
    `;
  }
}

function updateProgress(current, total, label) {
  const pct = Math.round((current / total) * 100);
  const fill = document.getElementById('progress-fill');
  const lbl = document.getElementById('progress-label');
  const pctEl = document.getElementById('progress-percent');

  if (fill) fill.style.width = `${pct}%`;
  if (lbl) lbl.textContent = label;
  if (pctEl) pctEl.textContent = `${pct}%`;
}

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
