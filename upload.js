import * as pdfjsLib from './libs/pdfjs/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './libs/pdfjs/pdf.worker.min.mjs';

let DATA = null;

const subjectSelect = document.getElementById('subjectSelect');
const subtopicSelect = document.getElementById('subtopicSelect');
const levelSelect = document.getElementById('levelSelect');
const cameraBtn = document.getElementById('cameraBtn');
const filesBtn = document.getElementById('filesBtn');
const cameraInput = document.getElementById('cameraInput');
const filesInput = document.getElementById('filesInput');
const statusLine = document.getElementById('statusLine');
const rawSection = document.getElementById('rawSection');
const rawText = document.getElementById('rawText');
const splitBtn = document.getElementById('splitBtn');
const questionsSection = document.getElementById('questionsSection');
const downloadBtn = document.getElementById('downloadBtn');
const publishBtn = document.getElementById('publishBtn');

const settingsToggle = document.getElementById('settingsToggle');
const settingsBody = document.getElementById('settingsBody');
const settingsChev = document.getElementById('settingsChev');
const connBadge = document.getElementById('connBadge');
const ghUser = document.getElementById('ghUser');
const ghRepo = document.getElementById('ghRepo');
const ghBranch = document.getElementById('ghBranch');
const ghPath = document.getElementById('ghPath');
const ghToken = document.getElementById('ghToken');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

const teacherTabSelect = document.getElementById('teacherTabSelect');
const tab1Panel = document.getElementById('tab1Panel');
const tab2Panel = document.getElementById('tab2Panel');
const tab3Panel = document.getElementById('tab3Panel');
const tab4Panel = document.getElementById('tab4Panel');
const exportBar = document.getElementById('exportBar');
const verifySummary = document.getElementById('verifySummary');
const verifyDetail = document.getElementById('verifyDetail');

let pendingTopicChanges = false; // true once a new topic is saved but not yet downloaded/published

teacherTabSelect.addEventListener('change', () => {
  const tab = teacherTabSelect.value;
  tab1Panel.classList.toggle('hidden', tab !== 'upload');
  tab2Panel.classList.toggle('hidden', tab !== 'verify');
  tab3Panel.classList.toggle('hidden', tab !== 'marks');
  tab4Panel.classList.toggle('hidden', tab !== 'doubts');

  if (tab === 'verify') renderVerifyTab();
});

// Download File / Publish to GitHub is now permanently visible at the
// bottom of the screen on every Teacher Menu tab - Upload Questions,
// Verify Uploaded Data, Student Marks, Student Doubts - not conditional
// on pending changes or which tab is open. This is now a no-op kept only
// so existing call sites don't need to change.
function updateExportBarVisibility(){ saveDraft(); }

// ---------- Tab 2: Verify Uploaded Data ----------
function renderVerifyTab(){
  verifySummary.innerHTML = '';
  verifyDetail.innerHTML = '';

  let totalQuestions = 0, missingVideo = 0, missingExplanation = 0;

  DATA.subjects.forEach(subj => {
    const subjBox = document.createElement('div');
    subjBox.className = 'settings-panel';
    subjBox.innerHTML = `<h3>${subj.name}</h3>`;

    const table = document.createElement('div');
    table.style.fontSize = '13px';

    subj.subtopics.forEach(st => {
      const l1 = (st.levels['1'] || []);
      const l2 = (st.levels['2'] || []);
      const count = l1.length + l2.length;
      totalQuestions += count;

      [...l1, ...l2].forEach(q => {
        if (!hasVideoSource(q)) missingVideo++;
        if (!q.explanation) missingExplanation++;
      });

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f2fa;cursor:pointer;';
      const flagBits = [];
      const noVideoCount = [...l1, ...l2].filter(q => !hasVideoSource(q)).length;
      const noExplCount = [...l1, ...l2].filter(q => !q.explanation).length;
      if (count === 0) flagBits.push('<span style="color:var(--wrong);">empty</span>');
      if (noVideoCount > 0) flagBits.push(`<span style="color:#e65100;">${noVideoCount} missing video</span>`);
      if (noExplCount > 0) flagBits.push(`<span style="color:var(--muted);">${noExplCount} missing explanation</span>`);
      row.innerHTML = `
        <span>${st.name}</span>
        <span style="text-align:right;">
          <strong>${count}</strong> Qs (L1: ${l1.length}, L2: ${l2.length})
          ${flagBits.length ? '<br><span style="font-size:11px;">' + flagBits.join(' &middot; ') + '</span>' : ''}
        </span>
      `;
      row.onclick = () => toggleSubtopicDetail(st, row, subj.name);
      table.appendChild(row);
    });

    subjBox.appendChild(table);
    verifySummary.appendChild(subjBox);
  });

  const overview = document.createElement('div');
  overview.className = 'settings-panel';
  overview.style.background = '#eef1fb';
  const sizeBytes = new Blob([JSON.stringify(DATA)]).size;
  const sizeMB = sizeBytes / (1024 * 1024);
  const sizeColor = sizeBytes > 900000 ? 'var(--wrong)' : (sizeBytes > 600000 ? '#e65100' : 'var(--correct)');
  const sizeWarning = sizeBytes > 900000
    ? '<br><span style="color:var(--wrong);font-weight:700;">⚠ Over GitHub\'s ~1 MB Publish limit - Publish to GitHub will be blocked until this is smaller (remove a heavy uploaded video, or use a Link instead).</span>'
    : '';
  overview.innerHTML = `
    <h3>Overview</h3>
    <div class="hint" style="margin-bottom:0;">
      <strong>${totalQuestions}</strong> total questions across all subtopics.
      <strong>${missingVideo}</strong> missing a video link.
      <strong>${missingExplanation}</strong> missing an explanation.
      Tap any subtopic above to preview its questions.
      <br>Question bank file size: <strong style="color:${sizeColor};">${sizeMB.toFixed(2)} MB</strong>${sizeWarning}
    </div>
  `;
  verifySummary.insertBefore(overview, verifySummary.firstChild);
}

