const ADMIN_HASH        = 'c5f454eb6440bdc836166458fc452ed5b51606e2fe764c5044847f3ef6e9fbbb';
const CLOUDINARY_CLOUD  = 'dcjlfnia4';
const CLOUDINARY_PRESET = 'portfolio_upload';

let editUnlocked = false;
let isEditMode   = false;

async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

let _db = null;
function openDB() {
  return new Promise((res, rej) => {
    if (_db) { res(_db); return; }
    const r = indexedDB.open('fahad_pf_v5', 1);
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
    tx.onerror = e => rej(e.target.error);
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

function showOverlay(msg) {
  const o = document.getElementById('uploadOverlay');
  if (!o) return;
  o.classList.add('open');
  document.getElementById('uploadMsg').textContent = msg;
  document.getElementById('uploadBar').style.width = '0%';
  document.getElementById('uploadPct').textContent = '0%';
}
function setProgress(p) {
  const b = document.getElementById('uploadBar');
  const t = document.getElementById('uploadPct');
  if (b) b.style.width = p + '%';
  if (t) t.textContent = p + '%';
}
function hideOverlay() {
  const o = document.getElementById('uploadOverlay');
  if (o) o.classList.remove('open');
}

async function uploadToCloudinary(file) {
  showOverlay('Uploading ' + file.name + '...');
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
        rej(new Error('Upload failed (' + xhr.status + ') - check Cloudinary preset is Unsigned'));
      }
    };
    xhr.onerror = () => { hideOverlay(); rej(new Error('Network error - check internet connection')); };
    xhr.send(fd);
  });
}

async function uploadDocToCloudinary(file) {
  showOverlay('Uploading ' + file.name + '...');
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  return new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/raw/upload');
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      hideOverlay();
      if (xhr.status === 200) {
        res(JSON.parse(xhr.responseText).secure_url);
      } else {
        rej(new Error('Upload failed (' + xhr.status + ')'));
      }
    };
    xhr.onerror = () => { hideOverlay(); rej(new Error('Network error')); };
    xhr.send(fd);
  });
}

document.addEventListener('keydown', async function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    if (!editUnlocked) {
      const pw = prompt('Password:');
      if (!pw) return;
      const hash = await sha256(pw);
      if (hash !== ADMIN_HASH) { alert('Wrong password.'); return; }
      editUnlocked = true;
    }
    setEditMode(!isEditMode);
  }
});

function toggleEdit() {
  if (!editUnlocked) return;
  setEditMode(!isEditMode);
}

