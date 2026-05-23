const db = firebase.firestore();
let currentUser = null;
let allProfiles = [];
let deleteTarget = null;

// Your UID - replace with your actual Firebase Auth UID after first login
// You can find it in Firebase Console > Authentication > Users
const ADMIN_UIDS = [];

// Auth guard + admin check
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  currentUser = user;

  // Check admin access from Firestore settings or hardcoded list
  const isAdmin = await checkAdminAccess(user.uid);
  document.getElementById('loadingState').style.display = 'none';

  if (!isAdmin) {
    document.getElementById('accessDenied').style.display = 'flex';
    return;
  }

  document.getElementById('adminContainer').style.display = 'block';
  await loadAllData();
});

async function checkAdminAccess(uid) {
  // Check hardcoded list first
  if (ADMIN_UIDS.includes(uid)) return true;

  // Check Firestore settings
  try {
    const doc = await db.collection('settings').doc('admin').get();
    if (doc.exists) {
      const admins = doc.data().adminUids || [];
      return admins.includes(uid);
    }
  } catch (e) {}

  // If no admin settings exist yet, first user to access becomes admin
  // (only works once - when settings doc doesn't exist)
  try {
    const settingsDoc = await db.collection('settings').doc('admin').get();
    if (!settingsDoc.exists) {
      await db.collection('settings').doc('admin').set({
        adminUids: [uid],
        bannedUsernames: ['admin', 'root', 'system', 'mod', 'moderator'],
        announcement: ''
      });
      return true;
    }
  } catch (e) {}

  return false;
}

function signOut() {
  firebase.auth().signOut().then(() => window.location.href = '/');
}

async function loadAllData() {
  await Promise.all([loadProfiles(), loadUsers(), loadStats(), loadSettings()]);
}

async function loadProfiles() {
  try {
    const snap = await db.collection('profiles').orderBy('updatedAt', 'desc').get();
    allProfiles = [];
    snap.forEach(doc => {
      allProfiles.push({ uid: doc.id, ...doc.data() });
    });
    renderProfiles(allProfiles);
    document.getElementById('statProfiles').textContent = allProfiles.length;
  } catch (err) {
    console.error('Error loading profiles:', err);
  }
}

