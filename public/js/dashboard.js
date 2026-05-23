const db = firebase.firestore();
let currentUser = null;
let currentProfile = null;
let currentUsername = null;
let trackCount = 0;

// Auth guard
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  currentUser = user;

  // Save user info to Firestore (for admin tracking)
  try {
    await db.collection('users').doc(user.uid).set({
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: user.metadata.creationTime || ''
    }, { merge: true });
  } catch (e) {}

  await loadProfile();
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('dashContainer').style.display = 'block';
});

function signOut() {
  firebase.auth().signOut().then(() => {
    window.location.href = '/';
  });
}

async function loadProfile() {
  try {
    const doc = await db.collection('profiles').doc(currentUser.uid).get();
    if (doc.exists) {
      currentProfile = doc.data();
      currentUsername = currentProfile.username || '';
      populateForm(currentProfile);
      loadClientStats();
    } else {
      addTrackRow();
    }
  } catch (err) {
    console.error('Error loading profile:', err);
    addTrackRow();
  }
}

function populateForm(p) {
  document.getElementById('usernameInput').value = p.username || '';
  document.getElementById('displayName').value = p.displayName || '';
  document.getElementById('tagline').value = p.tagline || '';
  document.getElementById('country').value = p.country || '';
  document.getElementById('selectedTemplate').value = p.template || 'cyberpunk';
  selectTemplate(p.template || 'cyberpunk', true);
  document.getElementById('countryFlag').value = p.countryFlag || '';
  document.getElementById('contactEmail').value = p.contactEmail || '';
  document.getElementById('discordId').value = p.discordId || '';
  document.getElementById('githubUser').value = p.githubUser || '';
  document.getElementById('bgVideoUrl').value = p.bgVideo || '';

  // Socials
  const socials = p.socials || {};
  document.getElementById('socialDiscord').value = socials.discord || '';
  document.getElementById('socialGithub').value = socials.github || '';
  document.getElementById('socialYoutube').value = socials.youtube || '';
  document.getElementById('socialTiktok').value = socials.tiktok || '';
  document.getElementById('socialInstagram').value = socials.instagram || '';
  document.getElementById('socialFacebook').value = socials.facebook || '';
  document.getElementById('socialSpotify').value = socials.spotify || '';
  document.getElementById('socialSteam').value = socials.steam || '';
  document.getElementById('socialTwitch').value = socials.twitch || '';
  document.getElementById('socialWebsite').value = socials.website || '';

  // Colors
  document.getElementById('colorPrimary').value = p.colors?.primary || '#00f5ff';
  document.getElementById('colorSecondary').value = p.colors?.secondary || '#a855f7';
  document.getElementById('colorAccent').value = p.colors?.accent || '#f472b6';

  // Tracks
  const tracks = p.tracks || [];
  if (tracks.length === 0) {
    addTrackRow();
  } else {
    tracks.forEach(t => addTrackRow(t));
  }

  // Games
  const games = p.games || [];
  if (games.length === 0) {
    addGameRow();
  } else {
    games.forEach(g => addGameRow(g));
  }

  // Update URL display
  if (p.username) {
    const url = `${window.location.origin}/u/${p.username}`;
    document.getElementById('dashUrl').innerHTML = `Your profile: <a href="${url}" target="_blank">${url}</a>`;
    const viewLink = document.getElementById('viewProfileLink');
    viewLink.href = url;
    viewLink.style.display = 'inline';
  }

  // Username field readonly if already set
  if (p.username) {
    document.getElementById('usernameInput').readOnly = true;
    document.getElementById('checkUsernameBtn').style.display = 'none';
    document.getElementById('editUsernameBtn').style.display = 'inline-flex';
    document.getElementById('usernameHint').textContent = 'Your current username. Click "Change" to edit.';
    document.getElementById('usernameHint').style.color = '';
  }
}

function addGameRow(data = {}) {
  const container = document.getElementById('gamesContainer');
  const row = document.createElement('div');
  row.className = 'game-row';
  row.innerHTML = `
    <input type="text" class="game-name" placeholder="Game name (e.g. Valorant)" value="${data.name || ''}">
    <input type="url" class="game-icon" placeholder="Icon URL (optional, square image)" value="${data.icon || ''}">
    <button type="button" class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
  `;
  container.appendChild(row);
}

