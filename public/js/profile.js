// Profile page - renders a user's profile from Firestore data
const db = firebase.firestore();

const STATUS_COLORS = { online: '#23a559', idle: '#f0b232', dnd: '#f23f43', offline: '#80848e' };

let profileData = null;
let entered = false;
let currentTrack = 0;
let isPlaying = false;
let spotifyTimer = null;
let mx = 0, my = 0, rx = 0, ry = 0;

const dot = document.getElementById('cursorDot');
const ring = document.getElementById('cursorRing');
const overlay = document.getElementById('enterOverlay');
const mainPage = document.getElementById('mainPage');
const audio = document.getElementById('bgAudio');
const bgVideo = document.getElementById('bgVideo');
const playBtn = document.getElementById('playBtn');

// Cursor trail
let lastTrailTime = 0;
const TRAIL_THROTTLE = 50;
const trailPool = [];
const MAX_TRAILS = 12;

function getTrailElement() {
  if (trailPool.length > 0) return trailPool.pop();
  const t = document.createElement('div');
  t.className = 'trail';
  document.body.appendChild(t);
  return t;
}

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  dot.style.left = mx + 'px';
  dot.style.top = my + 'px';

  const now = performance.now();
  if (now - lastTrailTime < TRAIL_THROTTLE) return;
  lastTrailTime = now;

  const t = getTrailElement();
  const sz = Math.random() * 5 + 3;
  const colors = profileData ? [profileData.colors.primary, profileData.colors.secondary, profileData.colors.accent] : ['#00f5ff', '#a855f7', '#f472b6'];
  const c = colors[Math.floor(Math.random() * 3)];
  t.style.cssText = `left:${mx}px;top:${my}px;width:${sz}px;height:${sz}px;background:${c};transform:translate(-50%,-50%);box-shadow:0 0 8px ${c};opacity:0.65;`;
  t.style.animation = 'none';
  t.offsetHeight;
  t.style.animation = 'trailFade 0.6s linear forwards';

  setTimeout(() => {
    t.style.opacity = '0';
    if (trailPool.length < MAX_TRAILS) trailPool.push(t);
    else t.remove();
  }, 600);
}, { passive: true });

(function animRing() {
  rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  requestAnimationFrame(animRing);
})();

// Get username from URL
function getUsernameFromUrl() {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  // URL: /u/username
  if (parts[0] === 'u' && parts[1]) return parts[1].toLowerCase();
  return null;
}

// Load profile from Firestore
async function loadProfile() {
  const username = getUsernameFromUrl();
  if (!username) {
    showError('No profile specified.');
    return;
  }

  try {
    // Look up UID from username
    const usernameDoc = await db.collection('usernames').doc(username).get();
    if (!usernameDoc.exists) {
      showError('Profile not found.');
      return;
    }

    const uid = usernameDoc.data().uid;
    const profileDoc = await db.collection('profiles').doc(uid).get();
    if (!profileDoc.exists) {
      showError('Profile data not found.');
      return;
    }

    profileData = profileDoc.data();
    applyTheme(profileData.colors);
    applyTemplate(profileData.template || 'cyberpunk');
    renderProfile(profileData);
    incrementVisits(username);
  } catch (err) {
    console.error(err);
    showError('Error loading profile.');
  }
}

function showError(msg) {
  document.getElementById('enterName').textContent = msg;
  document.querySelector('.enter-sub').textContent = '';
}

function applyTheme(colors) {
  if (!colors) return;
  document.documentElement.style.setProperty('--cyan', colors.primary || '#00f5ff');
  document.documentElement.style.setProperty('--purple', colors.secondary || '#a855f7');
  document.documentElement.style.setProperty('--pink', colors.accent || '#f472b6');
}