function toggleSubtopicDetail(subtopic, rowEl, subjectName){
  if (verifyDetail.dataset.openFor === subtopic.id) {
    verifyDetail.innerHTML = '';
    verifyDetail.dataset.openFor = '';
    return;
  }
  verifyDetail.dataset.openFor = subtopic.id;
  renderSubtopicDetailContents(subtopic, subjectName);
}
function renderSubtopicDetailContents(subtopic, subjectName){
  verifyDetail.innerHTML = '';
  const intro = document.createElement('div');
  intro.className = 'progress-note';
  intro.style.marginBottom = '10px';
  intro.textContent = 'Edit any question below directly - your changes save to this page immediately. Look for the Download / Publish to GitHub bar at the very bottom of the screen to make edits live for students.';
  verifyDetail.appendChild(intro);

  // ---- Teacher-only exports for this topic ----
  const exportRow = document.createElement('div');
  exportRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;';
  const pptBtn = document.createElement('button');
  pptBtn.className = 'btn btn-secondary';
  pptBtn.style.fontSize = '13px';
  pptBtn.textContent = '📊 Download PPT (Q + Answers)';
  pptBtn.onclick = () => downloadTopicPPTX(subtopic, subjectName || '');
  const vidBtn = document.createElement('button');
  vidBtn.className = 'btn btn-secondary';
  vidBtn.style.fontSize = '13px';
  vidBtn.textContent = '🎬 Download Video Link List (CSV)';
  vidBtn.onclick = () => downloadVideoListCSV(subtopic, subjectName || '');
  exportRow.appendChild(pptBtn);
  exportRow.appendChild(vidBtn);
  verifyDetail.appendChild(exportRow);
  const exportHint = document.createElement('div');
  exportHint.className = 'progress-note';
  exportHint.style.marginBottom = '14px';
  exportHint.textContent = 'Both exports cover this topic only, both levels. Teacher-only - not visible or available to students.';
  verifyDetail.appendChild(exportHint);

  const savedIndicator = document.createElement('div');
  savedIndicator.style.cssText = 'display:none;background:#fff3e0;color:#e65100;font-weight:700;font-size:13px;padding:10px 14px;border-radius:8px;margin-bottom:12px;';
  savedIndicator.textContent = '✓ Changes ready - Download or Publish to GitHub at the bottom of the screen to make them live.';
  verifyDetail.appendChild(savedIndicator);

  ['1','2'].forEach(level => {
    const qs = subtopic.levels[level] || [];
    qs.forEach((q, i) => {
      const card = buildQuestionCard(q, {
        label: `Level ${level}, Question ${i + 1} (editing existing content)`,
        removeLabel: 'Delete this question permanently',
        onRemove: () => {
          if (!window.confirm('Delete this question permanently? This can\'t be undone once published.')) return;
          subtopic.levels[level].splice(i, 1);
          pendingTopicChanges = true;
          updateExportBarVisibility();
          renderVerifyTab(); // refresh the counts above (this also clears verifyDetail)
          verifyDetail.dataset.openFor = subtopic.id;
          renderSubtopicDetailContents(subtopic, subjectName); // rebuild the now-updated list, keeping it open
        },
        onChange: () => { pendingTopicChanges = true; updateExportBarVisibility(); savedIndicator.style.display = 'block'; }
      });
      verifyDetail.appendChild(card);
    });
  });
  if (qsEmpty(subtopic)) {
    verifyDetail.innerHTML += '<div class="progress-note">No questions in this subtopic yet.</div>';
  }
}
function qsEmpty(subtopic){
  return (subtopic.levels['1'] || []).length === 0 && (subtopic.levels['2'] || []).length === 0;
}

// ---------- Teacher-only exports: PPT (questions + answers) and video link CSV ----------
// Both cover one topic (subtopic) at a time, both levels combined, and are
// reachable only from inside Teacher Upload - never exposed to students.

function safeFileName(s){
  return (s || 'export').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}
function hasVideoSource(q){
  return !!(q.videoFile || (q.videoUrl && q.videoUrl !== 'PASTE_VIDEO_LINK_HERE'));
}

function downloadTopicPPTX(subtopic, subjectName){
  if (typeof PptxGenJS === 'undefined') {
    setStatus('PPT library did not load - try refreshing the page.', 'error');
    return;
  }
  const allQs = [...(subtopic.levels['1'] || []).map(q => ({ ...q, level: 1 })),
                 ...(subtopic.levels['2'] || []).map(q => ({ ...q, level: 2 }))];
  if (allQs.length === 0) {
    setStatus('No questions in this topic yet - nothing to export.', 'error');
    return;
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'A4', width: 10, height: 7.5 });
  pptx.layout = 'A4';

  const title = pptx.addSlide();
  title.background = { color: '16274A' };
  title.addText(subtopic.name, { x: 0.5, y: 2.6, w: 9, h: 1, fontSize: 28, bold: true, color: 'FFFFFF', align: 'center' });
  title.addText(subjectName, { x: 0.5, y: 3.5, w: 9, h: 0.6, fontSize: 16, color: 'E8A33D', align: 'center' });
  title.addText(`${allQs.length} question(s) - with answers, for teacher reference`, { x: 0.5, y: 4.2, w: 9, h: 0.5, fontSize: 12, color: 'C7D2E0', align: 'center' });

  const letters = ['A','B','C','D'];
  allQs.forEach((q, i) => {
    const slide = pptx.addSlide();
    slide.addText(`Q${i + 1}  (Level ${q.level})`, { x: 0.4, y: 0.25, w: 9, h: 0.4, fontSize: 13, bold: true, color: '16274A' });
    slide.addText(q.question, { x: 0.4, y: 0.65, w: 9.2, h: 1.3, fontSize: 16, color: '16213A', wrap: true });

    let y = 2.1;
    if (q.questionImage) {
      try {
        slide.addImage({ data: q.questionImage, x: 0.4, y, w: 3.2, h: 2.2, sizing: { type: 'contain', w: 3.2, h: 2.2 } });
      } catch (e) { /* skip image if it fails to embed */ }
    }
    const textX = q.questionImage ? 3.9 : 0.4;
    const textW = q.questionImage ? 5.7 : 9.2;

    if (q.type === 'fill') {
      slide.addText('Correct Answer: ' + (q.correctAnswer || ''), {
        x: textX, y, w: textW, h: 0.5, fontSize: 15, bold: true, color: '2F9E52'
      });
      y += 0.6;
    } else {
      (q.options || []).forEach((opt, idx) => {
        const isCorrect = idx === q.correctIndex;
        slide.addText(`${letters[idx]}. ${opt}`, {
          x: textX, y, w: textW, h: 0.4, fontSize: 14,
          color: isCorrect ? '2F9E52' : '16213A', bold: isCorrect
        });
        y += 0.42;
      });
    }

    if (q.explanation) {
      slide.addText('Explanation: ' + q.explanation.replace(/\$/g, ''), {
        x: 0.4, y: Math.max(y, 4.6), w: 9.2, h: 1.6, fontSize: 11, color: '64748B', wrap: true
      });
    }
    if (q.videoUrl && q.videoUrl !== 'PASTE_VIDEO_LINK_HERE') {
      slide.addText('Video: ' + q.videoUrl, { x: 0.4, y: 6.9, w: 9.2, h: 0.4, fontSize: 10, color: 'C97A2B' });
    } else if (q.videoFile) {
      slide.addText('Video: uploaded clip (not shown in PPT - open the app to view)', { x: 0.4, y: 6.9, w: 9.2, h: 0.4, fontSize: 10, color: 'C97A2B' });
    }
  });

  pptx.writeFile({ fileName: `${safeFileName(subtopic.name)}_questions_with_answers.pptx` });
  setStatus(`PPT downloaded: ${allQs.length} question(s) from "${subtopic.name}".`, 'ok');
}

