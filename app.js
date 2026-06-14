// ═══════════════════════════════════════════════════════════════
//  Fahad Saleem — Portfolio  |  app.js
//  Edit access : Ctrl + Shift + E  →  password prompt
//  Password    : stored as SHA-256 hash only (not plain text)
//  Images      : uploaded directly to Cloudinary → permanent URL
// ═══════════════════════════════════════════════════════════════

// ── Config ───────────────────────────────────────────────────
// SHA-256 hash of your password — to change: emn178.github.io/online-tools/sha256.html
const ADMIN_HASH        = 'c5f454eb6440bdc836166458fc452ed5b51606e2fe764c5044847f3ef6e9fbbb';
const CLOUDINARY_CLOUD  = 'dcjlfnia4';
const CLOUDINARY_PRESET = 'portfolio_upload';

// ── State ────────────────────────────────────────────────────
let editUnlocked = false;   // true only after correct password this session
let isEditMode   = false;   // current edit state

// ── SHA-256 via browser crypto API ───────────────────────────
async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── IndexedDB (unlimited storage) ────────────────────────────
let _db = null;
function openDB() {
  return new Promise((res, rej) => {
    if (_db) { res(_db); return; }
    const r = indexedDB.open('fahad_portfolio_v4', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    r.onsuccess = e => { _db = e.target.result; res(_db); };
    r.onerror   = e => rej(e.target.error);
  });
}
async function dbSet(k, v) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const tx = d.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(v, k);
    tx.oncomplete = res;
    tx.onerror    = e => rej(e.target.error);
  });
}
async function dbGet(k) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const tx  = d.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(k);
    req.onsuccess = e => res(e.target.result ?? null);
    req.onerror   = e => rej(e.target.error);
  });
}

// ── Cloudinary direct upload ──────────────────────────────────
async function uploadToCloudinary(file) {
  showOverlay('Uploading ' + file.name + '…');
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  return new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload');
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      hideOverlay();
      if (xhr.status === 200) {
        res(JSON.parse(xhr.responseText).secure_url);
      } else {
        rej(new Error('Upload failed — ' + xhr.statusText));
      }
    };
    xhr.onerror = () => { hideOverlay(); rej(new Error('Network error')); };
    xhr.send(fd);
  });
}

function showOverlay(msg) {
  document.getElementById('uploadMsg').textContent  = msg;
  document.getElementById('uploadBar').style.width  = '0%';
  document.getElementById('uploadPct').textContent  = '0%';
  document.getElementById('uploadOverlay').style.display = 'flex';
}
function setProgress(p) {
  document.getElementById('uploadBar').style.width = p + '%';
  document.getElementById('uploadPct').textContent = p + '%';
}
function hideOverlay() {
  document.getElementById('uploadOverlay').style.display = 'none';
}

// ── Admin / Edit mode ─────────────────────────────────────────
// The edit button is invisible to everyone.
// Only you know: press Ctrl+Shift+E → enter password → edit mode starts.
// On every page reload the button is hidden again — must re-enter password.

document.addEventListener('keydown', async function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    if (!editUnlocked) {
      // First time this session — ask for password
      const pw = prompt('🔐 Enter admin password:');
      if (!pw) return;
      const hash = await sha256(pw);
      if (hash !== ADMIN_HASH) { alert('❌ Wrong password.'); return; }
      editUnlocked = true;
    }
    // Toggle edit mode on/off
    setEditMode(!isEditMode);
  }
});

// Called by the "Done editing" button
function toggleEdit() {
  if (!editUnlocked) return;
  setEditMode(!isEditMode);
}

function setEditMode(on) {
  isEditMode = on;
  document.body.classList.toggle('edit-mode', on);

  // Show button only while editing — hide when done
  const btn = document.getElementById('editToggle');
  if (btn) {
    btn.style.display = on ? 'inline-block' : 'none';
    btn.textContent   = '✓ Done editing';
    btn.classList.toggle('active', on);
  }

  // Make text fields editable / read-only
  const editableFields = [
    '#heroName', '#heroTag', '#aboutP1', '#aboutP2', '#aboutP3'
  ];
  editableFields.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.contentEditable = on ? 'true' : 'false';
  });
  document.querySelectorAll(
    '.project-card h3, .project-card .desc, .project-card .tech,' +
    '.exp-item h3, .exp-item p,' +
    '.education-item h3, .education-item .institution,' +
    '.education-item .duration, .education-item .details'
  ).forEach(el => { el.contentEditable = on ? 'true' : 'false'; });

  if (!on) saveAll();
}

