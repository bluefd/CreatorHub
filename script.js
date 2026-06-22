// ── Storage Keys ──
const KEYS = { ideas: 'ch_ideas', schedule: 'ch_schedule', theme: 'ch_theme' };

// ── Helpers ──
const $ = id => document.getElementById(id);
const load = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));
const uid  = () => Math.random().toString(36).slice(2, 10);
const fmt  = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ── State ──
let ideas    = load(KEYS.ideas);
let schedule = load(KEYS.schedule);
let ideaFilter = 'All';

// ── Theme ──
const savedTheme = localStorage.getItem(KEYS.theme) || 'light';
if (savedTheme === 'dark') document.documentElement.classList.add('dark');
updateThemeIcon();

$('themeToggle').addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(KEYS.theme, isDark ? 'dark' : 'light');
  updateThemeIcon();
});

function updateThemeIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  $('themeIcon').textContent = isDark ? '🌙' : '☀️';
}

// ── Greeting ──
function setGreeting() {
  const h = new Date().getHours();
  const t = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  $('timeOfDay').textContent = t;
}
setGreeting();

// ── Page Navigation ──
function switchPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  $('page-' + name).classList.add('active');
  document.querySelector(`.tab-btn[data-page="${name}"]`).classList.add('active');
  if (name === 'dashboard')  renderDashboard();
  if (name === 'ideas')      renderIdeas();
  if (name === 'scheduler')  renderSchedule();
  if (name === 'analytics')  animateAnalytics();
}

// ── Dashboard ──
function renderDashboard() {
  $('stat-ideas').textContent     = ideas.length;
  $('stat-scheduled').textContent = schedule.filter(s => s.status !== 'Posted').length;
  $('stat-completed').textContent = schedule.filter(s => s.status === 'Posted').length;

  const ready = ideas.filter(i => i.status === 'ready');
  const container = $('readyList');
  if (ready.length === 0) {
    container.innerHTML = '<div class="empty-state">No ideas ready to post yet.</div>';
    return;
  }
  container.innerHTML = '';
  ready.forEach(idea => {
    const el = document.createElement('div');
    el.className = 'item-card';
    el.style.padding = '10px 14px';
    el.innerHTML = `
      <div class="item-body">
        <div class="item-title">${escHtml(idea.title)}</div>
        <div class="item-meta"><span class="tag-pill">${escHtml(idea.category)}</span></div>
      </div>`;
    container.appendChild(el);
  });
}

// Quick Capture
$('quickAddBtn').addEventListener('click', quickAdd);
$('quickInput').addEventListener('keydown', e => { if (e.key === 'Enter') quickAdd(); });
function quickAdd() {
  const val = $('quickInput').value.trim();
  if (!val) return;
  ideas.unshift({ id: uid(), title: val, category: 'Other', status: 'draft', createdAt: new Date().toISOString() });
  save(KEYS.ideas, ideas);
  $('quickInput').value = '';
  renderDashboard();
}

// ── Ideas ──
document.querySelectorAll('#ideaFilters .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#ideaFilters .pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ideaFilter = btn.dataset.filter;
    renderIdeas();
  });
});

$('addIdeaBtn').addEventListener('click', addIdea);
$('ideaInput').addEventListener('keydown', e => { if (e.key === 'Enter') addIdea(); });

function addIdea() {
  const title    = $('ideaInput').value.trim();
  const category = $('ideaCategory').value;
  if (!title) return;
  ideas.unshift({ id: uid(), title, category, status: 'draft', createdAt: new Date().toISOString() });
  save(KEYS.ideas, ideas);
  $('ideaInput').value = '';
  renderIdeas();
  renderDashboard();
}

function toggleReady(id) {
  const idea = ideas.find(i => i.id === id);
  if (!idea) return;
  idea.status = idea.status === 'ready' ? 'draft' : 'ready';
  save(KEYS.ideas, ideas);
  renderIdeas();
  renderDashboard();
}