function addTrackRow(data = {}) {
  trackCount++;
  const container = document.getElementById('tracksContainer');
  const row = document.createElement('div');
  row.className = 'track-row';
  // Generate a random gradient cover if none provided
  const defaultCover = data.cover || '';
  row.innerHTML = `
    <input type="text" class="track-title" placeholder="Track title" value="${data.title || ''}">
    <input type="text" class="track-artist" placeholder="Artist" value="${data.artist || ''}">
    <input type="url" class="track-src" placeholder="Audio URL (or upload below)" value="${data.src || ''}">
    <input type="hidden" class="track-cover" value="${defaultCover}">
    <div class="track-upload-row">
      <input type="file" class="track-upload" accept="audio/mpeg,audio/mp3" onchange="uploadTrackAudio(this)">
      <span class="upload-status"></span>
    </div>
    <button type="button" class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
  `;
  container.appendChild(row);
}

async function checkUsername() {
  const input = document.getElementById('usernameInput');
  const hint = document.getElementById('usernameHint');
  const username = input.value.trim().toLowerCase();

  if (!username || !/^[a-z0-9_-]{3,20}$/.test(username)) {
    hint.textContent = 'Invalid format. Use 3-20 lowercase letters, numbers, hyphens, underscores.';
    hint.style.color = '#f23f43';
    return;
  }

  try {
    const doc = await db.collection('usernames').doc(username).get();
    if (doc.exists && doc.data().uid !== currentUser.uid) {
      hint.textContent = 'Username is taken. Try another.';
      hint.style.color = '#f23f43';
    } else {
      hint.textContent = 'Username is available!';
      hint.style.color = '#23a559';
    }
  } catch (err) {
    hint.textContent = 'Error checking username.';
    hint.style.color = '#f23f43';
  }
}

// Template selection
function selectTemplate(name, silent) {
  document.getElementById('selectedTemplate').value = name;
  document.querySelectorAll('.template-option').forEach(el => {
    el.classList.toggle('active', el.dataset.template === name);
  });

  // Auto-set colors based on template (unless silent = loading saved data)
  if (!silent) {
    const palettes = {
      cyberpunk: { primary: '#00f5ff', secondary: '#a855f7', accent: '#f472b6' },
      minimal: { primary: '#ffffff', secondary: '#a0a0a0', accent: '#666666' },
      terminal: { primary: '#22c55e', secondary: '#10b981', accent: '#34d399' },
      glass: { primary: '#60a5fa', secondary: '#a78bfa', accent: '#f0abfc' },
      neon: { primary: '#ff0080', secondary: '#7928ca', accent: '#ff4ecd' },
      split: { primary: '#a855f7', secondary: '#6366f1', accent: '#c084fc' },
      cards3d: { primary: '#60a5fa', secondary: '#3b82f6', accent: '#93c5fd' },
      orbit: { primary: '#f472b6', secondary: '#ec4899', accent: '#f9a8d4' },
    };
    const p = palettes[name];
    if (p) {
      document.getElementById('colorPrimary').value = p.primary;
      document.getElementById('colorSecondary').value = p.secondary;
      document.getElementById('colorAccent').value = p.accent;
    }
  }
}

function unlockUsername() {
  const input = document.getElementById('usernameInput');
  const checkBtn = document.getElementById('checkUsernameBtn');
  const editBtn = document.getElementById('editUsernameBtn');
  const hint = document.getElementById('usernameHint');

  input.readOnly = false;
  input.focus();
  input.select();
  checkBtn.style.display = 'inline-flex';
  editBtn.style.display = 'none';
  hint.textContent = 'Pick a new username. Check availability before saving.';
  hint.style.color = '#f0b232';
}