function applyTemplate(template) {
  const body = document.body;
  const fallback = document.getElementById('bgFallback');
  const container = document.querySelector('.bento-container');

  // Remove any previous template class
  body.className = body.className.replace(/template-\w+/g, '').trim();
  body.classList.add(`template-${template}`);

  // Template-specific backgrounds
  const bgs = {
    cyberpunk: { bg: '#020208', fb: 'radial-gradient(ellipse 70% 50% at 20% 30%, rgba(0,245,255,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 70% at 80% 70%, rgba(168,85,247,0.1) 0%, transparent 60%), #020208' },
    minimal: { bg: '#0a0a0a', fb: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(255,255,255,0.02) 0%, transparent 70%), #0a0a0a' },
    terminal: { bg: '#000a00', fb: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(34,197,94,0.04) 0%, transparent 60%), #000a00' },
    glass: { bg: '#0f0f1a', fb: 'radial-gradient(ellipse 60% 50% at 30% 30%, rgba(96,165,250,0.08) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 70% 70%, rgba(167,139,250,0.06) 0%, transparent 60%), #0f0f1a' },
    neon: { bg: '#050505', fb: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,0,128,0.06) 0%, transparent 60%), #050505' },
    split: { bg: '#0a0514', fb: 'radial-gradient(ellipse 50% 80% at 20% 50%, rgba(168,85,247,0.08) 0%, transparent 60%), #0a0514' },
    cards3d: { bg: '#08080f', fb: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(96,165,250,0.06) 0%, transparent 60%), #08080f' },
    orbit: { bg: '#050510', fb: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(244,114,182,0.08) 0%, transparent 50%), #050510' },
  };

  const t = bgs[template] || bgs.cyberpunk;
  body.style.background = t.bg;
  if (fallback) fallback.style.background = t.fb;
}

function renderProfile(p) {
  // Enter overlay
  document.getElementById('enterName').textContent = p.displayName;
  document.getElementById('enterHint').textContent = p.username ? `@${p.username}` : '';

  // Page title
  document.getElementById('pageTitle').textContent = `${p.displayName} • DCPF`;

  // Profile card
  const nameEl = document.getElementById('profileName');
  nameEl.textContent = p.displayName;
  nameEl.setAttribute('data-text', p.displayName);
  document.getElementById('profileTagline').textContent = p.tagline || '';

  // Location
  if (p.country) {
    const badge = document.getElementById('locationBadge');
    badge.style.display = 'inline-flex';
    document.getElementById('locationText').textContent = p.country;
    if (p.countryFlag) {
      document.getElementById('flagImg').src = p.countryFlag;
    } else {
      document.getElementById('flagImg').style.display = 'none';
    }
  }

  // About Me - removed

  // Discord card
  if (p.discordId) {
    document.getElementById('discordCard').style.display = 'flex';
    if (p.socials?.discord) {
      document.getElementById('discordCard').onclick = () => window.open(p.socials.discord, '_blank');
    }
    fetchDiscord(p.discordId);
    setInterval(() => fetchDiscord(p.discordId), 30000);
  }

  // GitHub card
  if (p.githubUser) {
    document.getElementById('githubCard').style.display = 'flex';
    if (p.socials?.github) {
      document.getElementById('githubCard').onclick = () => window.open(p.socials.github, '_blank');
    }
    fetchGitHub(p.githubUser);
  }

  // Audio card
  if (p.tracks && p.tracks.length > 0) {
    document.getElementById('audioCard').style.display = 'flex';
    buildDots(p.tracks);
    loadTrackUI(0, p.tracks);
  }

  // Background video
  if (p.bgVideo) {
    bgVideo.src = p.bgVideo;
  }

  // Socials card
  renderSocials(p);

  // Games card
  if (p.games && p.games.length > 0) {
    document.getElementById('gamesCard').style.display = 'flex';
    renderGames(p.games);
  }
}