// ── Utility ──────────────────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Remove items with smooth animation ────────────────────────
function removeItem(btn) {
  if (!isEditMode) return;
  const targets = [
    '.skill-pill', '.project-card', '.achievement',
    '.exp-item', '.learning-item', '.education-item', '.contact-item'
  ];
  let el = null;
  for (const t of targets) { el = btn.closest(t); if (el) break; }
  if (!el) return;
  
  // Confirm before removing
  if (!confirm('Are you sure you want to remove this item?')) return;
  
  // Add fade-out animation
  el.style.animation = 'fadeOutRemove 0.3s ease-out forwards';
  
  // Remove after animation
  setTimeout(() => {
    el.remove();
    checkAchievementsEmpty();
    checkEducationEmpty();
    saveAll();
  }, 300);
}

function removeLearning(btn) { removeItem(btn); }

function checkAchievementsEmpty() {
  const list  = document.getElementById('achievementsList');
  const empty = document.getElementById('achievementsEmpty');
  if (list && empty) empty.style.display = list.querySelector('.achievement') ? 'none' : 'block';
}

function checkEducationEmpty() {
  const grid  = document.getElementById('educationGrid');
  const empty = document.getElementById('educationEmpty');
  if (grid && empty) empty.style.display = grid.querySelector('.education-item') ? 'none' : 'block';
}

// ── Click ripple highlight ────────────────────────────────────
document.addEventListener('click', function(e) {
  const el = e.target.closest(
    'button, a, .skill-pill, .learning-item, .project-card, ' +
    '.achievement, .exp-item, .education-item, .contact-item, label'
  );
  if (!el) return;
  el.classList.remove('clicked');
  void el.offsetWidth;
  el.classList.add('clicked');
  setTimeout(() => el.classList.remove('clicked'), 600);
});

// ── Save all content ──────────────────────────────────────────
async function saveAll() {
  const g   = id => { const e = document.getElementById(id); return e ? e.innerHTML   : ''; };
  const txt = id => { const e = document.getElementById(id); return e ? e.textContent : ''; };
  try {
    await dbSet('content', {
      heroName:         txt('heroName'),
      heroTag:          txt('heroTag'),
      aboutP1:          txt('aboutP1'),
      aboutP2:          txt('aboutP2'),
      aboutP3:          txt('aboutP3'),
      skillsList:       g('skillsList'),
      projectsGrid:     g('projectsGrid'),
      expList:          g('expList'),
      learningGrid:     g('learningGrid'),
      educationGrid:    g('educationGrid'),
      achievementsList: g('achievementsList'),
      contactInfoGrid:  g('contactInfoGrid'),
    });
  } catch(err) { console.error('saveAll failed:', err); }
}