async function loadStats() {
  try {
    // Count usernames (= registered users with profiles)
    const usernamesSnap = await db.collection('usernames').get();
    document.getElementById('statUsers').textContent = allUsers.length || usernamesSnap.size;

    // Sum all visits
    const visitsSnap = await db.collection('visits').get();
    let totalVisits = 0;
    visitsSnap.forEach(doc => {
      totalVisits += doc.data().count || 0;
    });
    document.getElementById('statVisits').textContent = totalVisits.toLocaleString();
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

async function loadSettings() {
  try {
    const doc = await db.collection('settings').doc('admin').get();
    if (doc.exists) {
      const data = doc.data();
      document.getElementById('adminUids').value = (data.adminUids || []).join('\n');
      document.getElementById('bannedUsernames').value = (data.bannedUsernames || []).join('\n');
      document.getElementById('announcement').value = data.announcement || '';
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings() {
  try {
    const adminUids = document.getElementById('adminUids').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    const bannedUsernames = document.getElementById('bannedUsernames').value
      .split('\n').map(s => s.trim().toLowerCase()).filter(Boolean);
    const announcement = document.getElementById('announcement').value.trim();

    // Make sure current user stays admin
    if (!adminUids.includes(currentUser.uid)) {
      adminUids.unshift(currentUser.uid);
    }

    await db.collection('settings').doc('admin').set({
      adminUids,
      bannedUsernames,
      announcement
    });

    alert('Settings saved!');
  } catch (err) {
    alert('Error saving: ' + err.message);
  }
}

// Users
let allUsers = [];
let adminUidsList = [];

async function loadUsers() {
  try {
    const snap = await db.collection('users').orderBy('lastLogin', 'desc').get();
    allUsers = [];
    snap.forEach(doc => {
      allUsers.push({ uid: doc.id, ...doc.data() });
    });

    // Load admin UIDs
    try {
      const settingsDoc = await db.collection('settings').doc('admin').get();
      if (settingsDoc.exists) {
        adminUidsList = settingsDoc.data().adminUids || [];
      }
    } catch (e) {}

    renderUsers(allUsers);
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersBody');
  const empty = document.getElementById('usersEmpty');

  if (users.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  const profileUids = allProfiles.map(p => p.uid);

  tbody.innerHTML = users.map(u => {
    const lastLogin = u.lastLogin ? new Date(u.lastLogin.seconds * 1000).toLocaleDateString() : '—';
    const hasProfile = profileUids.includes(u.uid);
    const profileBadge = hasProfile
      ? '<span style="color:#23a559;font-weight:600;">Yes</span>'
      : '<span style="color:rgba(255,255,255,0.3);">No</span>';
    const isAdmin = adminUidsList.includes(u.uid);
    const roleBadge = isAdmin
      ? '<span class="role-badge role-admin">Admin</span>'
      : '<span class="role-badge role-user">User</span>';
    const isSelf = u.uid === currentUser.uid;
    const actionBtn = isSelf
      ? '<span style="color:rgba(255,255,255,0.2);font-size:10px;">You</span>'
      : isAdmin
        ? `<button class="action-btn demote" title="Demote to User" onclick="demoteUser('${u.uid}')"><i class="fas fa-arrow-down"></i></button>`
        : `<button class="action-btn promote" title="Promote to Admin" onclick="promoteUser('${u.uid}')"><i class="fas fa-arrow-up"></i></button>`;

    return `<tr>
      <td class="mono" style="font-size:10px;max-width:100px;overflow:hidden;text-overflow:ellipsis;" title="${u.uid}">${u.uid.slice(0, 8)}...</td>
      <td class="mono">${u.email || '—'}</td>
      <td>${u.displayName || '—'}</td>
      <td class="mono">${u.createdAt || '—'}</td>
      <td class="mono">${lastLogin}</td>
      <td>${profileBadge}</td>
      <td>${roleBadge}</td>
      <td class="actions-cell">${actionBtn}</td>
    </tr>`;
  }).join('');
}

function filterUsers() {
  const q = document.getElementById('userSearchInput').value.toLowerCase().trim();
  if (!q) {
    renderUsers(allUsers);
    return;
  }
  const filtered = allUsers.filter(u =>
    (u.email || '').toLowerCase().includes(q) ||
    (u.displayName || '').toLowerCase().includes(q) ||
    (u.uid || '').toLowerCase().includes(q)
  );
  renderUsers(filtered);
}

async function promoteUser(uid) {
  if (!confirm('Promote this user to Admin? They will have full access to this panel.')) return;
  try {
    const doc = await db.collection('settings').doc('admin').get();
    const data = doc.exists ? doc.data() : { adminUids: [], bannedUsernames: [], announcement: '' };
    if (!data.adminUids.includes(uid)) {
      data.adminUids.push(uid);
    }
    await db.collection('settings').doc('admin').set(data);
    adminUidsList = data.adminUids;
    document.getElementById('adminUids').value = data.adminUids.join('\n');
    renderUsers(allUsers);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function demoteUser(uid) {
  if (!confirm('Remove admin access from this user?')) return;
  try {
    const doc = await db.collection('settings').doc('admin').get();
    const data = doc.exists ? doc.data() : { adminUids: [], bannedUsernames: [], announcement: '' };
    data.adminUids = data.adminUids.filter(id => id !== uid);
    if (!data.adminUids.includes(currentUser.uid)) {
      data.adminUids.unshift(currentUser.uid);
    }
    await db.collection('settings').doc('admin').set(data);
    adminUidsList = data.adminUids;
    document.getElementById('adminUids').value = data.adminUids.join('\n');
    renderUsers(allUsers);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function renderProfiles(profiles) {
  const tbody = document.getElementById('profilesBody');
  const empty = document.getElementById('emptyState');

  if (profiles.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  tbody.innerHTML = profiles.map(p => {
    const updated = p.updatedAt ? new Date(p.updatedAt.seconds * 1000).toLocaleDateString() : '—';
    return `<tr>
      <td><a href="/u/${p.username}" target="_blank" class="profile-link">@${p.username || '—'}</a></td>
      <td>${p.displayName || '—'}</td>
      <td class="mono">${p.email || '—'}</td>
      <td class="mono">${p.discordId || '—'}</td>
      <td class="mono">${updated}</td>
      <td class="actions-cell">
        <a href="/u/${p.username}" target="_blank" class="action-btn view" title="View"><i class="fas fa-eye"></i></a>
        <button class="action-btn delete" title="Delete" onclick="openDeleteModal('${p.uid}', '${p.username}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  // Icons render via CSS, no re-scan needed
}

function filterProfiles() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  if (!q) {
    renderProfiles(allProfiles);
    return;
  }
  const filtered = allProfiles.filter(p =>
    (p.username || '').includes(q) ||
    (p.displayName || '').toLowerCase().includes(q) ||
    (p.email || '').toLowerCase().includes(q) ||
    (p.discordId || '').includes(q) ||
    (p.githubUser || '').toLowerCase().includes(q)
  );
  renderProfiles(filtered);
}

// Tabs
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
}

// Delete modal
function openDeleteModal(uid, username) {
  deleteTarget = { uid, username };
  document.getElementById('deleteUsername').textContent = `@${username}`;
  document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('active');
  deleteTarget = null;
}

async function confirmDelete() {
  if (!deleteTarget) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.textContent = 'Deleting...';
  btn.disabled = true;

  try {
    // Delete profile doc
    await db.collection('profiles').doc(deleteTarget.uid).delete();
    // Delete username mapping
    if (deleteTarget.username) {
      await db.collection('usernames').doc(deleteTarget.username).delete();
    }
    // Delete visit counter
    if (deleteTarget.username) {
      await db.collection('visits').doc(deleteTarget.username).delete();
    }

    // Remove from local array and re-render
    allProfiles = allProfiles.filter(p => p.uid !== deleteTarget.uid);
    renderProfiles(allProfiles);
    document.getElementById('statProfiles').textContent = allProfiles.length;

    closeDeleteModal();
  } catch (err) {
    alert('Error deleting: ' + err.message);
  }

  btn.textContent = 'Delete';
  btn.disabled = false;
}