function setEditMode(on) {
  isEditMode = on;
  document.body.classList.toggle('edit-mode', on);
  const btn = document.getElementById('editToggle');
  if (btn) {
    btn.style.display = on ? 'inline-block' : 'none';
    btn.textContent   = on ? 'Done editing' : 'Edit';
  }
  ['#heroName','#heroTag','#aboutP1','#aboutP2','#aboutP3'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.contentEditable = on ? 'true' : 'false';
  });
  document.querySelectorAll(
    '.project-card h3,.project-card .desc,.project-card .tech,' +
    '.exp-item h3,.exp-item p,' +
    '.education-item h3,.education-item .institution,' +
    '.education-item .duration,.education-item .details'
  ).forEach(el => { el.contentEditable = on ? 'true' : 'false'; });
  if (!on) saveAll();
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function removeItem(btn) {
  if (!isEditMode) return;
  const selectors = [
    '.skill-pill','.project-card','.achievement',
    '.exp-item','.learning-item','.education-item','.contact-item'
  ];
  let el = null;
  for (const s of selectors) { el = btn.closest(s); if (el) break; }
  if (!el) return;
  el.remove();
  checkAchievementsEmpty();
  checkEducationEmpty();
  saveAll();
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

document.addEventListener('click', function(e) {
  const el = e.target.closest(
    'button,a,.skill-pill,.learning-item,.project-card,.achievement,.exp-item,.education-item'
  );
  if (!el) return;
  el.classList.remove('clicked');
  void el.offsetWidth;
  el.classList.add('clicked');
  setTimeout(() => el.classList.remove('clicked'), 600);
});

async function saveAll() {
  const g   = id => { const e = document.getElementById(id); return e ? e.innerHTML   : ''; };
  const txt = id => { const e = document.getElementById(id); return e ? e.textContent : ''; };
  try {
    await dbSet('content_v5', {
      heroName: txt('heroName'), heroTag: txt('heroTag'),
      aboutP1:  txt('aboutP1'),  aboutP2: txt('aboutP2'), aboutP3: txt('aboutP3'),
      skillsList: g('skillsList'), projectsGrid: g('projectsGrid'),
      expList: g('expList'), learningGrid: g('learningGrid'),
      educationGrid: g('educationGrid'), achievementsList: g('achievementsList'),
      contactInfoGrid: g('contactInfoGrid'),
    });
  } catch(err) { console.error('save failed', err); }
}

async function loadAll() {
  try {
    await openDB();
    const data = await dbGet('content_v5');
    if (data) {
      const s   = (id, v) => { const e = document.getElementById(id); if (e && v) e.innerHTML   = v; };
      const txt = (id, v) => { const e = document.getElementById(id); if (e && v) e.textContent = v; };
      txt('heroName', data.heroName); txt('heroTag', data.heroTag);
      txt('aboutP1',  data.aboutP1);  txt('aboutP2', data.aboutP2); txt('aboutP3', data.aboutP3);
      s('skillsList', data.skillsList); s('projectsGrid', data.projectsGrid);
      s('expList', data.expList);       s('learningGrid', data.learningGrid);
      s('educationGrid', data.educationGrid);
      s('achievementsList', data.achievementsList);
      s('contactInfoGrid', data.contactInfoGrid);
      checkAchievementsEmpty();
      checkEducationEmpty();
    }

    const avatarUrl = await dbGet('avatar_v5');
    if (avatarUrl) {
      const img    = document.getElementById('avatarImg');
      const avatar = document.getElementById('avatar');
      if (img) {
        img.src = avatarUrl;
        img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
      }
      if (avatar) avatar.classList.add('has-img');
      updateAvatarBtn();
    }

    document.querySelectorAll('.project-card[data-proj-id]').forEach(async card => {
      const url = await dbGet('proj_' + card.dataset.projId);
      if (url) {
        let img = card.querySelector('.project-thumb-img');
        if (img) { img.src = url; img.style.display = 'block'; }
      }
    });

    document.querySelectorAll('img[data-uid]').forEach(async img => {
      const url = await dbGet('edu_' + img.dataset.uid);
      if (url) { img.src = url; img.style.display = 'block'; }
    });

    document.querySelectorAll('[data-cert-id]').forEach(async el => {
      const url = await dbGet('cert_' + el.dataset.certId);
      if (url) {
        const thumb = el.querySelector('.cert-thumb');
        const vb    = el.querySelector('.cert-view-btn');
        if (thumb) { thumb.src = url; thumb.style.display = 'block'; }
        if (vb)    vb.style.display = 'inline';
      }
    });

    for (const type of ['resume', 'cv']) {
      const doc = await dbGet('doc_' + type);
      if (doc) { docStore[type] = doc; refreshDocUI(type); }
    }
  } catch(err) { console.error('load failed', err); }
}

function updateAvatarBtn() {
  const btn    = document.getElementById('avatarViewBtn');
  const avatar = document.getElementById('avatar');
  if (btn && avatar) btn.style.display = avatar.classList.contains('has-img') ? 'flex' : 'none';
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const url    = await uploadToCloudinary(file);
    const img    = document.getElementById('avatarImg');
    const avatar = document.getElementById('avatar');
    if (img) { img.src = url; img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;'; }
    if (avatar) avatar.classList.add('has-img');
    updateAvatarBtn();
    await dbSet('avatar_v5', url);
  } catch(e) { alert('Photo upload failed: ' + e.message); }
  event.target.value = '';
}

function openAvatarLightbox() {
  const src = document.getElementById('avatarImg')?.src;
  if (!src || src === window.location.href) return;
  document.getElementById('avatarLightboxImg').src = src;
  document.getElementById('avatarLightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAvatarLightbox() {
  document.getElementById('avatarLightbox').classList.remove('open');
  document.body.style.overflow = '';
}
function openCertLightbox(src) {
  if (!src || src === window.location.href) return;
  document.getElementById('certLightboxImg').src = src;
  document.getElementById('certLightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCertLightbox() {
  document.getElementById('certLightbox').classList.remove('open');
  document.body.style.overflow = '';
}
async function openCertLightboxById(uid) {
  const url = await dbGet('cert_' + uid);
  if (url) openCertLightbox(url);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeAvatarLightbox(); closeCertLightbox(); }
});

function addSkill() {
  const inp = document.getElementById('newSkillInput');
  const val = inp.value.trim();
  if (!val) return;
  const pill = document.createElement('span');
  pill.className = 'skill-pill';
  pill.innerHTML = esc(val) + '<button class="rm" onclick="removeItem(this)" title="Remove">×</button>';
  document.getElementById('skillsList').appendChild(pill);
  inp.value = '';
  saveAll();
}

function addProject() {
  const name = prompt('Project name:');
  if (!name?.trim()) return;
  const desc = prompt('Description:') || '';
  const tech = prompt('Tech stack:')  || '';
  const link = prompt('GitHub URL:')  || '#';
  const uid  = 'p' + Date.now();
  const div  = document.createElement('div');
  div.className = 'project-card';
  div.dataset.projId = uid;
  div.innerHTML = `
    <button class="rm-project" onclick="removeItem(this)" title="Remove">×</button>
    <h3 contenteditable="false">${esc(name.trim())}</h3>
    <p class="desc" contenteditable="false">${esc(desc.trim())}</p>
    <p class="tech" contenteditable="false">${esc(tech.trim())}</p>
    <div class="project-links"><a href="${esc(link)}" target="_blank" rel="noopener">GitHub</a></div>
    <div class="project-actions">
      <button class="action-btn" onclick="editProjectLinks(this)">Edit links</button>
    </div>`;
  document.getElementById('projectsGrid').appendChild(div);
  saveAll();
}

function editProjectLinks(btn) {
  const card  = btn.closest('.project-card');
  const links = card.querySelectorAll('.project-links a');
  links.forEach(a => {
    const cur = a.href !== window.location.href ? a.href : '';
    const nw  = prompt('URL for "' + a.textContent.trim() + '":', cur);
    if (nw !== null) a.href = nw.trim() || '#';
  });
  saveAll();
}

function addExperience() {
  const title = prompt('Job title:');
  if (!title?.trim()) return;
  const desc = prompt('Description:') || '';
  const div  = document.createElement('div');
  div.className = 'exp-item';
  div.innerHTML = `
    <h3 contenteditable="false">${esc(title.trim())}</h3>
    <p contenteditable="false">${esc(desc.trim())}</p>
    <button class="rm rm-exp" onclick="removeItem(this)">remove</button>`;
  document.getElementById('expList').appendChild(div);
  saveAll();
}

function addLearning() {
  const topic = prompt('Learning topic:');
  if (!topic?.trim()) return;
  const grid   = document.getElementById('learningGrid');
  const addBtn = grid.querySelector('.add-learning-btn');
  const div    = document.createElement('div');
  div.className = 'learning-item';
  div.innerHTML = esc(topic.trim()) + '<button class="rm-learn" onclick="removeItem(this)" title="Remove">×</button>';
  grid.insertBefore(div, addBtn);
  saveAll();
}

function addAchievement() {
  const inp = document.getElementById('newAchievementInput');
  const val = inp.value.trim();
  if (!val) return;
  const uid = 'c' + Date.now();
  const div = document.createElement('div');
  div.className      = 'achievement';
  div.dataset.certId = uid;
  div.innerHTML = `
    <img class="cert-thumb" src="" alt="Certificate"
         style="display:none;width:40px;height:40px;border-radius:6px;object-fit:cover;cursor:pointer;flex-shrink:0"
         onclick="openCertLightbox(this.src)">
    <span style="flex:1">${esc(val)}</span>
    <button class="cert-view-btn" style="display:none;font-size:10px;color:#c9a35a;background:none;border:none;cursor:pointer"
            onclick="openCertLightboxById('${uid}')">View</button>
    <label class="cert-upload-lbl" style="font-size:10px;color:#9b9ea7;cursor:pointer">Add image
      <input type="file" accept="image/*" style="display:none" onchange="handleCertImg(event,this,'${uid}')">
    </label>
    <button class="rm" onclick="removeItem(this)">x</button>`;
  document.getElementById('achievementsList').appendChild(div);
  inp.value = '';
  checkAchievementsEmpty();
  saveAll();
}

async function handleCertImg(event, input, uid) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const url   = await uploadToCloudinary(file);
    const item  = input.closest('.achievement');
    const thumb = item?.querySelector('.cert-thumb');
    const vb    = item?.querySelector('.cert-view-btn');
    if (thumb) { thumb.src = url; thumb.style.display = 'block'; }
    if (vb)    vb.style.display = 'inline';
    await dbSet('cert_' + uid, url);
    await saveAll();
  } catch(e) { alert('Upload failed: ' + e.message); }
}