// ── Load all content ──────────────────────────────────────────
async function loadAll() {
  try {
    await openDB();
    const data = await dbGet('content');
    if (data) {
      const set = (id, v) => { const e = document.getElementById(id); if (e && v) e.innerHTML   = v; };
      const txt = (id, v) => { const e = document.getElementById(id); if (e && v) e.textContent = v; };
      txt('heroName', data.heroName); txt('heroTag', data.heroTag);
      txt('aboutP1',  data.aboutP1);  txt('aboutP2', data.aboutP2); txt('aboutP3', data.aboutP3);
      set('skillsList',       data.skillsList);
      set('projectsGrid',     data.projectsGrid);
      set('expList',          data.expList);
      set('learningGrid',     data.learningGrid);
      set('educationGrid',    data.educationGrid);
      set('achievementsList', data.achievementsList);
      set('contactInfoGrid',  data.contactInfoGrid);
      checkAchievementsEmpty();
      checkEducationEmpty();
    }

    // Load avatar (stored as Cloudinary URL)
    const avatarUrl = await dbGet('avatar');
    if (avatarUrl) {
      const img = document.getElementById('avatarImg');
      if (img) { img.src = avatarUrl; img.style.display = 'block'; }
      document.getElementById('avatar')?.classList.add('has-img');
      updateAvatarBtn();
    }

    // Load project thumbnail images by data-proj-id
    document.querySelectorAll('.project-card[data-proj-id]').forEach(async card => {
      const url = await dbGet('proj_' + card.dataset.projId);
      if (url) {
        let img = card.querySelector('.project-thumb-img');
        if (img) { img.src = url; img.style.display = 'block'; }
      }
    });

    // Load education result images by data-uid on img elements
    document.querySelectorAll('img[data-uid]').forEach(async img => {
      const url = await dbGet('edu_' + img.dataset.uid);
      if (url) { img.src = url; img.style.display = 'block'; }
    });

    // Load certification images by data-cert-id on parent
    document.querySelectorAll('[data-cert-id]').forEach(async el => {
      const url = await dbGet('cert_' + el.dataset.certId);
      if (url) {
        const thumb = el.querySelector('.cert-thumb');
        const vb    = el.querySelector('.cert-view-btn');
        if (thumb) { thumb.src = url; thumb.style.display = 'block'; }
        if (vb)    vb.style.display = 'inline';
      }
    });

    // Load resume / CV
    for (const type of ['resume', 'cv']) {
      const doc = await dbGet('doc_' + type);
      if (doc) { docStore[type] = doc; refreshDocUI(type); }
    }

  } catch(err) { console.error('loadAll failed:', err); }
}

// ── Avatar ────────────────────────────────────────────────────
function updateAvatarBtn() {
  const btn = document.getElementById('avatarViewBtn');
  if (btn) btn.style.display = document.getElementById('avatar')?.classList.contains('has-img') ? 'flex' : 'none';
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  try {
    const url = await uploadToCloudinary(file);
    const img = document.getElementById('avatarImg');
    if (img) { img.src = url; img.style.display = 'block'; }
    document.getElementById('avatar')?.classList.add('has-img');
    updateAvatarBtn();
    await dbSet('avatar', url);
  } catch(e) { alert('Upload failed: ' + e.message); }
  event.target.value = '';
}