// Form submit
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('saveStatus');
  status.textContent = 'Saving...';
  status.style.color = 'var(--cyan)';

  try {
    const username = document.getElementById('usernameInput').value.trim().toLowerCase();

    // Validate username
    if (!username || !/^[a-z0-9_-]{3,20}$/.test(username)) {
      throw new Error('Invalid username format.');
    }

    // Check username availability
    const isNewUsername = username !== currentUsername;
    if (isNewUsername) {
      const existing = await db.collection('usernames').doc(username).get();
      if (existing.exists && existing.data().uid !== currentUser.uid) {
        throw new Error('Username is taken.');
      }
    }

    // Collect tracks
    const trackRows = document.querySelectorAll('.track-row');
    const tracks = [];
    for (const row of trackRows) {
      const title = row.querySelector('.track-title').value.trim();
      const artist = row.querySelector('.track-artist').value.trim();
      const cover = row.querySelector('.track-cover').value.trim();
      const src = row.querySelector('.track-src').value.trim();
      if (title && src) {
        tracks.push({ title, artist, cover, src });
      }
    }

    // Collect games
    const gameRows = document.querySelectorAll('.game-row');
    const games = [];
    for (const row of gameRows) {
      const name = row.querySelector('.game-name').value.trim();
      const icon = row.querySelector('.game-icon').value.trim();
      if (name) {
        games.push({ name, icon });
      }
    }

    // Build profile object
    const profile = {
      username,
      email: currentUser.email || '',
      template: document.getElementById('selectedTemplate').value || 'cyberpunk',
      displayName: document.getElementById('displayName').value.trim(),
      tagline: document.getElementById('tagline').value.trim(),
      country: document.getElementById('country').value.trim(),
      countryFlag: document.getElementById('countryFlag').value.trim(),
      contactEmail: document.getElementById('contactEmail').value.trim(),
      discordId: document.getElementById('discordId').value.trim(),
      githubUser: document.getElementById('githubUser').value.trim(),
      socials: {
        discord: document.getElementById('socialDiscord').value.trim(),
        github: document.getElementById('socialGithub').value.trim(),
        youtube: document.getElementById('socialYoutube').value.trim(),
        tiktok: document.getElementById('socialTiktok').value.trim(),
        instagram: document.getElementById('socialInstagram').value.trim(),
        facebook: document.getElementById('socialFacebook').value.trim(),
        spotify: document.getElementById('socialSpotify').value.trim(),
        steam: document.getElementById('socialSteam').value.trim(),
        twitch: document.getElementById('socialTwitch').value.trim(),
        website: document.getElementById('socialWebsite').value.trim(),
      },
      colors: {
        primary: document.getElementById('colorPrimary').value,
        secondary: document.getElementById('colorSecondary').value,
        accent: document.getElementById('colorAccent').value,
      },
      tracks,
      games,
      bgVideo: document.getElementById('bgVideoUrl').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // Save profile
    await db.collection('profiles').doc(currentUser.uid).set(profile, { merge: true });

    // Save username mapping
    if (isNewUsername) {
      // Delete old username mapping if changing
      if (currentUsername) {
        await db.collection('usernames').doc(currentUsername).delete();
        // Move visit counter to new username
        try {
          const oldVisits = await db.collection('visits').doc(currentUsername).get();
          if (oldVisits.exists) {
            await db.collection('visits').doc(username).set(oldVisits.data());
            await db.collection('visits').doc(currentUsername).delete();
          }
        } catch (e) {}
      }
      // Create new username mapping
      await db.collection('usernames').doc(username).set({ uid: currentUser.uid });
      currentUsername = username;
    }

    // Lock username field again
    document.getElementById('usernameInput').readOnly = true;
    document.getElementById('checkUsernameBtn').style.display = 'none';
    document.getElementById('editUsernameBtn').style.display = 'inline-flex';
    document.getElementById('usernameHint').textContent = 'Your current username. Click "Change" to edit.';
    document.getElementById('usernameHint').style.color = '';

    currentProfile = profile;

    // Update URL display
    const url = `${window.location.origin}/u/${username}`;
    document.getElementById('dashUrl').innerHTML = `Your profile: <a href="${url}" target="_blank">${url}</a>`;
    const viewLink = document.getElementById('viewProfileLink');
    viewLink.href = url;
    viewLink.style.display = 'inline';

    status.textContent = 'Profile saved and published!';
    status.style.color = '#23a559';
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.style.color = '#f23f43';
    console.error(err);
  }
});

// Tab switching
function switchDashTab(tab) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dash-tab-content').forEach(t => t.style.display = 'none');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).style.display = 'block';
}