function downloadVideoListCSV(subtopic, subjectName){
  const allQs = [...(subtopic.levels['1'] || []).map(q => ({ ...q, level: 1 })),
                 ...(subtopic.levels['2'] || []).map(q => ({ ...q, level: 2 }))];
  if (allQs.length === 0) {
    setStatus('No questions in this topic yet - nothing to export.', 'error');
    return;
  }
  const esc = s => '"' + String(s || '').replace(/"/g, '""').replace(/\n/g, ' ') + '"';
  const rows = [['#', 'Level', 'Question', 'Correct Answer', 'Video Link', 'Uploaded Video File', 'Visible to Students', 'Has Explanation', 'Has Question Figure']];
  allQs.forEach((q, i) => {
    const correct = q.type === 'fill' ? q.correctAnswer : (q.options || [])[q.correctIndex] || '';
    const hasVideoLink = q.videoUrl && q.videoUrl !== 'PASTE_VIDEO_LINK_HERE' ? q.videoUrl : '(none)';
    rows.push([
      i + 1, q.level, q.question, correct, hasVideoLink,
      q.videoFile ? 'Yes' : 'No',
      q.videoReady ? 'Yes' : 'No - text solution only',
      q.explanation ? 'Yes' : 'No',
      q.questionImage ? 'Yes' : 'No'
    ]);
  });
  const csv = rows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(subtopic.name)}_video_links.csv`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus(`Video link list downloaded: ${allQs.length} question(s) from "${subtopic.name}". Open in Excel/Sheets to review and update.`, 'ok');
}

let parsedQuestions = [];
let accumulatedText = '';
let pendingSourceImages = []; // {dataUrl, name} for every photo taken/chosen this session

// ---------- Safety-net draft (protects against a failed Publish, an
// accidental reload, or closing the tab before saving) ----------
const DRAFT_KEY = 'eeeTeacherDraft';
let draftSaveTimer = null;

function saveDraft(){
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    try {
      const draft = {
        data: DATA,
        parsedQuestions,
        accumulatedText,
        subject: subjectSelect.value,
        subtopic: subtopicSelect.value,
        level: levelSelect.value,
        ts: Date.now()
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      // localStorage can fail if a large video pushes the draft over the
      // browser's quota (~5-10 MB) - not fatal, just means no local backup
      // for this particular session; Download/Publish still work normally.
    }
  }, 400); // debounced so rapid typing doesn't hammer localStorage
}

function clearDraft(){
  clearTimeout(draftSaveTimer);
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
}

function offerDraftRestore(){
  let draft;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    draft = JSON.parse(raw);
  } catch (e) { return; }
  if (!draft || (!draft.parsedQuestions?.length && !draft.accumulatedText)) return;

  const when = new Date(draft.ts).toLocaleString();
  const banner = document.createElement('div');
  banner.style.cssText = 'background:#fff3e0;border:2px solid #e65100;border-radius:10px;padding:14px;margin-bottom:14px;';
  banner.innerHTML = `
    <div style="font-weight:700;color:#e65100;margin-bottom:6px;">Unsaved work found from ${when}</div>
    <div style="font-size:13px;color:var(--text);margin-bottom:10px;">
      This looks like work that wasn't successfully published or downloaded last time
      (${draft.parsedQuestions?.length || 0} question(s) in progress). Restore it, or discard and start fresh.
    </div>
    <div style="display:flex;gap:8px;">
      <button id="restoreDraftBtn" class="btn btn-primary" style="flex:1;">Restore</button>
      <button id="discardDraftBtn" class="btn btn-secondary" style="flex:1;">Discard</button>
    </div>
  `;
  tab1Panel.insertBefore(banner, tab1Panel.firstChild);

  banner.querySelector('#restoreDraftBtn').onclick = () => {
    DATA = draft.data || DATA;
    parsedQuestions = draft.parsedQuestions || [];
    accumulatedText = draft.accumulatedText || '';
    rawText.value = accumulatedText;
    if (accumulatedText) rawSection.classList.remove('hidden');
    populateSubjects();
    if (draft.subject) subjectSelect.value = draft.subject;
    populateSubtopics();
    if (draft.subtopic) subtopicSelect.value = draft.subtopic;
    if (draft.level) levelSelect.value = draft.level;
    renderQuestionBlocks();
    pendingTopicChanges = true;
    banner.remove();
    setStatus('Restored your unsaved work. Review it below, then Download or Publish.', 'ok');
  };
  banner.querySelector('#discardDraftBtn').onclick = () => {
    clearDraft();
    banner.remove();
  };
}

// ---------- Publish settings (stored only on this device) ----------
const SETTINGS_KEY = 'eeePracticePublishSettings';

function loadSettings(){
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveSettings(s){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
function applySettingsToForm(s){
  if (!s) return;
  ghUser.value = s.user || '';
  ghRepo.value = s.repo || '';
  ghBranch.value = s.branch || 'main';
  ghPath.value = s.path || 'data/questions.json';
  // Token intentionally not re-displayed in the field for a small privacy margin;
  // it's still stored and used, just shown blank until re-entered or left as-is.
}
function updateConnBadge(){
  const s = loadSettings();
  const connected = s && s.user && s.repo && s.token;
  connBadge.textContent = connected ? `Connected to ${s.user}/${s.repo}` : 'Not connected';
  connBadge.className = 'publish-status-badge ' + (connected ? 'connected' : 'not-connected');
}

const existing = loadSettings();
applySettingsToForm(existing);
updateConnBadge();

settingsToggle.addEventListener('click', () => {
  settingsBody.classList.toggle('open');
  settingsChev.textContent = settingsBody.classList.contains('open') ? '▲' : '▼';
});

saveSettingsBtn.addEventListener('click', () => {
  const prev = loadSettings() || {};
  const s = {
    user: ghUser.value.trim(),
    repo: ghRepo.value.trim(),
    branch: ghBranch.value.trim() || 'main',
    path: ghPath.value.trim() || 'data/questions.json',
    token: ghToken.value.trim() || prev.token || ''
  };
  saveSettings(s);
  ghToken.value = '';
  updateConnBadge();
  setStatus('Publish settings saved on this device.', 'ok');
});

// ---------- Load existing question bank ----------
fetch('data/questions.json')
  .then(r => r.json())
  .then(json => { DATA = json; populateSubjects(); offerDraftRestore(); });

function populateSubjects(){
  subjectSelect.innerHTML = '';
  DATA.subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    subjectSelect.appendChild(opt);
  });
  populateSubtopics();
}
function populateSubtopics(){
  const subj = DATA.subjects.find(s => s.id === subjectSelect.value) || DATA.subjects[0];
  subtopicSelect.innerHTML = '';
  subj.subtopics.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st.id; opt.textContent = st.name;
    subtopicSelect.appendChild(opt);
  });
}
subjectSelect.addEventListener('change', populateSubtopics);

// ---------- Add New Topic (with Save) ----------
const addTopicToggle = document.getElementById('addTopicToggle');
const addTopicBody = document.getElementById('addTopicBody');
const newTopicInput = document.getElementById('newTopicInput');
const saveTopicBtn = document.getElementById('saveTopicBtn');
const newTopicStatus = document.getElementById('newTopicStatus');

addTopicToggle.addEventListener('click', () => {
  addTopicBody.classList.toggle('open');
  newTopicInput.focus();
});

function slugify(name){
  return name.toLowerCase()
    .replace(/[(),\/]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

saveTopicBtn.addEventListener('click', () => {
  const name = newTopicInput.value.trim();
  if (!name) {
    newTopicStatus.textContent = 'Type a topic name first.';
    newTopicStatus.className = 'status-line error';
    return;
  }
  const subj = DATA.subjects.find(s => s.id === subjectSelect.value);
  const id = slugify(name);
  if (subj.subtopics.some(st => st.id === id || st.name.toLowerCase() === name.toLowerCase())) {
    newTopicStatus.textContent = 'That topic already exists in ' + subj.name + '.';
    newTopicStatus.className = 'status-line error';
    return;
  }
  subj.subtopics.push({ id, name, levels: { "1": [], "2": [] } });
  populateSubtopics();
  subtopicSelect.value = id;
  newTopicInput.value = '';
  pendingTopicChanges = true;
  updateExportBarVisibility();
  newTopicStatus.textContent = `Added "${name}" to ${subj.name}. It's in the dropdown now - use Download or Publish to GitHub below to make it visible to students.`;
  newTopicStatus.className = 'status-line ok';
});