// Socials rendering
function renderSocials(p) {
  const grid = document.getElementById('socialsGrid');
  const socials = p.socials || {};
  const items = [];

  const map = [
    { key: 'discord', icon: 'fa-brands fa-discord', label: 'Discord', cls: 'soc-discord' },
    { key: 'github', icon: 'fa-brands fa-github', label: 'GitHub', cls: 'soc-github' },
    { key: 'youtube', icon: 'fa-brands fa-youtube', label: 'YouTube', cls: 'soc-youtube' },
    { key: 'tiktok', icon: 'fa-brands fa-tiktok', label: 'TikTok', cls: 'soc-tiktok' },
    { key: 'instagram', icon: 'fa-brands fa-instagram', label: 'Instagram', cls: 'soc-instagram' },
    { key: 'facebook', icon: 'fa-brands fa-facebook', label: 'Facebook', cls: 'soc-facebook' },
    { key: 'spotify', icon: 'fa-brands fa-spotify', label: 'Spotify', cls: 'soc-spotify' },
    { key: 'steam', icon: 'fa-brands fa-steam', label: 'Steam', cls: 'soc-steam' },
    { key: 'twitch', icon: 'fa-brands fa-twitch', label: 'Twitch', cls: 'soc-twitch' },
    { key: 'website', icon: 'fa-solid fa-globe', label: 'Website', cls: 'soc-website' },
  ];

  map.forEach(s => {
    if (socials[s.key]) {
      items.push(`<a href="${socials[s.key]}" class="soc-item ${s.cls}" title="${s.label}" target="_blank" rel="noopener">
        <i class="${s.icon}"></i>
        <span class="soc-label">${s.label}</span>
      </a>`);
    }
  });

  // Email link
  if (p.contactEmail) {
    items.push(`<a href="#" class="soc-item soc-email" title="Email" onclick="openEmailModal(event)">
      <i class="fa-regular fa-envelope"></i>
      <span class="soc-label">Email</span>
    </a>`);
  }

  if (items.length > 0) {
    document.getElementById('socialsCard').style.display = 'flex';
    grid.innerHTML = items.join('');
  }
}

// Enter overlay click
overlay.addEventListener('click', () => {
  if (!profileData) return;
  overlay.style.opacity = '0';
  setTimeout(() => overlay.style.display = 'none', 1000);
  mainPage.classList.add('visible');

  // Start audio
  if (profileData.tracks && profileData.tracks.length > 0) {
    audio.volume = 0.5;
    loadTrack(0, true);
  }

  // Play video
  if (profileData.bgVideo) {
    bgVideo.preload = 'auto';
    bgVideo.load();
    bgVideo.play().catch(() => {});
  }
  entered = true;
});