function addEducation() {
  const deg  = prompt('Degree:');
  if (!deg?.trim()) return;
  const inst = prompt('Institution:') || '';
  const yrs  = prompt('Years:')       || '';
  const det  = prompt('Description:') || '';
  const uid  = 'e' + Date.now();
  const div  = document.createElement('div');
  div.className = 'education-item';
  div.dataset.eduId = uid;
  div.innerHTML = `
    <button class="rm-edu" onclick="removeItem(this)">remove</button>
    <div class="education-header">
      <h3 contenteditable="false">${esc(deg.trim())}</h3>
      <p class="institution" contenteditable="false">${esc(inst.trim())}</p>
      <p class="duration" contenteditable="false">${esc(yrs.trim())}</p>
    </div>
    <p class="details" contenteditable="false">${esc(det.trim())}</p>`;
  document.getElementById('educationGrid').appendChild(div);
  checkEducationEmpty();
  saveAll();
}



function addContact() {
  const label = prompt('Label (e.g. Phone):');
  if (!label?.trim()) return;
  const val = prompt('Value or URL:') || '';
  const div = document.createElement('div');
  div.className = 'contact-item';
  div.innerHTML = `
    <span class="contact-label">${esc(label.trim())}</span>
    <span class="contact-val">${esc(val.trim())}</span>
    <button class="rm-contact" onclick="removeItem(this)" title="Remove">x</button>`;
  document.getElementById('contactInfoGrid').appendChild(div);
  saveAll();
}