const deleteTopicBtn = document.getElementById('deleteTopicBtn');
const deleteTopicStatus = document.getElementById('deleteTopicStatus');

deleteTopicBtn.addEventListener('click', () => {
  const subj = DATA.subjects.find(s => s.id === subjectSelect.value);
  const subt = subj.subtopics.find(s => s.id === subtopicSelect.value);
  if (!subt) {
    deleteTopicStatus.textContent = 'No topic selected.';
    deleteTopicStatus.className = 'status-line error';
    return;
  }
  const qCount = (subt.levels['1'] || []).length + (subt.levels['2'] || []).length;
  const confirmMsg = qCount > 0
    ? `Delete "${subt.name}"? This permanently removes all ${qCount} question(s) in it. This can't be undone once published.`
    : `Delete "${subt.name}"? It has no questions yet, but this can't be undone once published.`;
  if (!window.confirm(confirmMsg)) return;

  subj.subtopics = subj.subtopics.filter(s => s.id !== subt.id);
  populateSubtopics();
  pendingTopicChanges = true;
  updateExportBarVisibility();
  deleteTopicStatus.textContent = `Deleted "${subt.name}" and its ${qCount} question(s). Use Download or Publish to GitHub below to make this permanent for students.`;
  deleteTopicStatus.className = 'status-line ok';
});

// ---------- Source buttons ----------
cameraBtn.addEventListener('click', () => cameraInput.click());
filesBtn.addEventListener('click', () => filesInput.click());
cameraInput.addEventListener('change', () => {
  if (cameraInput.files.length) handleFile(cameraInput.files[0]);
  cameraInput.value = '';
});
filesInput.addEventListener('change', () => {
  if (filesInput.files.length) handleFile(filesInput.files[0]);
  filesInput.value = '';
});

function setStatus(msg, type){
  statusLine.textContent = msg;
  statusLine.className = 'status-line' + (type ? ' ' + type : '');
}

