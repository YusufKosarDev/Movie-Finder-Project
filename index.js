const apiKey = "a218db85"; 
const BASE = "https://www.omdbapi.com/";


const auth = firebase.auth();
const db = firebase.firestore();


const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const moviesContainer = document.getElementById('moviesContainer');
const statusEl = document.getElementById('status');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');
const modalBackdrop = document.getElementById('modalBackdrop');
const favoritesBtn = document.getElementById('favoritesBtn');
const favCountEl = document.getElementById('favCount');
const chartBtn = document.getElementById('chartBtn');
const chartModal = document.getElementById('chartModal');
const chartClose = document.getElementById('chartClose');
const chartBackdrop = document.getElementById('chartBackdrop');
const favChartCanvas = document.getElementById('favChart');
const exportFavsBtn = document.getElementById('exportFavs');
const themeToggle = document.getElementById('themeToggle');
const gamifyEl = document.getElementById('gamify');

let currentQuery = '';
let currentPage = 1;
let totalResults = 0;
const RESULTS_PER_PAGE = 10;
const CACHE_PREFIX = 'mf_cache_';
const LOCAL_FAV_KEY = 'mf_favs';
let currentUser = null;
let favChart = null;


function debounce(fn, delay = 450) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
function setStatus(text = '') { statusEl.textContent = text; }
function escapeHtml(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function saveCache(key, data) {
  try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); } catch(e){}
}
function readCache(key, maxAgeMs = 1000 * 60 * 5) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return parsed.data;
  } catch(e) { return null; }
}


function getLocalFavs() { try { return JSON.parse(localStorage.getItem(LOCAL_FAV_KEY) || '[]'); } catch(e){ return []; } }
function setLocalFavs(list){ localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(list)); }


async function firebaseSignInAnonymously() {
  try {
    const res = await auth.signInAnonymously();
    currentUser = res.user;
    
    await ensureUserFavoritesDoc();
    listenToRemoteFavorites();
    updateFavoritesBadge();
  } catch(e) {
    console.warn('Firebase auth failed', e);
    
    currentUser = null;
    updateFavoritesBadge();
  }
}

async function ensureUserFavoritesDoc() {
  if (!currentUser) return;
  const docRef = db.collection('favorites').doc(currentUser.uid);
  const doc = await docRef.get();
  if (!doc.exists) {
    const local = getLocalFavs();
    await docRef.set({ items: local });
  }
}

let remoteUnsubscribe = null;
function listenToRemoteFavorites() {
  if (!currentUser) return;
  if (remoteUnsubscribe) remoteUnsubscribe();
  remoteUnsubscribe = db.collection('favorites').doc(currentUser.uid)
    .onSnapshot((snap) => {
      if (!snap.exists) return;
      const data = snap.data();
      if (data && Array.isArray(data.items)) {
        
        setLocalFavs(data.items);
        updateFavoritesBadge();
      }
    }, (err) => {
      console.warn('fav listen error', err);
    });
}

async function pushFavoritesToCloud() {
  if (!currentUser) return;
  try {
    const list = getLocalFavs();
    await db.collection('favorites').doc(currentUser.uid).set({ items: list });
  } catch (e) {
    console.warn('push favs failed', e);
  }
}


function clearResults(){ moviesContainer.innerHTML = ''; }
function renderMovieList(items, append = false) {
  if (!append) clearResults();
  if (!items || items.length === 0) {
    moviesContainer.innerHTML = `<div class="empty">No results</div>`;
    return;
  }
  items.forEach(movie => {
    const li = document.createElement('li');
    li.className = 'movie-item';
    li.setAttribute('data-imdbid', movie.imdbID);
    const poster = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : 'images/poster-placeholder.png';
    li.innerHTML = `
      <div class="movie-thumb"><img loading="lazy" src="${poster}" alt="${escapeHtml(movie.Title)} poster"></div>
      <div class="movie-meta">
        <h3>${escapeHtml(movie.Title)} <span class="badge">${escapeHtml(movie.Type)}</span></h3>
        <p>Year: ${escapeHtml(movie.Year)}</p>
        <div class="movie-actions">
          <button class="btn btn-primary btn-details" data-imdbid="${movie.imdbID}">Details</button>
          <button class="btn btn-ghost btn-fav" data-imdbid="${movie.imdbID}">${isFavorite(movie.imdbID) ? 'Remove ★' : 'Add ★'}</button>
        </div>
      </div>
    `;
    moviesContainer.appendChild(li);
  });
  
  document.querySelectorAll('.btn-details').forEach(b => { b.onclick = () => openDetailsModal(b.dataset.imdbid); });
  document.querySelectorAll('.btn-fav').forEach(b => { b.onclick = () => toggleFavorite(b.dataset.imdbid, b); });
}

function isFavorite(imdbID) {
  const favs = getLocalFavs();
  return favs.some(f => f.imdbID === imdbID);
}