// Discord fetch
async function fetchDiscord(discordId) {
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`);
    if (!res.ok) throw new Error('Not found');
    const { data, success } = await res.json();
    if (!success || !data) throw new Error('Failed');

    const u = data.discord_user;
    const av = u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
      : 'https://cdn.discordapp.com/embed/avatars/0.png';

    document.getElementById('dcAvatar').src = av;
    document.getElementById('dcName').textContent = u.global_name || u.username;
    document.getElementById('topAvatar').src = av;

    // Decoration
    const topDecoEl = document.getElementById('topDeco');
    const deco = u.avatar_decoration_data?.asset;
    if (deco) {
      topDecoEl.src = `https://cdn.discordapp.com/avatar-decoration-presets/${deco}.png?size=160&passthrough=true`;
      topDecoEl.style.display = 'block';
    }

    // Clan tag
    const tag = u.primary_guild?.tag;
    const tagEl = document.getElementById('dcTag');
    if (tag) {
      document.getElementById('dcTagText').textContent = tag;
      tagEl.style.display = 'flex';
    }

    // Status
    const st = data.discord_status || 'offline';
    const dotEl = document.getElementById('dcStatusDot');
    dotEl.style.background = STATUS_COLORS[st];
    dotEl.style.boxShadow = `0 0 10px ${STATUS_COLORS[st]}`;

    const lbl = document.getElementById('dcStatusLabel');
    lbl.textContent = st;
    lbl.style.borderColor = STATUS_COLORS[st] + '60';
    lbl.style.color = STATUS_COLORS[st];

    // Activity
    let txt = 'No status set';
    const acts = data.activities || [];
    if (acts.length) {
      const a = acts[0];
      if (a.type === 4) txt = a.state || txt;
      else if (a.type === 0) txt = '\uD83C\uDFAE Playing ' + a.name;
      else if (a.type === 2) txt = '\uD83C\uDFB5 Listening to ' + a.name;
      else txt = a.name;
    }
    document.getElementById('dcActivity').textContent = txt;

    // Rich presence
    if (spotifyTimer) { clearInterval(spotifyTimer); spotifyTimer = null; }
    const rpEl = document.getElementById('dcRichPresence');

    if (data.listening_to_spotify && data.spotify) {
      const sp = data.spotify;
      rpEl.style.display = 'flex';
      document.getElementById('dcRpHeader').textContent = 'Listening to Spotify';
      document.getElementById('dcRpImage').src = sp.album_art_url || '';
      document.getElementById('dcRpSmallImage').style.display = 'none';
      document.getElementById('dcRpName').textContent = sp.song;
      document.getElementById('dcRpDetails').textContent = `by ${sp.artist}`;
      document.getElementById('dcRpState').textContent = `on ${sp.album}`;
      document.getElementById('dcRpProgress').style.display = 'flex';

      const start = sp.timestamps.start;
      const end = sp.timestamps.end;
      const total = end - start;
      const update = () => {
        const elapsed = Date.now() - start;
        const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
        document.getElementById('dcRpFill').style.width = pct + '%';
        document.getElementById('dcRpTimeCur').textContent = formatMs(elapsed);
        document.getElementById('dcRpTimeTot').textContent = formatMs(total);
      };
      update();
      spotifyTimer = setInterval(update, 1000);
    } else {
      const activeAct = acts.find(a => a.id !== 'custom' && a.type !== 4 && a.name !== 'Spotify');
      if (activeAct) {
        rpEl.style.display = 'flex';
        const types = { 0: 'Playing', 1: 'Streaming', 2: 'Listening to', 3: 'Watching', 5: 'Competing in' };
        document.getElementById('dcRpHeader').textContent = types[activeAct.type] || 'Playing';
        document.getElementById('dcRpName').textContent = activeAct.name;
        document.getElementById('dcRpDetails').textContent = activeAct.details || '';
        document.getElementById('dcRpState').textContent = activeAct.state || '';
        document.getElementById('dcRpProgress').style.display = 'none';

        // Resolve activity image
        const rpImgEl = document.getElementById('dcRpImage');
        const rpSmallEl = document.getElementById('dcRpSmallImage');
        let actImgUrl = '';

        if (activeAct.assets?.large_image) {
          const li = activeAct.assets.large_image;
          if (li.startsWith('mp:external/')) {
            actImgUrl = `https://media.discordapp.net/external/${li.replace('mp:external/', '')}`;
          } else if (li.startsWith('mp:attachments/')) {
            actImgUrl = `https://media.discordapp.net/attachments/${li.replace('mp:attachments/', '')}`;
          } else if (li.startsWith('mp:')) {
            actImgUrl = `https://media.discordapp.net/${li.replace('mp:', '')}`;
          } else if (li.startsWith('https://') || li.startsWith('http://')) {
            actImgUrl = li;
          } else if (activeAct.application_id) {
            actImgUrl = `https://cdn.discordapp.com/app-assets/${activeAct.application_id}/${li}.png`;
          }
        } else if (activeAct.application_id) {
          // No large_image asset — use the app icon instead
          actImgUrl = `https://cdn.discordapp.com/app-icons/${activeAct.application_id}/icon.png?size=128`;
        }

        if (actImgUrl) {
          rpImgEl.src = actImgUrl;
          rpImgEl.onerror = function() { this.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; };
          rpImgEl.style.display = 'block';
        } else {
          rpImgEl.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
          rpImgEl.style.display = 'block';
        }

        // Small image
        if (activeAct.assets?.small_image) {
          const si = activeAct.assets.small_image;
          let smallImgUrl = '';
          if (si.startsWith('mp:external/')) {
            smallImgUrl = `https://media.discordapp.net/external/${si.replace('mp:external/', '')}`;
          } else if (si.startsWith('mp:attachments/')) {
            smallImgUrl = `https://media.discordapp.net/attachments/${si.replace('mp:attachments/', '')}`;
          } else if (si.startsWith('mp:')) {
            smallImgUrl = `https://media.discordapp.net/${si.replace('mp:', '')}`;
          } else if (si.startsWith('https://') || si.startsWith('http://')) {
            smallImgUrl = si;
          } else if (activeAct.application_id) {
            smallImgUrl = `https://cdn.discordapp.com/app-assets/${activeAct.application_id}/${si}.png`;
          }
          if (smallImgUrl) {
            rpSmallEl.src = smallImgUrl;
            rpSmallEl.onerror = function() { this.style.display = 'none'; };
            rpSmallEl.style.display = 'block';
          } else {
            rpSmallEl.style.display = 'none';
          }
        } else {
          rpSmallEl.style.display = 'none';
        }
      } else {
        rpEl.style.display = 'none';
      }
    }
  } catch (e) {
    document.getElementById('dcName').textContent = profileData.displayName;
    document.getElementById('dcActivity').textContent = 'Presence offline';
    document.getElementById('dcRichPresence').style.display = 'none';
  }
}