// A publish failure is easy to miss as a small colored status line,
// especially on mobile after scrolling - so it also shows as a blocking
// modal that has to be dismissed, never just silent/easy-to-scroll-past text.
function showPublishError(msg){
  setStatus(msg, 'error');
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  overlay.innerHTML = `
    <div class="modal-box" style="border-top:3px solid var(--wrong);max-width:420px;">
      <h2 style="color:var(--wrong);">Publish Failed</h2>
      <p style="white-space:pre-line;color:var(--text);font-size:14px;line-height:1.5;">${msg}</p>
      <button class="btn btn-primary full-width" id="dismissPublishError">Got it</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#dismissPublishError').onclick = () => overlay.remove();
}

async function handleFile(file){
  const ext = file.name.split('.').pop().toLowerCase();
  setStatus('Reading ' + file.name + ' ...');
  try {
    let text = '';
    const isImage = ['jpg','jpeg','png'].includes(ext) || file.type.startsWith('image/');
    if (ext === 'txt') {
      text = await file.text();
    } else if (ext === 'docx') {
      const buf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      text = result.value;
    } else if (ext === 'pdf') {
      text = await extractPdfText(file);
    } else if (isImage) {
      text = await extractImageText(file);
    } else {
      setStatus('Unsupported file type: .' + ext, 'error');
      return;
    }
    if (isImage) {
      const dataUrl = await fileToDataUrl(file);
      pendingSourceImages.push({ dataUrl, name: file.name });
    }
    accumulatedText += (accumulatedText ? '\n\n' : '') + text.trim();
    rawText.value = accumulatedText;
    rawSection.classList.remove('hidden');
    setStatus(`Added ${text.length} characters from ${file.name}. Take/choose another page, or review and split below.`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus('Extraction failed: ' + err.message, 'error');
  }
}

function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractPdfText(file){
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let full = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    setStatus(`Reading PDF page ${i} of ${pdf.numPages} ...`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    full += content.items.map(it => it.str).join(' ') + '\n\n';
  }
  return full;
}

async function extractImageText(file){
  setStatus('Running OCR on photo - this can take 15-30 seconds on a phone...');
  const result = await Tesseract.recognize(file, 'eng', {
    workerPath: 'libs/tesseract/worker.min.js',
    corePath: 'libs/tesseract/tesseract-core-simd-lstm.wasm.js',
    langPath: 'libs/tesseract',
    gzip: true,
    logger: m => {
      if (m.status && typeof m.progress === 'number') {
        setStatus(`OCR: ${m.status} (${Math.round(m.progress * 100)}%)`);
      }
    }
  });
  return result.data.text;
}

rawText.addEventListener('input', () => { accumulatedText = rawText.value; });

// ---------- Splitting ----------
splitBtn.addEventListener('click', () => {
  const text = rawText.value;
  const blocks = splitIntoBlocks(text);
  parsedQuestions = blocks.map(parseBlock);
  // Obvious case: exactly one photo was used and it produced exactly one
  // question - that photo is almost certainly this question's figure, so
  // attach it automatically (teacher can still remove it with one tap).
  if (pendingSourceImages.length === 1 && parsedQuestions.length === 1) {
    parsedQuestions[0].questionImage = pendingSourceImages[0].dataUrl;
  }
  renderQuestionBlocks();
  updateExportBarVisibility();
});

function splitIntoBlocks(text){
  const lines = text.split('\n');
  const blocks = [];
  let current = [];
  const startPattern = /^\s*(Q\.?\s*)?\d{1,3}[\.\)]\s+/;
  lines.forEach(line => {
    if (startPattern.test(line) && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  });
  if (current.length) blocks.push(current.join('\n'));
  if (blocks.length <= 1) {
    return text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  }
  return blocks.map(b => b.trim()).filter(Boolean);
}

function parseBlock(block){
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const optRe = /^\(?([A-Da-d])[\)\.]\s*(.+)$/;
  const ansRe = /^(ans(wer)?|correct)[:\-\s]*\(?([A-Da-d0-9.\-]+)\)?/i;

  let questionLines = [];
  const options = { A: '', B: '', C: '', D: '' };
  let correctRaw = '';

  lines.forEach(line => {
    const ansMatch = line.match(ansRe);
    const optMatch = line.match(optRe);
    if (ansMatch) {
      correctRaw = ansMatch[3].toUpperCase();
    } else if (optMatch) {
      options[optMatch[1].toUpperCase()] = optMatch[2].trim();
    } else if (Object.values(options).every(v => v === '')) {
      questionLines.push(line.replace(/^\s*(Q\.?\s*)?\d{1,3}[\.\)]\s*/, ''));
    }
  });

  const hasOptions = Object.values(options).some(v => v !== '');
  // Heuristic: no A/B/C/D option lines detected at all -> most likely a
  // fill-in-the-blank / numeric-answer question, common in GATE/ESE style
  // banks (e.g. "...the corona loss per km of line is ____ kW"). Teacher
  // can always override the type manually in the review screen either way.
  const type = hasOptions ? 'mcq' : 'fill';
  const correctIndex = { A: 0, B: 1, C: 2, D: 3 }[correctRaw];

  return {
    type,
    question: questionLines.join(' ').trim(),
    options: [options.A, options.B, options.C, options.D],
    correctIndex: correctIndex !== undefined ? correctIndex : null,
    correctAnswer: (!hasOptions && correctRaw) ? correctRaw : '',
    questionImage: null, // base64 data URI - the figure/diagram belonging to the question itself
    videoUrl: '',
    videoFile: null, // base64 data URI of an uploaded video clip, alternative to a link
    videoReady: false, // teacher must explicitly tick this before students see any video prompt/link
    explanation: '',
    explanationImage: null // base64 data URI, set via the attach-file control below
  };
}

// ---------- Review UI ----------
// ---------- Shared symbol/equation toolbar ----------
// Tracks whichever text field was last focused (question, any option,
// correct-answer, or explanation) so ONE toolbar per question can insert
// into any of them, instead of duplicating a toolbar per field.
let lastFocusedField = null;
function trackFocus(el){ el.addEventListener('focus', () => { lastFocusedField = el; }); }

function insertAtCursor(el, text){
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const val = el.value;
  el.value = val.slice(0, start) + text + val.slice(end);
  el.dispatchEvent(new Event('input'));
  el.focus();
  el.selectionStart = el.selectionEnd = start + text.length;
}

function buildSymbolToolbar(){
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;';
  const symbols = ['ω','Ω','θ','δ','α','β','μ','π','Σ','Δ','√','±','≤','≥','≈','∞','∫','→','°','²','³','½'];
  symbols.forEach(sym => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = sym;
    b.style.cssText = 'width:28px;height:28px;border:1px solid #e0e4f0;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;';
    b.onclick = () => insertAtCursor(lastFocusedField, sym);
    row.appendChild(b);
  });
  const eqBtn = document.createElement('button');
  eqBtn.type = 'button';
  eqBtn.textContent = 'Insert equation template';
  eqBtn.style.cssText = 'height:28px;padding:0 10px;border:1px solid #e0e4f0;border-radius:6px;background:#fff;cursor:pointer;font-size:12px;';
  eqBtn.onclick = () => insertAtCursor(lastFocusedField, '$\\frac{a}{b} = \\sqrt{c}$');
  row.appendChild(eqBtn);
  const hint = document.createElement('div');
  hint.className = 'progress-note';
  hint.style.cssText = 'width:100%;margin:2px 0 0;';
  hint.textContent = 'Tap into the question, an option, the answer, or the explanation first, then tap a symbol above to insert it there.';
  row.appendChild(hint);
  return row;
}

function renderMathPreviewInto(box, text){
  box.textContent = text || '(nothing typed yet)';
  box.style.display = 'block';
  if (window.renderMathInElement) {
    try {
      renderMathInElement(box, {
        delimiters: [{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],
        throwOnError: false
      });
    } catch (e) { /* leave as plain text */ }
  }
}

// ---------- Reusable question editor card ----------
// Builds one fully-editable question card, used both for freshly-split
// questions (Tab 1) and for editing already-published questions (Tab 2).
// Mutates `q` directly - callers decide when/how those mutations get saved.
function buildQuestionCard(q, opts){
  opts = opts || {};
  q.type = q.type || 'mcq';
  const box = document.createElement('div');
  box.className = 'qblock';

  if (opts.label) {
    const qLabel = document.createElement('span');
    qLabel.className = 'row-label';
    qLabel.textContent = opts.label;
    box.appendChild(qLabel);
  }

  const qTextArea = document.createElement('textarea');
  qTextArea.value = q.question;
  qTextArea.oninput = () => { q.question = qTextArea.value; if (opts.onChange) opts.onChange(); };
  trackFocus(qTextArea);
  box.appendChild(qTextArea);

  // ---- Question figure ----
  const qImageRow = document.createElement('div');
  qImageRow.style.marginBottom = '10px';
  if (pendingSourceImages.length > 0) {
    const quickLabel = document.createElement('div');
    quickLabel.className = 'row-label';
    quickLabel.textContent = pendingSourceImages.length === 1
      ? 'Use the photo you just uploaded as this question\'s figure:'
      : 'Use one of your recent photos as this question\'s figure:';
    qImageRow.appendChild(quickLabel);
    const thumbRow = document.createElement('div');
    thumbRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;';
    pendingSourceImages.forEach(src => {
      const thumb = document.createElement('img');
      thumb.src = src.dataUrl;
      thumb.title = 'Tap to use as this question\'s figure';
      thumb.style.cssText = 'width:56px;height:56px;object-fit:cover;border-radius:8px;border:2px solid #e0e4f0;cursor:pointer;';
      thumb.onclick = () => { q.questionImage = src.dataUrl; renderQImagePreview(); if (opts.onChange) opts.onChange(); };
      thumbRow.appendChild(thumb);
    });
    qImageRow.appendChild(thumbRow);
  }
  const qImageBtn = document.createElement('button');
  qImageBtn.type = 'button';
  qImageBtn.className = 'btn btn-secondary';
  qImageBtn.style.fontSize = '13px';
  qImageBtn.style.padding = '8px 12px';
  qImageBtn.textContent = pendingSourceImages.length > 0 ? '🖼 Or Browse for a Different Figure' : '🖼 Attach Figure/Diagram to Question';
  const qImageInput = document.createElement('input');
  qImageInput.type = 'file';
  qImageInput.accept = '.jpg,.jpeg,.png';
  qImageInput.style.display = 'none';
  const qImagePreview = document.createElement('div');
  qImagePreview.style.marginTop = '8px';
  function renderQImagePreview(){
    qImagePreview.innerHTML = '';
    if (q.questionImage) {
      const img = document.createElement('img');
      img.src = q.questionImage;
      img.style.cssText = 'max-width:160px;border-radius:8px;display:block;margin-bottom:6px;';
      qImagePreview.appendChild(img);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'remove-q';
      rm.textContent = 'Remove figure';
      rm.onclick = () => { q.questionImage = null; renderQImagePreview(); if (opts.onChange) opts.onChange(); };
      qImagePreview.appendChild(rm);
    }
  }
  renderQImagePreview();
  qImageBtn.onclick = () => qImageInput.click();
  qImageInput.onchange = () => {
    const file = qImageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { q.questionImage = reader.result; renderQImagePreview(); if (opts.onChange) opts.onChange(); };
    reader.readAsDataURL(file);
    qImageInput.value = '';
  };
  qImageRow.appendChild(qImageBtn);
  qImageRow.appendChild(qImageInput);
  qImageRow.appendChild(qImagePreview);
  box.appendChild(qImageRow);

  // ---- Question Type switch: MCQ vs Fill in the Blank ----
  const typeRow = document.createElement('div');
  typeRow.style.marginBottom = '10px';
  const typeLabel = document.createElement('label');
  typeLabel.className = 'row-label';
  typeLabel.textContent = 'Question Type';
  const typeSelect = document.createElement('select');
  ['mcq', 'fill'].forEach(t => {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = t === 'mcq' ? 'Multiple Choice (A/B/C/D)' : 'Fill in the Blank / Numeric Answer';
    typeSelect.appendChild(o);
  });
  typeSelect.value = q.type;
  typeRow.appendChild(typeLabel);
  typeRow.appendChild(typeSelect);
  box.appendChild(typeRow);

  // ---- Answer area ----
  const answerArea = document.createElement('div');
  box.appendChild(answerArea);
  function renderAnswerArea(){
    answerArea.innerHTML = '';
    if (typeSelect.value === 'mcq') {
      const optGrid = document.createElement('div');
      optGrid.className = 'opt-grid';
      q.options = q.options && q.options.length === 4 ? q.options : ['', '', '', ''];
      ['A','B','C','D'].forEach((letter, idx) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Option ' + letter + ' (equations supported, e.g. $\\sqrt{3}$)';
        input.value = q.options[idx] || '';
        input.oninput = () => { q.options[idx] = input.value; if (opts.onChange) opts.onChange(); };
        trackFocus(input);
        optGrid.appendChild(input);
      });
      answerArea.appendChild(optGrid);

      const correctSelect = document.createElement('select');
      ['', 'A', 'B', 'C', 'D'].forEach(letter => {
        const o = document.createElement('option');
        o.value = letter; o.textContent = letter ? 'Correct: ' + letter : 'Select correct option';
        correctSelect.appendChild(o);
      });
      correctSelect.value = q.correctIndex !== null && q.correctIndex !== undefined ? ['A','B','C','D'][q.correctIndex] : '';
      correctSelect.onchange = () => {
        q.correctIndex = correctSelect.value ? ['A','B','C','D'].indexOf(correctSelect.value) : null;
        if (opts.onChange) opts.onChange();
      };
      answerArea.appendChild(correctSelect);
    } else {
      const ansInput = document.createElement('input');
      ansInput.type = 'text';
      ansInput.placeholder = 'Correct answer (e.g. 1.13 or a short phrase)';
      ansInput.value = q.correctAnswer || '';
      ansInput.oninput = () => { q.correctAnswer = ansInput.value; if (opts.onChange) opts.onChange(); };
      trackFocus(ansInput);
      answerArea.appendChild(ansInput);
      const hint = document.createElement('div');
      hint.className = 'progress-note';
      hint.style.marginBottom = '10px';
      hint.textContent = 'Numeric answers accept a small tolerance automatically (rounding); text answers match loosely (case/spacing insensitive).';
      answerArea.appendChild(hint);
    }
  }
  renderAnswerArea();
  typeSelect.onchange = () => { q.type = typeSelect.value; renderAnswerArea(); if (opts.onChange) opts.onChange(); };

  const videoLabel = document.createElement('label');
  videoLabel.className = 'row-label';
  videoLabel.style.marginTop = '10px';
  videoLabel.textContent = 'Video Solution - use a link OR upload a short clip directly';
  box.appendChild(videoLabel);

  const videoInput = document.createElement('input');
  videoInput.type = 'text';
  videoInput.placeholder = 'Video link (e.g. YouTube/Drive) - best for longer videos';
  videoInput.value = (q.videoUrl && q.videoUrl !== 'PASTE_VIDEO_LINK_HERE') ? q.videoUrl : '';
  videoInput.oninput = () => { q.videoUrl = videoInput.value; if (opts.onChange) opts.onChange(); };
  box.appendChild(videoInput);

  const videoOrLabel = document.createElement('div');
  videoOrLabel.className = 'progress-note';
  videoOrLabel.style.cssText = 'text-align:center;margin:6px 0;';
  videoOrLabel.textContent = '— or —';
  box.appendChild(videoOrLabel);

  const videoFileBtn = document.createElement('button');
  videoFileBtn.type = 'button';
  videoFileBtn.className = 'btn btn-secondary';
  videoFileBtn.style.cssText = 'font-size:13px;padding:8px 12px;width:100%;';
  videoFileBtn.textContent = '🎬 Upload Video File (short clips, under 15 MB)';
  const videoFileInput = document.createElement('input');
  videoFileInput.type = 'file';
  videoFileInput.accept = 'video/*';
  videoFileInput.style.display = 'none';
  const videoFilePreview = document.createElement('div');
  videoFilePreview.style.marginTop = '8px';
  function renderVideoFilePreview(){
    videoFilePreview.innerHTML = '';
    if (q.videoFile) {
      const vid = document.createElement('video');
      vid.src = q.videoFile;
      vid.controls = true;
      vid.style.cssText = 'width:100%;max-width:260px;border-radius:8px;display:block;margin-bottom:6px;';
      videoFilePreview.appendChild(vid);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'remove-q';
      rm.textContent = 'Remove uploaded video';
      rm.onclick = () => { q.videoFile = null; renderVideoFilePreview(); if (opts.onChange) opts.onChange(); };
      videoFilePreview.appendChild(rm);
    }
  }
  renderVideoFilePreview();
  videoFileBtn.onclick = () => videoFileInput.click();
  videoFileInput.onchange = () => {
    const file = videoFileInput.files[0];
    if (!file) return;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 15) {
      setStatus(`That video is ${sizeMB.toFixed(1)} MB - too large to embed directly (limit ~15 MB, since every student re-downloads this with the question bank). Use a Video Link (YouTube/Drive) for anything longer than a minute or two instead.`, 'error');
      videoFileInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      q.videoFile = reader.result;
      renderVideoFilePreview();
      if (opts.onChange) opts.onChange();
      setStatus(`Video attached (${sizeMB.toFixed(1)} MB). Remember: this size gets added to questions.json for every student to download.`, 'ok');
    };
    reader.readAsDataURL(file);
    videoFileInput.value = '';
  };
  box.appendChild(videoFileBtn);
  box.appendChild(videoFileInput);
  box.appendChild(videoFilePreview);

  // ---- Video Ready toggle: students only ever see the video prompt/link
  // once this is explicitly ticked, regardless of whether a link or an
  // uploaded file is already attached above. Lets a teacher publish the
  // question + text explanation right away and add the tick later, from
  // anywhere, once the video (link or file) is actually ready. ----
  const videoReadyRow = document.createElement('label');
  videoReadyRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:var(--text);cursor:pointer;';
  const videoReadyCheckbox = document.createElement('input');
  videoReadyCheckbox.type = 'checkbox';
  videoReadyCheckbox.checked = !!q.videoReady;
  videoReadyCheckbox.style.cssText = 'width:18px;height:18px;cursor:pointer;';
  videoReadyCheckbox.onchange = () => { q.videoReady = videoReadyCheckbox.checked; if (opts.onChange) opts.onChange(); };
  videoReadyRow.appendChild(videoReadyCheckbox);
  const videoReadyText = document.createElement('span');
  videoReadyText.textContent = '✓ Video is ready - show it to students (Watch Now / Watch Video Solution)';
  videoReadyRow.appendChild(videoReadyText);
  box.appendChild(videoReadyRow);
  const videoReadyHint = document.createElement('div');
  videoReadyHint.className = 'progress-note';
  videoReadyHint.style.marginBottom = '10px';
  videoReadyHint.textContent = 'Leave unticked to publish now with just the text explanation - students see no video option at all, in any case, until you come back and tick this.';
  box.appendChild(videoReadyHint);

  // ---- Explanation (descriptive correct-answer reasoning, shown to
  // students whether they got the question right OR wrong) ----
  const explLabel = document.createElement('label');
  explLabel.className = 'row-label';
  explLabel.style.marginTop = '10px';
  explLabel.textContent = 'Explanation - the descriptive correct answer shown to students either way';
  box.appendChild(explLabel);

  box.appendChild(buildSymbolToolbar());

  const explTextarea = document.createElement('textarea');
  explTextarea.placeholder = "Explanation, e.g. Corona loss varies with frequency: P = k(f + 25)(V-V0)^2 ... For proper equation typesetting, wrap LaTeX in $ $, e.g. $\\omega C V^2 \\cos\\delta$";
  explTextarea.style.minHeight = '70px';
  explTextarea.value = q.explanation || '';
  explTextarea.oninput = () => { q.explanation = explTextarea.value; if (opts.onChange) opts.onChange(); };
  trackFocus(explTextarea);
  box.appendChild(explTextarea);

  const previewToggle = document.createElement('button');
  previewToggle.type = 'button';
  previewToggle.className = 'btn btn-secondary';
  previewToggle.style.cssText = 'font-size:12px;padding:6px 10px;margin-top:6px;';
  previewToggle.textContent = '👁 Preview how students will see this';
  const previewBox = document.createElement('div');
  previewBox.style.cssText = 'display:none;background:#f4f6fb;border-radius:8px;padding:10px 12px;margin-top:8px;font-size:14px;';
  previewToggle.onclick = () => {
    if (previewBox.style.display === 'block') { previewBox.style.display = 'none'; }
    else { renderMathPreviewInto(previewBox, explTextarea.value); }
  };
  box.appendChild(previewToggle);
  box.appendChild(previewBox);

  // ---- Attach a photo, PDF, or text file to this explanation ----
  const attachRow = document.createElement('div');
  attachRow.style.marginTop = '8px';
  const attachBtn = document.createElement('button');
  attachBtn.type = 'button';
  attachBtn.className = 'btn btn-secondary';
  attachBtn.style.fontSize = '13px';
  attachBtn.style.padding = '8px 12px';
  attachBtn.textContent = '📎 Attach photo / PDF / text to explanation';
  const attachInput = document.createElement('input');
  attachInput.type = 'file';
  attachInput.accept = '.pdf,.txt,.jpg,.jpeg,.png';
  attachInput.style.display = 'none';
  const attachPreview = document.createElement('div');
  attachPreview.style.marginTop = '8px';
  function renderAttachPreview(){
    attachPreview.innerHTML = '';
    if (q.explanationImage) {
      const img = document.createElement('img');
      img.src = q.explanationImage;
      img.style.cssText = 'max-width:160px;border-radius:8px;display:block;margin-bottom:6px;';
      attachPreview.appendChild(img);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'remove-q';
      rm.textContent = 'Remove attached image';
      rm.onclick = () => { q.explanationImage = null; renderAttachPreview(); if (opts.onChange) opts.onChange(); };
      attachPreview.appendChild(rm);
    }
  }
  renderAttachPreview();
  attachBtn.onclick = () => attachInput.click();
  attachInput.onchange = async () => {
    const file = attachInput.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'txt') {
        const text = await file.text();
        q.explanation = (q.explanation ? q.explanation + '\n' : '') + text.trim();
        explTextarea.value = q.explanation;
      } else if (ext === 'pdf') {
        setStatus('Reading PDF for explanation...');
        const text = await extractPdfText(file);
        q.explanation = (q.explanation ? q.explanation + '\n' : '') + text.trim();
        explTextarea.value = q.explanation;
        setStatus('Explanation text added from PDF.', 'ok');
      } else if (['jpg','jpeg','png'].includes(ext) || file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => { q.explanationImage = reader.result; renderAttachPreview(); if (opts.onChange) opts.onChange(); };
        reader.readAsDataURL(file);
      }
      if (opts.onChange) opts.onChange();
    } catch (err) {
      setStatus('Attachment failed: ' + err.message, 'error');
    }
    attachInput.value = '';
  };
  attachRow.appendChild(attachBtn);
  attachRow.appendChild(attachInput);
  attachRow.appendChild(attachPreview);
  box.appendChild(attachRow);

  if (opts.onRemove) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-q';
    removeBtn.textContent = opts.removeLabel || 'Remove this question';
    removeBtn.onclick = opts.onRemove;
    box.appendChild(removeBtn);
  }

  return box;
}

function renderQuestionBlocks(){
  questionsSection.innerHTML = '';
  parsedQuestions.forEach((q, i) => {
    const card = buildQuestionCard(q, {
      label: `Question ${i + 1}`,
      onRemove: () => { parsedQuestions.splice(i, 1); renderQuestionBlocks(); },
      onChange: () => saveDraft()
    });
    questionsSection.appendChild(card);
  });

  const note = document.createElement('div');
  note.className = 'progress-note';
  note.textContent = `${parsedQuestions.length} question(s) detected. Check each one - automatic splitting isn't perfect, especially for photos/scans.`;
  questionsSection.appendChild(note);
}