function updateFavoritesBadge(){
  const count = getLocalFavs().length;
  favCountEl.textContent = count;
  favoritesBtn.setAttribute('aria-pressed', count>0 ? 'true' : 'false');
  updateGamification(count);
}


async function fetchMovies(query, page = 1) {
  const key = `${query}::${page}`;
  const cached = readCache(key);
  if (cached) return cached;
  const url = `${BASE}?s=${encodeURIComponent(query)}&page=${page}&apikey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  saveCache(key, data);
  return data;
}
async function fetchMovieDetail(imdbID) {
  const key = `DETAIL::${imdbID}`;
  const cached = readCache(key);
  if (cached) return cached;
  const url = `${BASE}?i=${encodeURIComponent(imdbID)}&plot=full&apikey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  saveCache(key, data);
  return data;
}


async function doSearch(query) {
  if (!query) { setStatus(''); clearResults(); return; }
  currentQuery = query;
  currentPage = 1;
  setStatus(`Searching for "${query}"...`);
  const data = await fetchMovies(query, 1);
  setStatus('');
  if (!data || data.Response === "False") {
    clearResults();
    setStatus(`No results found for "${query}"`);
    loadMoreBtn.style.display = 'none';
    return;
  }
  totalResults = parseInt(data.totalResults || '0', 10);
  renderMovieList(data.Search, false);
  updateLoadMoreVisibility();
}

async function loadMore() {
  if (!currentQuery) return;
  const next = currentPage + 1;
  const data = await fetchMovies(currentQuery, next);
  if (!data || data.Response === "False") {
    setStatus('No more results.');
    return;
  }
  currentPage = next;
  renderMovieList(data.Search, true);
  updateLoadMoreVisibility();
}
function updateLoadMoreVisibility() {
  const shown = currentPage * RESULTS_PER_PAGE;
  if (shown >= totalResults) loadMoreBtn.style.display = 'none';
  else loadMoreBtn.style.display = 'inline-block';
}


async function openDetailsModal(imdbID) {
  modal.setAttribute('aria-hidden','false');
  modalContent.innerHTML = `<div style="padding:20px;color:#bbb">Loading details...</div>`;
  document.body.style.overflow = 'hidden';
  try {
    const detail = await fetchMovieDetail(imdbID);
    if (!detail || detail.Response === "False") {
      modalContent.innerHTML = `<div style="padding:20px;color:#bbb">Details not available.</div>`;
      return;
    }
    const poster = detail.Poster && detail.Poster !== 'N/A' ? detail.Poster : 'images/poster-placeholder.png';
    modalContent.innerHTML = `
      <div class="modal-pic"><img src="${poster}" alt="${escapeHtml(detail.Title)} poster" style="width:100%;height:100%;object-fit:cover;"></div>
      <div class="modal-body">
        <h2 id="modalTitle">${escapeHtml(detail.Title)} <span class="badge">${escapeHtml(detail.Year)}</span></h2>
        <p><strong>IMDb:</strong> ${escapeHtml(detail.imdbRating || 'N/A')} • <strong>Runtime:</strong> ${escapeHtml(detail.Runtime || 'N/A')}</p>
        <p><strong>Genre:</strong> ${escapeHtml(detail.Genre || 'N/A')}</p>
        <p style="color:#ccc;">${escapeHtml(detail.Plot || 'No plot available.')}</p>
        <p><strong>Director:</strong> ${escapeHtml(detail.Director || 'N/A')}</p>
        <p><strong>Actors:</strong> ${escapeHtml(detail.Actors || 'N/A')}</p>
        <div style="margin-top:12px;">
          <button class="btn btn-primary" id="modalFavBtn">${isFavorite(detail.imdbID) ? 'Remove ★' : 'Add ★'}</button>
          <a class="btn btn-ghost" href="https://www.imdb.com/title/${escapeHtml(detail.imdbID)}/" target="_blank" rel="noopener">Open on IMDb</a>
        </div>
      </div>
    `;
    document.getElementById('modalFavBtn').onclick = async () => {
      toggleFavorite(detail.imdbID);
      document.getElementById('modalFavBtn').textContent = isFavorite(detail.imdbID) ? 'Remove ★' : 'Add ★';
      updateFavoritesBadge();
    };
  } catch(e) {
    modalContent.innerHTML = `<div style="padding:20px;color:#bbb">Error loading details.</div>`;
  }
}