function openAvatarLightbox() {
  const img = document.getElementById('avatarImg');
  if (!img || !img.src) return;
  const lb = document.getElementById('avatarLightbox');
  if (!lb) return;
  document.getElementById('avatarLightboxImg').src = img.src;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAvatarLightbox() {
  const lb = document.getElementById('avatarLightbox');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}

// ── Skills / Learning edits ─────────────────────────────────────
function addSkill() {
  if (!isEditMode) return;
  const inp = document.getElementById('newSkillInput');
  const val = inp?.value?.trim();
  if (!val) return;
  const span = document.createElement('span');
  span.className = 'skill-pill';
  span.innerHTML = esc(val) + ' <button class="rm" onclick="removeItem(this)">×</button>';
  document.getElementById('skillsList').appendChild(span);
  inp.value = '';
  saveAll();
}

function addLearning() {
  if (!isEditMode) return;
  const topic = prompt('New learning topic:');
  if (!topic || !topic.trim()) return;
  const grid = document.getElementById('learningGrid');
  const addBtn = grid?.querySelector('.add-learning-btn');
  const div = document.createElement('div');
  div.className = 'learning-item';
  div.innerHTML = esc(topic.trim()) + '<button class="rm-learn" onclick="removeItem(this)">×</button>';
  if (addBtn) grid.insertBefore(div, addBtn);
  else grid.appendChild(div);
  saveAll();
}

// ── Projects ────────────────────────────────────────────────────
function addProject() {
  if (!isEditMode) return;
  const title = prompt('Project title:');
  if (!title) return;
  const desc = prompt('Project description:') || '';
  const tech = prompt('Technologies (comma-separated):') || '';
  const demoUrl = prompt('Demo video link:') || '#';
  const githubUrl = prompt('GitHub link:') || '#';

  const id = 'proj' + Date.now();
  const card = document.createElement('div');
  card.className = 'project-card';
  card.dataset.projId = id;
  card.innerHTML = `
    <button class="rm-project" onclick="removeItem(this)">remove</button>
    <div class="project-thumb-wrap"><img class="project-thumb-img" src="" alt="" style="display:none;width:100%;height:160px;object-fit:cover;border-radius:8px;margin-bottom:10px"></div>
    <h3 contenteditable="true">${esc(title)}</h3>
    <p class="desc" contenteditable="true">${esc(desc)}</p>
    <p class="tech" contenteditable="true">${esc(tech)}</p>
    <div class="project-links">
      <a href="${demoUrl}" target="_blank">Demo video</a>
      <a href="${githubUrl}" target="_blank">GitHub</a>
    </div>
    <button class="btn small edit-links-btn" onclick="editProjectLinks(this)" style="margin-top:10px;">Edit links</button>
  `;
  const grid = document.getElementById('projectsGrid');
  const addCard = grid?.querySelector('.add-project-card');
  if (addCard) grid.insertBefore(card, addCard);
  else grid.appendChild(card);
  saveAll();
}

function editProjectLinks(btn) {
  if (!isEditMode) return;
  const card = btn.closest('.project-card');
  if (!card) return;
  const links = card.querySelectorAll('a');
  const demo = links[0]?.href || '';
  const github = links[1]?.href || '';
  
  const newDemo = prompt('Demo video link:', demo) || '';
  const newGithub = prompt('GitHub link:', github) || '';
  
  if (newDemo && links[0]) links[0].href = newDemo;
  if (newGithub && links[1]) links[1].href = newGithub;
  saveAll();
}

// ── Experience ────────────────────────────────────────────────
function addExperience() {
  if (!isEditMode) return;
  const title = prompt('Job title:');
  if (!title) return;
  const desc = prompt('Job description:') || '';

  const item = document.createElement('div');
  item.className = 'exp-item';
  item.innerHTML = `
    <h3 contenteditable="true">${esc(title)}</h3>
    <p contenteditable="true">${esc(desc)}</p>
    <button class="rm-exp" onclick="removeItem(this)">remove</button>
  `;
  const list = document.getElementById('expList');
  list?.appendChild(item);
  saveAll();
}

// ── Education ─────────────────────────────────────────────────
function addEducation() {
  if (!isEditMode) return;
  const degree = prompt('Degree/Program:');
  if (!degree) return;
  const institution = prompt('Institution/University:') || '';
  const duration = prompt('Duration (e.g., 2021 - 2025):') || '';
  const details = prompt('Details/Description:') || '';

  const uid = 'edu' + Date.now();
  const item = document.createElement('div');
  item.className = 'education-item';
  item.dataset.eduId = uid;
  item.innerHTML = `
    <button class="rm-edu" onclick="removeItem(this)">remove</button>
    <div class="education-header">
      <h3 contenteditable="true">${esc(degree)}</h3>
      <p class="institution" contenteditable="true">${esc(institution)}</p>
      <p class="duration" contenteditable="true">${esc(duration)}</p>
    </div>
    <p class="details" contenteditable="true">${esc(details)}</p>
    <div class="education-result-wrap">
      <img class="result-thumb" src="" alt="Result" data-uid="${uid}" style="display:none;width:80px;height:80px;border-radius:8px;border:1.5px solid rgba(201,163,90,0.4);cursor:pointer;object-fit:cover;margin-right:12px" onclick="openCertLightbox(this.src)">
      <div class="result-info">
        <span class="result-label">Result/Transcript</span>
        <label class="result-upload-lbl">Upload result<input type="file" accept="image/*" style="display:none;" onchange="handleEducationResult(event,this,'${uid}')"></label>
      </div>
    </div>
  `;
  const grid = document.getElementById('educationGrid');
  const addCard = grid?.querySelector('.add-education-card');
  if (addCard) grid.insertBefore(item, addCard);
  else grid.appendChild(item);
  saveAll();
}

async function handleEducationResult(event, input, uid) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const url = await uploadToCloudinary(file);
    const img = input.closest('.education-result-wrap').querySelector('img[data-uid]');
    if (img) { img.src = url; img.style.display = 'block'; }
    await dbSet('edu_' + uid, url);
    saveAll();
  } catch(e) { alert('Upload failed: ' + e.message); }
  event.target.value = '';
}