// ---------- Merge parsed questions into DATA, shared by both export paths ----------
function mergeIntoData(){
  const subjId = subjectSelect.value;
  const subtId = subtopicSelect.value;
  const level = levelSelect.value;

  const subj = DATA.subjects.find(s => s.id === subjId);
  const subt = subj.subtopics.find(s => s.id === subtId);
  if (!subt.levels[level]) subt.levels[level] = [];

  let addedCount = 0;
  parsedQuestions.forEach((q, i) => {
    if (!q.question) return;
    const isMcq = (q.type || 'mcq') === 'mcq';
    if (isMcq && (q.options.some(o => !o) || q.correctIndex === null)) return; // MCQ needs all 4 options + a correct one marked
    if (!isMcq && !q.correctAnswer) return; // Fill-in needs a correct answer typed in
    const id = subtId + '_l' + level + '_new' + Date.now() + '_' + i;
    subt.levels[level].push({
      id,
      type: isMcq ? 'mcq' : 'fill',
      question: q.question,
      questionImage: q.questionImage || null,
      options: isMcq ? q.options : [],
      correctIndex: isMcq ? q.correctIndex : null,
      correctAnswer: isMcq ? '' : q.correctAnswer,
      videoUrl: q.videoUrl || 'PASTE_VIDEO_LINK_HERE',
      videoFile: q.videoFile || null,
      videoReady: !!q.videoReady,
      explanation: q.explanation || '',
      explanationImage: q.explanationImage || null
    });
    addedCount++;
  });
  return { addedCount, subtopicName: subt.name, level };
}