function openContactLink(el) {
  if (isEditMode) return;
  const val = el.querySelector('.contact-val')?.textContent?.trim() ||
              el.querySelector('.contact-value')?.textContent?.trim() || '';
  if (!val) return;
  let url = val;
  if (val.includes('@') && !val.startsWith('http')) {
    url = 'https://mail.google.com/mail/u/0/?view=cm&fs=1&to=' + encodeURIComponent(val);
  }
  else if (!val.startsWith('http') && !val.startsWith('mailto')) url = 'https://' + val;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function handleContactForm(e) {
  e.preventDefault();
  const name    = document.getElementById('contactName')?.value?.trim()    || '';
  const email   = document.getElementById('contactEmail')?.value?.trim()   || '';
  const message = document.getElementById('contactMessage')?.value?.trim() || '';
  if (!name)    { alert('Please enter your name.');    return; }
  if (!email)   { alert('Please enter your email.');   return; }
  if (!message) { alert('Please enter your message.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Please enter a valid email.'); return; }
  
  const formData = new FormData();
  formData.append('name', name);
  formData.append('email', email);
  formData.append('message', message);
  
  fetch('https://formspree.io/f/xdkzojdd', {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json'
    }
  })
  .then(response => {
    if (response.ok) {
      alert('Message sent successfully! I will get back to you soon.');
      document.getElementById('contactName').value = '';
      document.getElementById('contactEmail').value = '';
      document.getElementById('contactMessage').value = '';
    } else {
      alert('Failed to send message. Please try again.');
    }
  })
  .catch(error => {
    alert('Error sending message. Please check your internet connection.');
  });
}

const docStore = { resume: null, cv: null };

async function handleDocUpload(event, type) {
  if (!isEditMode) return;
  const file = event.target.files[0];
  if (!file) return;
  try {
    const url = await uploadDocToCloudinary(file);
    docStore[type] = { name: file.name, url: url, size: file.size };
    refreshDocUI(type);
    await dbSet('doc_' + type, docStore[type]);
  } catch(e) { alert('Upload failed: ' + e.message); }
  event.target.value = '';
}

function refreshDocUI(type) {
  const doc     = docStore[type];
  const meta    = document.getElementById(type + 'Meta');
  const openBtn = document.getElementById(type + 'OpenBtn');
  const dlBtn   = document.getElementById(type + 'DlBtn');
  const rmBtn   = document.getElementById(type + 'RmBtn');
  if (!meta) return;
  if (doc && (doc.url || doc.data)) {
    const kb = Math.round((doc.size || 0) / 1024);
    meta.textContent = doc.name + ' — ' + (kb > 1024 ? (kb/1024).toFixed(1) + ' MB' : kb + ' KB');
    if (openBtn) openBtn.style.display = 'inline-block';
    if (dlBtn)   dlBtn.style.display   = 'inline-block';
    if (rmBtn)   rmBtn.style.display   = '';
    if (type === 'resume') {
      const h = document.getElementById('resumeBtnHero');
      if (h) h.removeAttribute('disabled');
    }
  } else {
    meta.textContent = 'No file uploaded';
    if (openBtn) openBtn.style.display = 'none';
    if (dlBtn)   dlBtn.style.display   = 'none';
    if (rmBtn)   rmBtn.style.display   = 'none';
  }
}

function openDoc(type) {
  const doc = docStore[type];
  if (!doc) { alert('No document uploaded yet.'); return; }
  const src = doc.url || doc.data;
  if (!src) { alert('No document available.'); return; }
  window.open(src, '_blank', 'noopener,noreferrer');
}

function downloadDoc(type) {
  const doc = docStore[type];
  if (!doc) { alert('No document uploaded yet.'); return; }
  const src = doc.url || doc.data;
  if (!src) return;
  const a = document.createElement('a');
  a.href = src;
  a.download = doc.name || type + '.pdf';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function removeDoc(type) {
  if (!isEditMode) return;
  if (!confirm('Remove this document?')) return;
  docStore[type] = null;
  refreshDocUI(type);
  await dbSet('doc_' + type, null);
}

window.addEventListener('load', async function() {
  await loadAll();
  updateAvatarBtn();
  ['resume', 'cv'].forEach(t => refreshDocUI(t));
  const editBtn = document.getElementById('editToggle');
  if (editBtn) editBtn.style.display = 'none';
});