function deleteIdea(id) {
  const card = document.querySelector(`[data-idea-id="${id}"]`);
  if (card) {
    card.classList.add('removing');
    card.addEventListener('animationend', () => {
      ideas = ideas.filter(i => i.id !== id);
      save(KEYS.ideas, ideas);
      renderIdeas();
      renderDashboard();
    }, { once: true });
  }
}

function renderIdeas() {
  const list = $('ideaList');
  const filtered = ideaFilter === 'All' ? ideas : ideas.filter(i => i.category === ideaFilter);
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No ideas yet. Add your first one above!</div>';
    return;
  }
  list.innerHTML = '';
  filtered.forEach(idea => {
    const card = document.createElement('div');
    card.className = 'item-card glass';
    card.dataset.ideaId = idea.id;
    const isReady = idea.status === 'ready';
    card.innerHTML = `
      <div class="item-body">
        <div class="item-title">${escHtml(idea.title)}</div>
        <div class="item-meta">
          <span class="tag-pill">${escHtml(idea.category)}</span>
          <span class="status-badge status-${idea.status}">${isReady ? 'Ready' : 'Draft'}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="action-btn ready-btn ${isReady ? 'is-ready' : ''}" title="${isReady ? 'Mark Draft' : 'Mark Ready'}" onclick="toggleReady('${idea.id}')">
          ${isReady ? '★' : '☆'}
        </button>
        <button class="action-btn del-btn" title="Delete" onclick="deleteIdea('${idea.id}')">✕</button>
      </div>`;
    list.appendChild(card);
  });
}

// ── Scheduler ──
$('addSchedBtn').addEventListener('click', addSchedule);
$('schedTitle').addEventListener('keydown', e => { if (e.key === 'Enter') addSchedule(); });

function addSchedule() {
  const title  = $('schedTitle').value.trim();
  const date   = $('schedDate').value;
  const status = $('schedStatus').value;
  if (!title || !date) return;
  schedule.unshift({ id: uid(), title, date, status, createdAt: new Date().toISOString() });
  schedule.sort((a, b) => a.date.localeCompare(b.date));
  save(KEYS.schedule, schedule);
  $('schedTitle').value = '';
  $('schedDate').value  = '';
  renderSchedule();
  renderDashboard();
}

function deleteSchedule(id) {
  const card = document.querySelector(`[data-sched-id="${id}"]`);
  if (card) {
    card.classList.add('removing');
    card.addEventListener('animationend', () => {
      schedule = schedule.filter(s => s.id !== id);
      save(KEYS.schedule, schedule);
      renderSchedule();
      renderDashboard();
    }, { once: true });
  }
}

function renderSchedule() {
  const list = $('schedList');
  if (schedule.length === 0) {
    list.innerHTML = '<div class="empty-state">Nothing scheduled yet. Plan your first post!</div>';
    return;
  }
  list.innerHTML = '';
  schedule.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card glass';
    card.dataset.schedId = item.id;
    const badgeClass = 'status-' + item.status.toLowerCase();
    card.innerHTML = `
      <div class="item-body">
        <div class="item-title">${escHtml(item.title)}</div>
        <div class="item-meta">
          <span>${fmt(item.date)}</span>
          <span class="status-badge ${badgeClass}">${escHtml(item.status)}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="action-btn del-btn" title="Delete" onclick="deleteSchedule('${item.id}')">✕</button>
      </div>`;
    list.appendChild(card);
  });
}

// ── Analytics ──
let analyticsAnimated = false;
function animateAnalytics() {
  if (analyticsAnimated) return;
  analyticsAnimated = true;

  // Progress bars
  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  }, 80);

  // Weekly trend bars
  const maxBarH = 72; // px (container is 90px with label)
  document.querySelectorAll('.trend-bar').forEach((bar, i) => {
    const pct = parseInt(bar.dataset.h);
    setTimeout(() => {
      bar.style.height = Math.round((pct / 100) * maxBarH) + 'px';
    }, 80 + i * 60);
  });
}

// ── XSS Helper ──
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──
renderDashboard();
renderIdeas();
renderSchedule();