// ---------- Download (offline fallback, same as v5) ----------
downloadBtn.addEventListener('click', () => {
  const { addedCount, subtopicName, level } = mergeIntoData();
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'questions.json';
  a.click();
  URL.revokeObjectURL(url);
  const topicNote = pendingTopicChanges ? ' New topic(s) included.' : '';
  pendingTopicChanges = false;
  setStatus(`Added ${addedCount} question(s) to ${subtopicName} (Level ${level}).${topicNote} Downloaded questions.json - replace the file in data/ manually via GitHub.`, 'ok');
});

// ---------- Publish directly to GitHub ----------
publishBtn.addEventListener('click', async () => {
  const s = loadSettings();
  if (!s || !s.user || !s.repo || !s.token) {
    setStatus('Fill in Publish Settings (username, repo, token) first, then Save Settings.', 'error');
    settingsBody.classList.add('open');
    settingsChev.textContent = '▲';
    return;
  }

  const { addedCount, subtopicName, level } = mergeIntoData();
  if (addedCount === 0 && !pendingTopicChanges) {
    setStatus('No complete questions to publish - fill in all options and mark a correct answer first.', 'error');
    return;
  }

  // GitHub's Contents API (what Publish uses) fails on writes over roughly
  // 1 MB - a much stricter limit than the 100 MB normal Git push allows.
  // Videos/images embedded in questions push this file's size up fast, so
  // check BEFORE attempting the network call, rather than let it silently
  // fail after a long wait.
  const contentStr = JSON.stringify(DATA, null, 2);
  const sizeBytes = new Blob([contentStr]).size;
  const sizeMB = sizeBytes / (1024 * 1024);
  if (sizeBytes > 900000) {
    showPublishError(
      `Can't publish automatically - your question bank is now ${sizeMB.toFixed(2)} MB, over GitHub's ~1 MB limit for this kind of update (this is a GitHub limit, not an app bug).\n\n` +
      `This is almost always caused by an uploaded video file or several images. Fix it one of two ways:\n\n` +
      `1) Tap "Download File" below, then on github.com go to your repo → data folder → click questions.json → the pencil (edit) icon → replace the content → Commit. GitHub's website accepts files up to 25 MB this way.\n\n` +
      `2) Or remove the heaviest uploaded video (use a YouTube/Drive Link instead, which barely adds any size) and try Publish again.`
    );
    return;
  }

  publishBtn.disabled = true;
  setStatus('Connecting to GitHub...');

  const apiBase = `https://api.github.com/repos/${s.user}/${s.repo}/contents/${s.path}`;
  const headers = {
    'Authorization': 'Bearer ' + s.token,
    'Accept': 'application/vnd.github+json'
  };

  try {
    // 1. Get current file SHA (required by GitHub to update an existing file)
    setStatus('Fetching current file from GitHub...');
    const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(s.branch)}`, { headers });
    if (!getRes.ok) {
      const errBody = await getRes.text();
      throw new Error(`Could not read current file (HTTP ${getRes.status}). Check username/repo/path/token. ${errBody.slice(0,300)}`);
    }
    const getJson = await getRes.json();
    const sha = getJson.sha;

    // 2. Push updated content
    setStatus('Publishing update to GitHub...');
    const base64Content = btoa(unescape(encodeURIComponent(contentStr)));

    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Add ${addedCount} question(s) to ${subtopicName} (Level ${level}) via Teacher Upload`,
        content: base64Content,
        sha,
        branch: s.branch
      })
    });

    if (!putRes.ok) {
      const errBody = await putRes.text();
      throw new Error(`Publish failed (HTTP ${putRes.status}). ${errBody.slice(0,300)}`);
    }

    const topicNote = pendingTopicChanges ? ' New topic(s) published too.' : '';
    setStatus(`Published! Added ${addedCount} question(s) to ${subtopicName} (Level ${level}).${topicNote} Students will see it after GitHub Pages rebuilds (~1-2 min).`, 'ok');
    clearDraft(); // successfully published - no need to keep the local safety-net copy
    parsedQuestions = [];
    questionsSection.innerHTML = '';
    pendingTopicChanges = false;
    rawSection.classList.add('hidden');
    accumulatedText = '';
    rawText.value = '';
    pendingSourceImages = [];
  } catch (err) {
    console.error(err);
    showPublishError('Publish error: ' + err.message);
  } finally {
    publishBtn.disabled = false;
  }
});