async function toggleFavorite(imdbID, btnEl) {
  const favs = getLocalFavs();
  const exists = favs.find(f => f.imdbID === imdbID);
  if (exists) {
    const newList = favs.filter(f => f.imdbID !== imdbID);
    setLocalFavs(newList);
    if (btnEl) btnEl.textContent = 'Add ★';
  } else {
    
    let title = '', year = '';
    const item = document.querySelector(`li[data-imdbid="${imdbID}"]`);
    if (item) {
      title = item.querySelector('.movie-meta h3')?.childNodes[0].textContent.trim() || '';
      year = item.querySelector('.movie-meta p')?.textContent.replace('Year:','').trim() || '';
    } else {
      try {
        const d = await fetchMovieDetail(imdbID);
        title = d.Title || '';
        year = d.Year || '';
      } catch(e){}
    }
    const obj = { imdbID, Title: title, Year: year };
    favs.push(obj);
    setLocalFavs(favs);
    if (btnEl) btnEl.textContent = 'Remove ★';
  }
  updateFavoritesBadge();
  
  if (currentUser) pushFavoritesToCloud();
}


function showFavorites() {
  const favs = getLocalFavs();
  if (!favs || favs.length === 0) {
    clearResults();
    moviesContainer.innerHTML = `<div class="empty">You have no favorites yet.</div>`;
    return;
  }
  const items = favs.map(f => ({ ...f, Poster: 'images/poster-placeholder.png', Type: 'movie' }));
  renderMovieList(items, false);
}


async function generateFavoritesChart() {
  const favs = getLocalFavs();
  if (!favs || favs.length === 0) {
    alert('No favorites to analyze.');
    return;
  }
  
  const detailsArr = [];
  for (const f of favs) {
    try {
      const d = await fetchMovieDetail(f.imdbID);
      detailsArr.push(d);
    } catch(e) {
      detailsArr.push({ Title: f.Title, Year: f.Year, Genre: 'Unknown' });
    }
  }
  
  const genreCounts = {};
  const decadeCounts = {};
  detailsArr.forEach(d => {
    const genre = (d.Genre && d.Genre !== 'N/A') ? d.Genre.split(',')[0].trim() : 'Unknown';
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    const year = parseInt((d.Year || '').slice(0,4)) || 0;
    const decade = year ? Math.floor(year/10)*10 : 0;
    const label = decade ? `${decade}s` : 'Unknown';
    decadeCounts[label] = (decadeCounts[label] || 0) + 1;
  });

  
  const dataObj = Object.keys(genreCounts).length > 1 ? { title: 'Favorites by Genre', data: genreCounts } : { title: 'Favorites by Decade', data: decadeCounts };

  
  const labels = Object.keys(dataObj.data);
  const values = Object.values(dataObj.data);

  if (favChart) favChart.destroy();
  favChart = new Chart(favChartCanvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' }, title: { display: true, text: dataObj.title } }
    }
  });

  
  chartModal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}

exportFavsBtn && exportFavsBtn.addEventListener('click', () => {
  const favs = getLocalFavs();
  const blob = new Blob([JSON.stringify(favs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'moviefinder-favorites.json'; a.click();
  URL.revokeObjectURL(url);
});


function initTheme() {
  const prefer = localStorage.getItem('mf_theme') || 'dark';
  if (prefer === 'light') document.body.classList.add('light');
  updateThemeIcon();
}
function toggleTheme() {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  localStorage.setItem('mf_theme', isLight ? 'light' : 'dark');
  updateThemeIcon();
}
function updateThemeIcon() {
  themeToggle.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
}
themeToggle.addEventListener('click', toggleTheme);


function updateGamification(count) {
  gamifyEl.innerHTML = '';
  if (count <= 0) return;
  let level = 'Novice Collector';
  if (count >= 10) level = 'Cinephile';
  else if (count >= 5) level = 'Enthusiast';
  const div = document.createElement('div');
  div.className = 'level';
  div.textContent = `${level} • ${count} favorites`;
  gamifyEl.appendChild(div);
}


const debouncedSearch = debounce((v) => doSearch(v), 450);

searchInput.addEventListener('input', (e) => {
  const v = e.target.value.trim();
  if (!v) { setStatus(''); currentQuery = ''; clearResults(); loadMoreBtn.style.display = 'none'; return; }
  
});

searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(searchInput.value.trim()); });
searchBtn.addEventListener('click', () => doSearch(searchInput.value.trim()));
loadMoreBtn.addEventListener('click', loadMore);

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeChartModal(); } });

favoritesBtn.addEventListener('click', () => showFavorites());
chartBtn.addEventListener('click', () => generateFavoritesChart());
chartClose.addEventListener('click', closeChartModal);
chartBackdrop.addEventListener('click', closeChartModal);

function closeModal(){ modal.setAttribute('aria-hidden','true'); modalContent.innerHTML = ''; document.body.style.overflow = ''; }
function closeChartModal(){ chartModal.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; }


async function initFirebaseAndApp() {
  
  try {
    await firebaseSignInAnonymously();
  } catch(e) {
    console.warn('anonymous sign-in failed', e);
  }
}


(function init() {
  setStatus('');
  loadMoreBtn.style.display = 'none';
  updateFavoritesBadge();
  initTheme();
  initFirebaseAndApp();
})();