// GitHub fetch
async function fetchGitHub(username) {
  try {
    const r = await fetch(`https://api.github.com/users/${username}`);
    const d = await r.json();

    document.getElementById('ghAvatar').src = d.avatar_url || '';
    document.getElementById('ghName').textContent = d.name || d.login;
    document.getElementById('ghLogin').textContent = `@${d.login}`;
    if (d.bio) document.getElementById('ghBio').textContent = d.bio;

    document.getElementById('ghRepos').textContent = d.public_repos ?? '\u2014';
    document.getElementById('ghFollowers').textContent = d.followers ?? '\u2014';
    document.getElementById('ghFollowing').textContent = d.following ?? '\u2014';

    const rr = await fetch(`https://api.github.com/users/${username}/repos?per_page=20&sort=pushed`);
    const repos = await rr.json();
    if (Array.isArray(repos)) {
      const langs = {};
      repos.forEach(repo => { if (repo.language) langs[repo.language] = (langs[repo.language] || 0) + 1; });
      const top = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
      document.getElementById('ghLangs').innerHTML = top.map(l => `<span class="gh-lang">${l}</span>`).join('');
    }
  } catch (e) {}
}

// Music player
function buildDots(tracks) {
  const c = document.getElementById('trackDots');
  c.innerHTML = '';
  tracks.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'tdot' + (i === currentTrack ? ' active' : '');
    d.onclick = (e) => { e.stopPropagation(); loadTrack(i, true); };
    c.appendChild(d);
  });
}

function loadTrackUI(idx, tracks) {
  const t = tracks[idx];
  document.getElementById('musicTitle').textContent = t.title || '\u2014';
  document.getElementById('musicArtist').textContent = t.artist || '\u2014';
  const coverEl = document.getElementById('musicCover');
  if (t.cover) {
    coverEl.src = t.cover;
  } else {
    coverEl.src = generateCoverUrl(t.title || 'track');
  }
}

function loadTrack(idx, autoplay = false) {
  if (!profileData?.tracks?.length) return;
  currentTrack = idx;
  const t = profileData.tracks[idx];

  document.getElementById('musicTitle').textContent = t.title;
  document.getElementById('musicArtist').textContent = t.artist;
  const coverEl = document.getElementById('musicCover');
  if (t.cover) {
    coverEl.src = t.cover;
  } else {
    coverEl.src = generateCoverUrl(t.title || 'track');
  }

  audio.src = t.src;
  if (autoplay) {
    audio.play().then(() => {
      isPlaying = true;
      playBtn.innerHTML = '<i class="fas fa-pause"></i>';
      document.querySelector('.bento-audio').classList.add('playing');
    }).catch(() => {
      isPlaying = false;
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
      document.querySelector('.bento-audio').classList.remove('playing');
    });
  }
  updateDots();
  document.getElementById('progFill').style.width = '0%';
  document.getElementById('curTime').textContent = '0:00';
  document.getElementById('totTime').textContent = '0:00';
}