// Load client stats
async function loadClientStats() {
  if (!currentProfile || !currentUsername) return;

  // Views
  try {
    const visitDoc = await db.collection('visits').doc(currentUsername).get();
    const views = visitDoc.exists ? (visitDoc.data().count || 0) : 0;
    document.getElementById('clientViews').textContent = views.toLocaleString();
    document.getElementById('analyticsViews').textContent = views.toLocaleString();
  } catch (e) {
    document.getElementById('clientViews').textContent = '0';
    document.getElementById('analyticsViews').textContent = '0';
  }

  // Social links count
  const socials = currentProfile.socials || {};
  const linkCount = Object.values(socials).filter(v => v && v.trim()).length;
  document.getElementById('clientLinks').textContent = linkCount;

  // Tracks count
  const trackCount2 = (currentProfile.tracks || []).length;
  document.getElementById('clientTracks').textContent = trackCount2;

  // Status
  const hasUsername = !!currentProfile.username;
  const statusEl = document.getElementById('clientStatus');
  if (hasUsername) {
    statusEl.textContent = 'Live';
    statusEl.style.color = '#23a559';
  } else {
    statusEl.textContent = 'Draft';
    statusEl.style.color = '#f0b232';
  }

  // Analytics URL
  if (currentUsername) {
    const url = `${window.location.origin}/u/${currentUsername}`;
    document.getElementById('analyticsUrl').textContent = url;
  }

  // Summary
  document.getElementById('summaryUsername').textContent = currentProfile.username ? `@${currentProfile.username}` : '—';
  document.getElementById('summaryName').textContent = currentProfile.displayName || '—';
  document.getElementById('summaryDiscord').textContent = currentProfile.discordId ? 'Yes' : 'No';
  document.getElementById('summaryGithub').textContent = currentProfile.githubUser ? 'Yes' : 'No';
  document.getElementById('summarySocials').textContent = linkCount;
  document.getElementById('summaryTracks').textContent = trackCount2;
  document.getElementById('summaryVideo').textContent = currentProfile.bgVideo ? 'Yes' : 'No';

  if (currentProfile.updatedAt) {
    const date = new Date(currentProfile.updatedAt.seconds * 1000);
    document.getElementById('summaryUpdated').textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// Copy profile URL
function copyProfileUrl() {
  const url = document.getElementById('analyticsUrl').textContent;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector('.btn-copy');
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.style.color = '#23a559';
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-copy"></i>';
      btn.style.color = '';
    }, 2000);
  }).catch(() => {});
}

// Cloudinary upload config
const CLOUDINARY_CLOUD = 'dlwl430iv';
const CLOUDINARY_PRESET = 'dcpf_uploads';

async function uploadToCloudinary(file, resourceType = 'auto') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('folder', 'dcpf');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.secure_url;
}

// Upload track audio
async function uploadTrackAudio(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    alert('File too large. Max 10MB.');
    input.value = '';
    return;
  }

  const statusEl = input.parentElement.querySelector('.upload-status');
  statusEl.textContent = 'Uploading...';
  statusEl.style.color = 'var(--cyan)';

  try {
    const url = await uploadToCloudinary(file, 'video'); // Cloudinary uses 'video' for audio too
    // Set the URL in the track-src input
    const row = input.closest('.track-row');
    row.querySelector('.track-src').value = url;
    statusEl.textContent = 'Uploaded!';
    statusEl.style.color = '#23a559';
  } catch (err) {
    statusEl.textContent = 'Upload failed.';
    statusEl.style.color = '#f23f43';
    console.error(err);
  }
}

// Upload background video
async function uploadBgVideo(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    alert('File too large. Max 10MB.');
    input.value = '';
    return;
  }

  const statusEl = document.getElementById('bgVideoStatus');
  statusEl.textContent = 'Uploading...';
  statusEl.style.color = 'var(--cyan)';

  try {
    const url = await uploadToCloudinary(file, 'video');
    document.getElementById('bgVideoUrl').value = url;
    statusEl.textContent = 'Uploaded!';
    statusEl.style.color = '#23a559';
  } catch (err) {
    statusEl.textContent = 'Upload failed.';
    statusEl.style.color = '#f23f43';
    console.error(err);
  }
}