// ── Achievements / Certifications ────────────────────────────
function addAchievement() {
  if (!isEditMode) return;
  const input = document.getElementById('newAchievementInput');
  const val = input?.value?.trim();
  if (!val) return;
  
  const uid = 'cert' + Date.now();
  const div = document.createElement('div');
  div.className = 'achievement';
  div.dataset.certId = uid;
  div.innerHTML = `
    <div class="cert-img-wrap">
      <img class="cert-thumb" src="" alt="cert" data-uid="${uid}" style="display:none;width:60px;height:60px;border-radius:6px;border:1px solid rgba(201,163,90,0.4);cursor:pointer;object-fit:cover" onclick="openCertLightbox(this.src)">
    </div>
    <span>${esc(val)}</span>
    <label class="cert-upload-lbl" title="Upload certificate image">Add image<input type="file" accept="image/*" style="display:none" onchange="handleCertImg(event,this,'${uid}')"></label>
    <button class="rm" onclick="removeItem(this)">remove</button>
  `;
  document.getElementById('achievementsList').appendChild(div);
  input.value = '';
  checkAchievementsEmpty();
  saveAll();
}

async function handleCertImg(event, input, uid) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const url = await uploadToCloudinary(file);
    let img = input.closest('[data-cert-id]').querySelector('.cert-thumb');
    if (!img) {
      img = document.createElement('img');
      img.className = 'cert-thumb';
      img.alt = 'cert';
      img.style.cssText = 'width:60px;height:60px;border-radius:6px;border:1px solid rgba(201,163,90,0.4);cursor:pointer;object-fit:cover';
      img.onclick = function() { openCertLightbox(this.src); };
      input.closest('[data-cert-id]').querySelector('.cert-img-wrap').appendChild(img);
    }
    img.src = url;
    img.style.display = 'block';
    await dbSet('cert_' + uid, url);
    saveAll();
  } catch(e) { alert('Upload failed: ' + e.message); }
  event.target.value = '';
}

// ── Contact items ───────────────────────────────────────────
function addContact() {
  if (!isEditMode) return;
  const type = prompt('Contact type (email, phone, linkedin, github, etc.):');
  if (!type) return;
  const value = prompt('Contact value (e.g., email@example.com):');
  if (!value) return;
  
  const div = document.createElement('div');
  div.className = 'contact-item';
  div.dataset.contactType = type.toLowerCase();
  div.style.cursor = 'pointer';
  div.onclick = function() { openContactLink(this); };
  div.innerHTML = `
    <div class="contact-box">
      <span class="contact-label">${esc(type)}</span>
      <div class="contact-value" contenteditable="false">${esc(value)}</div>
    </div>
    <button class="rm-contact edit-only" onclick="removeItem(this)">×</button>
  `;
  document.getElementById('contactInfoGrid').appendChild(div);
  saveAll();
}

// ── Lightbox ────────────────────────────────────────────────
function openCertLightbox(src) {
  const lb = document.getElementById('certLightbox');
  if (!lb) return;
  document.getElementById('certLightboxImg').src = src;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeCertLightbox() {
  const lb = document.getElementById('certLightbox');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}

// ── Document Store (for resume/cv) ──────────────────────────
const docStore = {};

async function handleDocUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const reader = new FileReader();
    reader.onload = async function(e) {
      docStore[type] = {
        name: file.name,
        data: e.target.result,
        size: file.size
      };
      refreshDocUI(type);
      await dbSet('doc_' + type, docStore[type]);
    };
    reader.readAsDataURL(file);
  } catch(err) { alert('Upload failed: ' + err.message); }
  event.target.value = '';
}