function updateDots() {
  document.querySelectorAll('.tdot').forEach((d, i) => d.classList.toggle('active', i === currentTrack));
}

function togglePlay() {
  if (!entered) return;
  const card = document.querySelector('.bento-audio');
  if (audio.paused) {
    audio.play().then(() => { isPlaying = true; playBtn.innerHTML = '<i class="fas fa-pause"></i>'; card.classList.add('playing'); }).catch(() => {});
  } else {
    audio.pause(); isPlaying = false; playBtn.innerHTML = '<i class="fas fa-play"></i>'; card.classList.remove('playing');
  }
}

function prevTrack() {
  if (!profileData?.tracks?.length) return;
  loadTrack((currentTrack - 1 + profileData.tracks.length) % profileData.tracks.length, isPlaying);
}

function nextTrack() {
  if (!profileData?.tracks?.length) return;
  loadTrack((currentTrack + 1) % profileData.tracks.length, true);
}

audio.addEventListener('ended', nextTrack);
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  document.getElementById('progFill').style.width = ((audio.currentTime / audio.duration) * 100) + '%';
  document.getElementById('curTime').textContent = formatTime(audio.currentTime);
  document.getElementById('totTime').textContent = formatTime(audio.duration);
});

document.getElementById('progBar').addEventListener('click', e => {
  e.stopPropagation();
  if (!audio.duration) return;
  const r = e.currentTarget.getBoundingClientRect();
  audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
});

document.getElementById('volSlider').addEventListener('input', e => { audio.volume = e.target.value; });

function formatTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// Generate a random cover image based on track name
function generateCoverUrl(seed) {
  // Use DiceBear API to generate a unique abstract art based on the track name
  const encoded = encodeURIComponent(seed);
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encoded}&backgroundColor=0f0f23,1a0533,0a1628&shape1Color=00f5ff,a855f7,f472b6&shape2Color=a855f7,f472b6,00f5ff&shape3Color=f472b6,00f5ff,a855f7`;
}

function formatMs(ms) {
  if (isNaN(ms) || ms < 0) return '0:00';
  return formatTime(ms / 1000);
}

// Games rendering
function renderGames(games) {
  const grid = document.getElementById('gamesGrid');
  grid.innerHTML = games.map(g => {
    const iconHtml = g.icon
      ? `<img src="${g.icon}" alt="${g.name}" class="game-icon-img" width="40" height="40" loading="lazy">`
      : `<div class="game-icon-placeholder"><i class="fas fa-gamepad"></i></div>`;
    return `<div class="game-item">
      ${iconHtml}
      <span class="game-name-label">${g.name}</span>
    </div>`;
  }).join('');
}

// Email modal
function openEmailModal(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  document.getElementById('modalEmailText').textContent = profileData.contactEmail || '';
  document.getElementById('emailModal').classList.add('active');
}

function closeEmailModal(e) {
  if (e) e.stopPropagation();
  document.getElementById('emailModal').classList.remove('active');
}

function copyEmailFromModal() {
  navigator.clipboard.writeText(profileData.contactEmail).then(() => {
    const btn = document.getElementById('modalCopyBtn');
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i>'; btn.classList.remove('copied'); }, 2000);
  }).catch(() => {});
}

// Visit counter
async function incrementVisits(username) {
  try {
    const ref = db.collection('visits').doc(username);
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const count = (doc.exists ? doc.data().count : 0) + 1;
      tx.set(ref, { count });
      document.getElementById('visitCount').textContent = count.toLocaleString();
    });
  } catch (e) {
    document.getElementById('visitCount').textContent = '\u2014';
  }
}

// Init
loadProfile();