function refreshDocUI(type) {
  const meta    = document.getElementById(type + 'Meta');
  const openBtn = document.getElementById(type + 'OpenBtn');
  const rmBtn   = document.getElementById(type + 'RmBtn');
  if (!meta) return;
  if (docStore[type]) {
    const kb = Math.round(docStore[type].size / 1024);
    meta.textContent = docStore[type].name + ' — ' + (kb > 1024 ? (kb/1024).toFixed(1) + ' MB' : kb + ' KB');
    if (openBtn) openBtn.style.display = 'inline-block';
    if (rmBtn)   rmBtn.style.display   = '';
  } else {
    meta.textContent = 'No file uploaded yet';
    if (openBtn) openBtn.style.display = 'none';
    if (rmBtn)   rmBtn.style.display   = 'none';
  }
  if (type === 'resume') updateHeroResumeBtn();
}

function openDoc(type) {
  const doc = docStore[type];
  if (!doc) { alert('No document uploaded yet.'); return; }
  const win = window.open('', '_blank');
  if (!win) { alert('Pop-ups are blocked. Please allow pop-ups for this site.'); return; }
  win.document.write(
    '<html><body style="margin:0">' +
    '<iframe src="' + doc.data + '" style="width:100%;height:100vh;border:none"></iframe>' +
    '</body></html>'
  );
}

async function removeDoc(type) {
  if (!isEditMode) return;
  if (!confirm('Remove this document?')) return;
  docStore[type] = null;
  refreshDocUI(type);
  await dbSet('doc_' + type, null);
}

// ── Contact item click — opens link (NOT edit) ───────────────
function openContactLink(el) {
  if (isEditMode) return; // in edit mode, don't follow links
  const val = el.querySelector('.contact-value')?.textContent?.trim() || 
              el.querySelector('.contact-val')?.textContent?.trim() || '';
  const type = el.dataset.contactType || '';
  if (!val) return;
  let url = val;
  if (type === 'email' || val.includes('@')) url = 'mailto:' + val;
  else if (!val.startsWith('http')) url = 'https://' + val;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Contact form send message (FormSubmit service) ──────────────
function handleContactForm(e) {
  e.preventDefault();
  const nameEl = document.getElementById('contactName');
  const emailEl = document.getElementById('contactEmail');
  const messageEl = document.getElementById('contactMessage');
  
  const name    = nameEl?.value?.trim() || '';
  const email   = emailEl?.value?.trim() || '';
  const message = messageEl?.value?.trim() || '';
  
  // Validate all fields
  if (!name) { alert('Please enter your name.'); nameEl?.focus(); return; }
  if (!email) { alert('Please enter your email.'); emailEl?.focus(); return; }
  if (!message) { alert('Please enter your message.'); messageEl?.focus(); return; }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Please enter a valid email address.');
    emailEl?.focus();
    return;
  }
  
  // Create mailto with properly formatted email
  const subject = encodeURIComponent('Portfolio Contact from ' + name);
  const bodyText = 'Name: ' + name + '\nEmail: ' + email + '\n\nMessage:\n' + message;
  const body = encodeURIComponent(bodyText);
  
  // Use mailto to open email client with pre-filled info
  const mailtoURL = 'mailto:nexora.dev7@gmail.com?subject=' + subject + '&body=' + body;
  
  // Open email client
  window.location.href = mailtoURL;
  
  // Clear form
  setTimeout(() => {
    nameEl.value = '';
    emailEl.value = '';
    messageEl.value = '';
  }, 500);
}

// ── Highlight download resume button when doc is loaded ──────
function updateHeroResumeBtn() {
  const btn = document.getElementById('resumeBtnHero');
  if (!btn) return;
  if (docStore.resume) {
    btn.removeAttribute('disabled');
    btn.style.opacity = '1';
  } else {
    btn.style.opacity = '0.45';
  }
}

// ── Boot ──────────────────────────────────────────────────────
window.addEventListener('load', async function() {
  await loadAll();
  updateAvatarBtn();
  ['resume', 'cv'].forEach(t => refreshDocUI(t));
  updateHeroResumeBtn();
  // Edit button always hidden on load
  const btn = document.getElementById('editToggle');
  if (btn) btn.style.display = 'none';
});
