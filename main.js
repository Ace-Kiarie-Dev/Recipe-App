// Mise — a pocket cookbook, powered by the free TheMealDB API.

const API = 'https://www.themealdb.com/api/json/v1/1/';
const ING_IMG = 'https://www.themealdb.com/images/ingredients/';

// ---------- Helpers

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const pad = (n) => String(n).padStart(2, '0');
const slug = (s) => encodeURIComponent(s.trim().toLowerCase().replace(/\s+/g, '_'));

const store = {
    get(key, fallback) {
        try { const v = localStorage.getItem('mise:' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem('mise:' + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
};

// Cache API responses so reopening a recipe or category is instant.
const cache = new Map();
function api(path, { fresh = false } = {}) {
    if (!fresh && cache.has(path)) return cache.get(path);
    const req = fetch(API + path).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    if (!fresh) {
        cache.set(path, req);
        req.catch(() => cache.delete(path));
    }
    return req;
}

// ---------- Icons

const ICONS = {
    heart: '<path d="M12 20.3s-7.6-4.6-9.4-9.3C1.3 7.6 3.6 4.3 7 4.3c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.7 3.3 4.4 6.7-1.8 4.7-9.4 9.3-9.4 9.3z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="15.5" cy="15.5" r=".9" fill="currentColor"/>',
    contrast: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor"/>',
    pot: '<path d="M4 11h16v5a4 4 0 01-4 4H8a4 4 0 01-4-4v-5zM2 11h20M9.5 7.5c0-1.2 1-1.2 1-2.5M13.5 7.5c0-1.2 1-1.2 1-2.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    share: '<path d="M4 13v6a1 1 0 001 1h14a1 1 0 001-1v-6M12 3v12M7.5 7.5L12 3l4.5 4.5"/>',
    play: '<path d="M7 5.5v13l11-6.5z"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.2 2.2M9.5 2.8h5"/>',
    arrowL: '<path d="M14.5 6l-6 6 6 6"/>',
    arrowR: '<path d="M9.5 6l6 6-6 6"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4v4.5H15"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7.5a2 2 0 002 2h2.5"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    resume: '<path d="M8 5.5v13l10-6.5z"/>',
};
const icon = (name) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

function hydrateIcons(root = document) {
    $$('[data-icon]', root).forEach((n) => {
        n.insertAdjacentHTML('afterbegin', icon(n.dataset.icon));
        n.removeAttribute('data-icon');
    });
}

// ---------- State & elements

const state = {
    view: 'discover',
    mode: 'dish',
    fridge: [],
    favs: store.get('favs', []),
    list: store.get('list', []),
    current: null,
    scale: 1,
    cookStep: 0,
};

const el = {
    form: $('#search-form'),
    input: $('#search-input'),
    chips: $('#fridge-chips'),
    hint: $('#search-hint'),
    featured: $('#featured'),
    cats: $('#categories'),
    area: $('#area-select'),
    results: $('#results'),
    grid: $('#grid'),
    resTitle: $('#results-title'),
    resMeta: $('#results-meta'),
    favGrid: $('#fav-grid'),
    favMeta: $('#fav-meta'),
    favCount: $('#fav-count'),
    listCount: $('#list-count'),
    sheet: $('#sheet'),
    sheetBody: $('#sheet-body'),
    drawer: $('#drawer'),
    listBody: $('#list-body'),
    cook: $('#cook'),
    timers: $('#timers'),
    toast: $('#toast'),
};

// ---------- Recipe parsing

const toCard = (m) => ({ id: m.idMeal, name: m.strMeal, thumb: m.strMealThumb, cat: m.strCategory || '', area: m.strArea || '' });

function parseMeal(m) {
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
        const name = (m['strIngredient' + i] || '').trim();
        if (name) ingredients.push({ name, measure: (m['strMeasure' + i] || '').trim() });
    }
    return {
        ...toCard(m),
        tags: (m.strTags || '').split(',').map((t) => t.trim()).filter(Boolean),
        youtube: m.strYoutube,
        source: m.strSource,
        ingredients,
        steps: splitSteps(m.strInstructions || ''),
    };
}

// The API's instructions are one blob with inconsistent "STEP 1" / "1." markers.
function splitSteps(text) {
    let lines = text.split(/\r?\n+/)
        .map((l) => l.trim())
        .filter((l) => l && !/^(step\s*\d+|\d+)\s*[.:)-]?$/i.test(l))
        .map((l) => l.replace(/^(step\s*\d+\s*[.:)-]?\s*|\d+[.)]\s+)/i, ''));
    if (lines.length < 3) {
        const sentences = lines.join(' ').match(/[^.!?]+[.!?]+["')]?(\s|$)|[^.!?]+$/g) || [];
        lines = [];
        for (let i = 0; i < sentences.length; i += 2) lines.push(sentences.slice(i, i + 2).join('').trim());
    }
    return lines.filter(Boolean);
}

// ---------- Quantities (servings scaler)

const UNI_FRAC = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅛': 1 / 8 };
const FRAC_GLYPH = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, '']];
const QTY_RE = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\s*[½⅓⅔¼¾⅛]|\d*\.?\d+|[½⅓⅔¼¾⅛])/;

function parseQty(s) {
    s = s.trim();
    const glyph = s.match(/[½⅓⅔¼¾⅛]/);
    if (glyph) return (parseFloat(s) || 0) + UNI_FRAC[glyph[0]];
    if (s.includes('/')) {
        const [whole, frac] = s.includes(' ') ? s.split(/\s+/) : ['0', s];
        const [a, b] = frac.split('/').map(Number);
        return Number(whole) + a / b;
    }
    return parseFloat(s);
}

function formatQty(n) {
    if (n >= 10) return String(Math.round(n));
    if (n > 0 && n < 0.1) return String(+n.toFixed(2));
    let whole = Math.floor(n);
    const rest = n - whole;
    const [val, glyph] = FRAC_GLYPH.reduce((best, f) => (Math.abs(f[0] - rest) < Math.abs(best[0] - rest) ? f : best));
    if (val === 1) whole += 1;
    return (whole || !glyph ? String(whole) : '') + glyph;
}

function scaleMeasure(measure, k) {
    if (k === 1 || !measure) return measure;
    const m = measure.match(QTY_RE);
    if (!m) return measure;
    return formatQty(parseQty(m[1]) * k) + measure.slice(m[1].length);
}

// ---------- Times found in instructions

const TIME_RE = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to|or)\s*\d+(?:\.\d+)?)?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;
const unitSecs = (u) => ({ h: 3600, m: 60, s: 1 }[u[0].toLowerCase()]);

function stepHTML(text, mealName) {
    let out = '';
    let last = 0;
    for (const m of text.matchAll(TIME_RE)) {
        const secs = Math.round(parseFloat(m[1]) * unitSecs(m[2]));
        out += esc(text.slice(last, m.index));
        out += secs > 0 && secs <= 86400
            ? `<button type="button" class="timer-link" data-timer="${secs}" data-label="${esc(m[0])} · ${esc(mealName)}" aria-label="Start a ${esc(m[0])} timer">${icon('timer')}${esc(m[0])}</button>`
            : esc(m[0]);
        last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
}

function totalMinutes(steps) {
    let secs = 0;
    steps.forEach((s) => { for (const m of s.matchAll(TIME_RE)) secs += parseFloat(m[1]) * unitSecs(m[2]); });
    return Math.round(secs / 60);
}

const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m}m`);

function fmtClock(secs) {
    secs = Math.max(0, Math.ceil(secs));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return (h ? h + ':' + pad(m) : m) + ':' + pad(secs % 60);
}

// ---------- Cards & results

const isFav = (id) => state.favs.some((f) => f.id === id);

function favAttrs(m) {
    return `data-id="${esc(m.id)}" data-name="${esc(m.name)}" data-thumb="${esc(m.thumb)}" data-cat="${esc(m.cat)}" data-area="${esc(m.area)}"`;
}

function cardHTML(m, i) {
    const fav = isFav(m.id);
    const meta = [m.area, m.cat].filter(Boolean).join(' · ');
    return `
        <article class="card" style="--i:${i}" ${favAttrs(m)}>
            <a class="card-link" href="#/meal/${esc(m.id)}">
                <div class="card-img"><img src="${esc(m.thumb)}/preview" alt="" loading="lazy"></div>
                <div class="card-body">
                    <span class="card-no">No. ${pad(i + 1)}${m.badge ? ` · <b>${esc(m.badge)}</b>` : ''}</span>
                    <h3>${esc(m.name)}</h3>
                    ${meta ? `<p class="card-meta">${esc(meta)}</p>` : ''}
                </div>
            </a>
            <button type="button" class="heart ${fav ? 'is-fav' : ''}" data-fav aria-pressed="${fav}" aria-label="Save ${esc(m.name)} to cookbook">${icon('heart')}</button>
        </article>`;
}

const emptyHTML = (emoji, title, text, extra = '') =>
    `<div class="empty"><p class="empty-emoji">${emoji}</p><h3>${title}</h3><p>${text}</p>${extra}</div>`;

let loadId = 0;

// fetcher resolves to { title (HTML, pre-escaped), meals, meta?, emptyText? }
async function loadResults(loadingLabel, fetcher, { scroll = false } = {}) {
    const id = ++loadId;
    el.resTitle.textContent = loadingLabel;
    el.resMeta.textContent = 'Gathering ingredients…';
    el.grid.innerHTML = Array.from({ length: 8 }, () =>
        '<div class="card skeleton"><div class="card-img"></div><div class="card-body"><span></span><span></span></div></div>').join('');
    if (scroll) el.results.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const res = await fetcher();
        if (id !== loadId) return;
        el.resTitle.innerHTML = res.title;
        el.resMeta.textContent = res.meta ?? `${res.meals.length} recipe${res.meals.length === 1 ? '' : 's'}`;
        el.grid.innerHTML = res.meals.length
            ? res.meals.map(cardHTML).join('')
            : emptyHTML('🥄', 'Nothing in the pot', res.emptyText || 'Try a different search.');
    } catch {
        if (id !== loadId) return;
        el.resTitle.textContent = 'The kitchen is offline';
        el.resMeta.textContent = '';
        el.grid.innerHTML = emptyHTML('🔌', 'We couldn’t reach the pantry', 'Check your connection and try again.');
    }
}

function searchDish(q, opts) {
    q = q.trim();
    if (!q) return;
    clearBrowseSelection();
    loadResults(`Searching “${q}”…`, async () => {
        const d = await api('search.php?s=' + encodeURIComponent(q));
        if (d.meals) return { title: `Results for <em>“${esc(q)}”</em>`, meals: d.meals.map(toCard) };
        // No dish by that name? Maybe it's an ingredient.
        const byIng = await api('filter.php?i=' + slug(q));
        if (byIng.meals) {
            return {
                title: `Made with <em>${esc(q)}</em>`,
                meta: `No dish called “${q}”, but these use it · ${byIng.meals.length} recipes`,
                meals: byIng.meals.map(toCard),
            };
        }
        return { title: `Nothing for <em>“${esc(q)}”</em>`, meals: [], emptyText: 'Check the spelling, or switch to “What’s in my fridge” and search by ingredient.' };
    }, opts);
}

// Rank meals by how many of your fridge ingredients they use.
function searchFridge(opts) {
    const items = [...state.fridge];
    if (!items.length) return;
    clearBrowseSelection();
    loadResults('Raiding the fridge…', async () => {
        const lists = await Promise.all(items.map((i) => api('filter.php?i=' + slug(i)).then((d) => d.meals || [])));
        const tally = new Map();
        lists.forEach((list) => list.forEach((m) => {
            const t = tally.get(m.idMeal) || { ...toCard(m), hits: 0 };
            t.hits += 1;
            tally.set(m.idMeal, t);
        }));
        const n = items.length;
        const meals = [...tally.values()]
            .sort((a, b) => b.hits - a.hits)
            .slice(0, 60)
            .map((m) => ({ ...m, badge: n > 1 ? (m.hits === n ? 'Uses all' : `Uses ${m.hits}/${n}`) : '' }));
        const all = meals.filter((m) => m.hits === n).length;
        return {
            title: `Cooking with <em>${esc(items.join(', '))}</em>`,
            meta: n > 1 ? `${all} use everything · ${meals.length} shown` : undefined,
            meals,
            emptyText: 'None of our recipes use that. Check the spelling — the suggestions list knows every ingredient.',
        };
    }, opts);
}

function loadCategory(cat, { scroll = false } = {}) {
    $$('.cat', el.cats).forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === cat));
    el.area.value = '';
    const info = categoryInfo.get(cat);
    loadResults(cat, async () => {
        const d = await api('filter.php?c=' + encodeURIComponent(cat));
        const meals = (d.meals || []).map((m) => ({ ...toCard(m), cat }));
        return { title: `<em>${esc(cat)}</em>`, meta: `${meals.length} recipes${info ? ' · ' + info : ''}`, meals };
    }, { scroll });
}

function loadArea(area) {
    $$('.cat', el.cats).forEach((b) => b.setAttribute('aria-pressed', 'false'));
    loadResults(`${area} kitchen`, async () => {
        const d = await api('filter.php?a=' + encodeURIComponent(area));
        const meals = (d.meals || []).map((m) => ({ ...toCard(m), area }));
        return { title: `The <em>${esc(area)}</em> kitchen`, meals };
    }, { scroll: true });
}

function clearBrowseSelection() {
    $$('.cat', el.cats).forEach((b) => b.setAttribute('aria-pressed', 'false'));
    el.area.value = '';
}

// ---------- Discover: featured, categories, cuisines

const categoryInfo = new Map();

async function loadFeatured() {
    el.featured.classList.add('is-loading');
    el.featured.innerHTML = '';
    try {
        const d = await api('random.php', { fresh: true });
        const raw = d.meals[0];
        cache.set('lookup.php?i=' + raw.idMeal, Promise.resolve(d));
        const m = parseMeal(raw);
        const mins = totalMinutes(m.steps);
        const fav = isFav(m.id);
        el.featured.classList.remove('is-loading');
        el.featured.innerHTML = `
            <a class="feature-img" href="#/meal/${esc(m.id)}" tabindex="-1" aria-hidden="true">
                <img src="${esc(m.thumb)}" alt="">
                <span class="stamp">Chef’s<br>pick</span>
            </a>
            <div class="feature-body" ${favAttrs(m)}>
                <p class="eyebrow"><span class="dot"></span> Tonight’s special · ${esc([m.area, m.cat].filter(Boolean).join(' · '))}</p>
                <h2><a href="#/meal/${esc(m.id)}">${esc(m.name)}</a></h2>
                <p class="feature-blurb">${esc(m.steps[0] || '')}</p>
                <ul class="facts">
                    <li><b>${m.ingredients.length}</b><span>Ingredients</span></li>
                    <li><b>${m.steps.length}</b><span>Steps</span></li>
                    ${mins ? `<li><b>${fmtMins(mins)}</b><span>Timed cooking</span></li>` : ''}
                </ul>
                <div class="feature-actions">
                    <a class="btn btn-primary" href="#/meal/${esc(m.id)}">Open recipe</a>
                    <button type="button" class="btn btn-ghost" data-reroll>${icon('refresh')} Another</button>
                    <button type="button" class="btn btn-ghost ${fav ? 'is-fav' : ''}" data-fav aria-pressed="${fav}" aria-label="Save to cookbook">${icon('heart')}</button>
                </div>
            </div>`;
    } catch {
        el.featured.classList.remove('is-loading');
        el.featured.hidden = true;
    }
}

async function loadCategories() {
    el.cats.innerHTML = Array.from({ length: 8 }, () => '<span class="cat-skel"></span>').join('');
    try {
        const d = await api('categories.php');
        d.categories.forEach((c) => {
            const first = (c.strCategoryDescription || '').split(/(?<=\.)\s/)[0];
            if (first && first.length < 110) categoryInfo.set(c.strCategory, first);
        });
        el.cats.innerHTML = d.categories.map((c) =>
            `<button type="button" class="cat" data-cat="${esc(c.strCategory)}" aria-pressed="false"><img src="${esc(c.strCategoryThumb)}" alt="" loading="lazy">${esc(c.strCategory)}</button>`).join('');
        // Start somewhere different on every visit.
        const pick = d.categories[Math.floor(Math.random() * d.categories.length)].strCategory;
        if (!el.grid.children.length) loadCategory(pick);
    } catch {
        el.cats.innerHTML = '';
        if (!el.grid.children.length) loadResults('', () => Promise.reject());
    }
}

async function loadAreas() {
    try {
        const d = await api('list.php?a=list');
        el.area.insertAdjacentHTML('beforeend', d.meals
            .map((a) => a.strArea).filter((a) => a && a !== 'Unknown').sort()
            .map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join(''));
    } catch { /* select stays at "Anywhere" */ }
}

let ingredientsLoaded = false;
async function loadIngredientOptions() {
    if (ingredientsLoaded) return;
    ingredientsLoaded = true;
    try {
        const d = await api('list.php?i=list');
        $('#ing-options').innerHTML = d.meals.map((i) => `<option value="${esc(i.strIngredient)}">`).join('');
    } catch { ingredientsLoaded = false; }
}

// ---------- Search modes

const HINTS = {
    dish: ['Laksa', 'Shakshuka', 'Jollof', 'Tiramisu', 'Ramen', 'Biryani'],
    fridge: ['Chicken', 'Garlic', 'Rice', 'Eggs', 'Tomatoes', 'Spinach'],
};

function setMode(mode) {
    state.mode = mode;
    $$('[data-mode]').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === mode));
    const fridge = mode === 'fridge';
    el.chips.hidden = !fridge;
    el.input.value = '';
    el.input.placeholder = fridge
        ? (state.fridge.length ? 'Add another…' : 'Type an ingredient, press Enter')
        : 'Search a dish — try “laksa”';
    if (fridge) { el.input.setAttribute('list', 'ing-options'); loadIngredientOptions(); } else el.input.removeAttribute('list');
    renderHint();
    el.input.focus();
}

function renderHint() {
    const fridge = state.mode === 'fridge';
    const words = HINTS[state.mode].filter((w) => !state.fridge.some((f) => f.toLowerCase() === w.toLowerCase()));
    el.hint.innerHTML = `<span>${fridge ? 'Add what you’ve got — we’ll rank meals by how much they use:' : 'Try'}</span>`
        + words.slice(0, 5).map((w) => `<button type="button" data-suggest="${esc(w)}">${fridge ? '+ ' : ''}${esc(w)}</button>`).join('');
}

function renderChips() {
    el.chips.innerHTML = state.fridge.map((f, i) =>
        `<span class="chip-tag">${esc(f)}<button type="button" data-unchip="${i}" aria-label="Remove ${esc(f)}">${icon('close')}</button></span>`).join('');
    el.input.placeholder = state.fridge.length ? 'Add another…' : 'Type an ingredient, press Enter';
    renderHint();
}

function addFridge(name) {
    name = name.trim().replace(/,$/, '');
    if (!name || state.fridge.some((f) => f.toLowerCase() === name.toLowerCase())) return;
    state.fridge.push(name);
    renderChips();
    searchFridge();
}

function removeFridge(i) {
    state.fridge.splice(i, 1);
    renderChips();
    if (state.fridge.length) searchFridge();
}

// ---------- Favourites (cookbook)

function toggleFav(m) {
    const i = state.favs.findIndex((f) => f.id === m.id);
    if (i >= 0) state.favs.splice(i, 1); else state.favs.unshift(m);
    store.set('favs', state.favs);
    syncFavs(true);
    toast(i >= 0 ? 'Removed from your cookbook' : `Saved “${m.name}” to your cookbook`,
        i >= 0 ? null : { label: 'View', fn: () => { location.hash = '#/cookbook'; } });
}

function syncFavs(bump = false) {
    setCount(el.favCount, state.favs.length, bump);
    $$('[data-fav]').forEach((b) => {
        const on = isFav(b.closest('[data-id]').dataset.id);
        b.classList.toggle('is-fav', on);
        b.setAttribute('aria-pressed', on);
        const label = $('.label', b);
        if (label) label.textContent = on ? 'Saved' : 'Save';
    });
    if (state.view === 'cookbook') renderCookbook();
}

function renderCookbook() {
    const n = state.favs.length;
    el.favMeta.textContent = n ? `${n} saved recipe${n === 1 ? '' : 's'}` : '';
    el.favGrid.innerHTML = n
        ? state.favs.map(cardHTML).join('')
        : emptyHTML('📖', 'Your cookbook is empty', 'Tap the heart on any recipe and it’ll live here — even offline-ready on this device.',
            '<a class="btn btn-primary" href="#/">Find something tasty</a>');
}

function setCount(node, n, bump) {
    node.textContent = n;
    node.classList.toggle('is-zero', !n);
    if (bump) { node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }
}

// ---------- Layers (sheet, drawer, cook mode)

const layers = [];

function openLayer(layer, onClose) {
    if (layers.some((l) => l.el === layer)) return;
    layers.push({ el: layer, onClose, returnFocus: document.activeElement });
    layer.hidden = false;
    void layer.offsetWidth;
    layer.classList.add('is-open');
    syncInert();
    setTimeout(() => ($('[data-autofocus]', layer) || $('button', layer))?.focus({ preventScroll: true }), 60);
}

function closeLayer(layer) {
    const i = layers.findIndex((l) => l.el === layer);
    if (i < 0) return;
    const [entry] = layers.splice(i, 1);
    layer.classList.remove('is-open');
    setTimeout(() => { if (!layer.classList.contains('is-open')) layer.hidden = true; }, 450);
    syncInert();
    entry.returnFocus?.focus?.({ preventScroll: true });
    entry.onClose?.();
}

function syncInert() {
    const top = layers.at(-1)?.el;
    [$('.topbar'), $('main'), $('.footer'), el.sheet, el.drawer, el.cook].forEach((n) => { n.inert = !!top && n !== top; });
    document.body.classList.toggle('locked', !!top);
}

$$('.layer').forEach((layer) => layer.addEventListener('click', (e) => {
    if (e.target.closest('[data-dismiss]')) dismiss(layer);
}));

function dismiss(layer) {
    if (layer === el.sheet) leaveMealRoute();
    else closeLayer(layer);
}

// ---------- Recipe sheet

async function openMeal(id) {
    openLayer(el.sheet, () => {
        document.title = 'Mise — a pocket cookbook';
        if (layers.some((l) => l.el === el.cook)) closeCook();
    });
    if (state.current?.id === id && $('#ing-list')) return;
    el.sheetBody.innerHTML = '<div class="sheet-loading"><span class="spinner" aria-label="Loading recipe"></span></div>';
    try {
        const d = await api('lookup.php?i=' + encodeURIComponent(id));
        if (!d.meals) throw new Error('not found');
        if (location.hash !== '#/meal/' + id) return;
        state.current = parseMeal(d.meals[0]);
        state.scale = 1;
        renderSheet(state.current);
        document.title = `${state.current.name} — Mise`;
    } catch {
        state.current = null;
        el.sheetBody.innerHTML = emptyHTML('🍽️', 'We couldn’t plate that one', 'This recipe may not exist, or the pantry is unreachable right now.',
            '<button type="button" class="btn btn-primary" data-dismiss>Back to browsing</button>');
    }
}

function renderSheet(m) {
    const fav = isFav(m.id);
    const mins = totalMinutes(m.steps);
    Object.assign(el.sheet.dataset, { id: m.id, name: m.name, thumb: m.thumb, cat: m.cat, area: m.area });
    el.sheetBody.scrollTop = 0;
    el.sheetBody.innerHTML = `
        <header class="sheet-hero">
            <img src="${esc(m.thumb)}" alt="${esc(m.name)}">
            <div>
                <p class="eyebrow"><span class="dot"></span> ${esc([m.area, m.cat].filter(Boolean).join(' · '))}</p>
                <h2 id="sheet-title">${esc(m.name)}</h2>
                <ul class="facts">
                    <li><b>${m.ingredients.length}</b><span>Ingredients</span></li>
                    <li><b>${m.steps.length}</b><span>Steps</span></li>
                    ${mins ? `<li><b>${fmtMins(mins)}</b><span>Timed cooking</span></li>` : ''}
                </ul>
                ${m.tags.length ? `<p class="tags">${m.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</p>` : ''}
            </div>
        </header>
        <div class="sheet-actions">
            <button type="button" class="btn btn-primary" data-action="cook" data-autofocus>${icon('pot')} Start cooking</button>
            <button type="button" class="btn btn-ghost ${fav ? 'is-fav' : ''}" data-fav aria-pressed="${fav}">${icon('heart')}<span class="label">${fav ? 'Saved' : 'Save'}</span></button>
            <button type="button" class="btn btn-ghost" data-action="list">${icon('list')} Add to list</button>
            <button type="button" class="btn btn-ghost" data-action="share">${icon('share')} Share</button>
            ${m.youtube ? `<a class="btn btn-ghost" href="${esc(m.youtube)}" target="_blank" rel="noopener noreferrer">${icon('play')} Watch</a>` : ''}
        </div>
        <div class="sheet-grid">
            <section class="ingredients" aria-labelledby="ing-h">
                <div class="section-head">
                    <h3 id="ing-h">Ingredients</h3>
                    <div class="scaler" role="group" aria-label="Scale recipe">
                        <button type="button" data-scale="-1" aria-label="Make less">−</button>
                        <output id="scale-out">×1</output>
                        <button type="button" data-scale="1" aria-label="Make more">+</button>
                    </div>
                </div>
                <ul class="ing-list" id="ing-list">
                    ${m.ingredients.map((g) => `
                        <li><label>
                            <input type="checkbox">
                            <img src="${ING_IMG}${encodeURIComponent(g.name)}-Small.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
                            <span class="ing-name">${esc(g.name)}</span>
                            <span class="ing-qty">${esc(g.measure)}</span>
                        </label></li>`).join('')}
                </ul>
                <p class="fine">Tick things off as you prep.</p>
            </section>
            <section class="method" aria-labelledby="method-h">
                <div class="section-head"><h3 id="method-h">Method</h3></div>
                <ol class="steps">
                    ${m.steps.map((s, i) => `<li><span class="step-no">${pad(i + 1)}</span><p>${stepHTML(s, m.name)}</p></li>`).join('')}
                </ol>
                ${m.source ? `<a class="source" href="${esc(m.source)}" target="_blank" rel="noopener noreferrer">Original source ↗</a>` : ''}
            </section>
        </div>`;
}

const SCALES = [0.5, 1, 1.5, 2, 3, 4];

function rescale(dir) {
    const i = Math.min(SCALES.length - 1, Math.max(0, SCALES.indexOf(state.scale) + dir));
    state.scale = SCALES[i];
    $('#scale-out').textContent = '×' + formatQty(state.scale);
    $$('.ing-qty', el.sheetBody).forEach((q, idx) => {
        q.textContent = scaleMeasure(state.current.ingredients[idx].measure, state.scale);
        q.classList.toggle('scaled', state.scale !== 1);
    });
}

el.sheetBody.addEventListener('click', (e) => {
    const scale = e.target.closest('[data-scale]');
    if (scale) return rescale(Number(scale.dataset.scale));
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'cook') openCook();
    if (action === 'list') addToList(state.current);
    if (action === 'share') shareMeal(state.current);
});

async function shareMeal(m) {
    const url = location.href;
    if (navigator.share) {
        try { await navigator.share({ title: m.name, text: `${m.name} — found on Mise`, url }); } catch { /* cancelled */ }
        return;
    }
    try { await navigator.clipboard.writeText(url); toast('Link copied to clipboard'); } catch { toast('Couldn’t copy the link'); }
}

// ---------- Routing

function route() {
    const [, page, id] = (location.hash.slice(1) || '/').split('/');
    if (page === 'meal' && id) {
        if (state.view !== 'cookbook') showView('discover');
        openMeal(id);
        return;
    }
    if (layers.some((l) => l.el === el.sheet)) closeLayer(el.sheet);
    showView(page === 'cookbook' ? 'cookbook' : 'discover');
}

function leaveMealRoute() {
    history.replaceState(null, '', state.view === 'cookbook' ? '#/cookbook' : '#/');
    route();
}

function showView(view) {
    const changed = state.view !== view;
    state.view = view;
    $('#view-discover').hidden = view !== 'discover';
    $('#view-cookbook').hidden = view !== 'cookbook';
    $$('[data-nav]').forEach((a) => {
        if (a.dataset.nav === view) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
    });
    if (view === 'cookbook') renderCookbook();
    if (changed) window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', route);

// ---------- Cook mode

let wakeLock = null;

function openCook() {
    const m = state.current;
    if (!m) return;
    state.cookStep = 0;
    $('#cook-title').textContent = m.name;
    renderCookStep();
    openLayer(el.cook, releaseWakeLock);
    requestWakeLock();
}

function closeCook() { closeLayer(el.cook); }

function renderCookStep() {
    const m = state.current;
    const i = state.cookStep;
    const n = m.steps.length;
    const step = m.steps[i];
    $('#cook-count').innerHTML = `${pad(i + 1)}<small>of ${pad(n)}</small>`;
    const text = $('#cook-text');
    text.innerHTML = stepHTML(step, m.name);
    text.classList.remove('swap'); void text.offsetWidth; text.classList.add('swap');
    $('#cook-bar').style.width = ((i + 1) / n) * 100 + '%';

    const lower = step.toLowerCase();
    const needed = m.ingredients.filter((g) => {
        const name = g.name.toLowerCase();
        return lower.includes(name) || lower.includes(name.replace(/s$/, ''));
    });
    $('#cook-gather').innerHTML = needed.length
        ? needed.map((g) => `<span>${g.measure ? `<b>${esc(scaleMeasure(g.measure, state.scale))}</b>` : ''}${esc(g.name)}</span>`).join('')
        : '';

    $('#cook-prev').disabled = i === 0;
    $('#cook-prev').style.visibility = i === 0 ? 'hidden' : '';
    $('#cook-next').innerHTML = i === n - 1 ? 'Finish 🎉' : `Next ${icon('arrowR')}`;
}

function cookNav(dir) {
    const n = state.current.steps.length;
    const next = state.cookStep + dir;
    if (next >= n) {
        closeCook();
        toast(`Bon appétit! Enjoy your ${state.current.name}.`);
        return;
    }
    if (next < 0) return;
    state.cookStep = next;
    renderCookStep();
}

$('#cook-prev').addEventListener('click', () => cookNav(-1));
$('#cook-next').addEventListener('click', () => cookNav(1));

let touchX = null;
$('#cook-stage').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
$('#cook-stage').addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) cookNav(dx < 0 ? 1 : -1);
});

async function requestWakeLock() {
    $('#cook-awake').textContent = '';
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        $('#cook-awake').textContent = '· screen stays on';
    } catch { /* unsupported or denied */ }
}

function releaseWakeLock() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && layers.at(-1)?.el === el.cook) requestWakeLock();
});

// ---------- Kitchen timers

const timers = [];
let tickHandle = null;
let audio = null;

function startTimer(secs, label) {
    try {
        audio ||= new (window.AudioContext || window.webkitAudioContext)();
        audio.resume();
    } catch { /* no audio */ }
    timers.push({ id: Math.random().toString(36).slice(2), label, total: secs * 1000, left: secs * 1000, end: Date.now() + secs * 1000, paused: false, done: false });
    renderTimers();
    if (!tickHandle) tickHandle = setInterval(tick, 250);
    toast(`Timer started · ${fmtClock(secs)}`);
}

function tick() {
    const now = Date.now();
    timers.forEach((t) => {
        if (t.paused || t.done) return;
        t.left = t.end - now;
        if (t.left <= 0) { t.left = 0; t.done = true; ring(t); renderTimers(); }
    });
    updateTimers();
    if (!timers.some((t) => !t.paused && !t.done)) { clearInterval(tickHandle); tickHandle = null; }
}

function renderTimers() {
    el.timers.innerHTML = timers.map((t) => `
        <div class="timer ${t.done ? 'is-done' : ''} ${t.paused ? 'is-paused' : ''}" data-tid="${t.id}">
            <span class="timer-ring"></span>
            <span class="timer-info"><b class="timer-clock"></b><span class="timer-label">${esc(t.label)}</span></span>
            ${t.done ? '' : `<button type="button" data-tact="pause" aria-label="${t.paused ? 'Resume' : 'Pause'} timer">${icon(t.paused ? 'resume' : 'pause')}</button>`}
            <button type="button" data-tact="cancel" aria-label="${t.done ? 'Dismiss' : 'Cancel'} timer">${icon('close')}</button>
        </div>`).join('');
    updateTimers();
}

function updateTimers() {
    timers.forEach((t) => {
        const node = $(`[data-tid="${t.id}"]`, el.timers);
        if (!node) return;
        $('.timer-clock', node).textContent = t.done ? 'Time’s up!' : fmtClock(t.left / 1000);
        $('.timer-ring', node).style.setProperty('--p', t.left / t.total);
    });
}

el.timers.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tact]');
    if (!btn) return;
    const i = timers.findIndex((t) => t.id === btn.closest('[data-tid]').dataset.tid);
    const t = timers[i];
    if (btn.dataset.tact === 'cancel') timers.splice(i, 1);
    else if (t.paused) { t.paused = false; t.end = Date.now() + t.left; if (!tickHandle) tickHandle = setInterval(tick, 250); }
    else t.paused = true;
    renderTimers();
});

function ring(t) {
    navigator.vibrate?.([300, 120, 300, 120, 300]);
    toast(`⏰ ${t.label} — time’s up!`);
    if (!audio) return;
    const now = audio.currentTime;
    [0, 0.4, 0.8, 1.6, 2.0, 2.4].forEach((d) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + d);
        gain.gain.exponentialRampToValueAtTime(0.25, now + d + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.3);
        osc.connect(gain).connect(audio.destination);
        osc.start(now + d);
        osc.stop(now + d + 0.32);
    });
}

// ---------- Shopping list

function saveList() {
    store.set('list', state.list);
    setCount(el.listCount, state.list.filter((i) => !i.done).length, true);
}

function addToList(m) {
    state.list = state.list.filter((i) => i.mealId !== m.id);
    m.ingredients.forEach((g) => state.list.push({
        key: m.id + ':' + g.name,
        text: [scaleMeasure(g.measure, state.scale), g.name].filter(Boolean).join(' '),
        meal: m.name,
        mealId: m.id,
        done: false,
    }));
    saveList();
    renderList();
    toast(`Added ${m.ingredients.length} items to your list`, { label: 'View list', fn: openList });
}

function renderList() {
    if (!state.list.length) {
        el.listBody.innerHTML = emptyHTML('🧺', 'Nothing to buy yet', 'Open a recipe and tap “Add to list” — ingredients land here, grouped by dish.');
        $$('.drawer-foot .btn').forEach((b) => { b.disabled = true; });
        return;
    }
    $$('.drawer-foot .btn').forEach((b) => { b.disabled = false; });
    const groups = new Map();
    state.list.forEach((item) => {
        if (!groups.has(item.mealId)) groups.set(item.mealId, { meal: item.meal, items: [] });
        groups.get(item.mealId).items.push(item);
    });
    el.listBody.innerHTML = [...groups].map(([id, g]) => `
        <section class="list-group">
            <h3><a href="#/meal/${esc(id)}">${esc(g.meal)}</a><button type="button" data-unlist="${esc(id)}">Remove</button></h3>
            <ul>${g.items.map((i) => `<li><label><input type="checkbox" data-item="${esc(i.key)}" ${i.done ? 'checked' : ''}><span>${esc(i.text)}</span></label></li>`).join('')}</ul>
        </section>`).join('');
}

function openList() {
    renderList();
    openLayer(el.drawer);
}

el.listBody.addEventListener('change', (e) => {
    const item = state.list.find((i) => i.key === e.target.dataset.item);
    if (!item) return;
    item.done = e.target.checked;
    saveList();
});

el.listBody.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-unlist]');
    if (rm) {
        state.list = state.list.filter((i) => i.mealId !== rm.dataset.unlist);
        saveList();
        renderList();
    }
    if (e.target.closest('a[href^="#/meal/"]')) closeLayer(el.drawer);
});

$('#open-list').addEventListener('click', openList);

$('#list-copy').addEventListener('click', async () => {
    const groups = {};
    state.list.filter((i) => !i.done).forEach((i) => { (groups[i.meal] ||= []).push('☐ ' + i.text); });
    const text = Object.entries(groups).map(([meal, lines]) => `${meal}\n${lines.join('\n')}`).join('\n\n');
    try { await navigator.clipboard.writeText(text || 'All done!'); toast('Shopping list copied — paste it anywhere'); } catch { toast('Couldn’t copy the list'); }
});

$('#list-clear-done').addEventListener('click', () => {
    state.list = state.list.filter((i) => !i.done);
    saveList();
    renderList();
});

$('#list-clear').addEventListener('click', () => {
    const backup = state.list;
    state.list = [];
    saveList();
    renderList();
    toast('Shopping list cleared', { label: 'Undo', fn: () => { state.list = backup; saveList(); renderList(); } });
});

// ---------- Toast

let toastTimer;
function toast(msg, action) {
    el.toast.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
    if (action) $('button', el.toast).onclick = () => { el.toast.classList.remove('show'); action.fn(); };
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), action ? 4500 : 2800);
}

// ---------- Theme

function toggleTheme() {
    const root = document.documentElement;
    const dark = (root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    root.dataset.theme = dark ? 'light' : 'dark';
    store.set('theme', root.dataset.theme);
    syncThemeColor();
}

function syncThemeColor() {
    $('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
}

$('#theme-toggle').addEventListener('click', toggleTheme);

// ---------- Global events

el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.mode === 'fridge') {
        if (el.input.value.trim()) { addFridge(el.input.value); el.input.value = ''; } else searchFridge({ scroll: true });
        el.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        searchDish(el.input.value, { scroll: true });
    }
});

const liveSearch = debounce((q) => { if (state.mode === 'dish' && q.trim().length >= 3) searchDish(q); }, 450);

el.input.addEventListener('input', (e) => {
    if (state.mode === 'dish') return liveSearch(el.input.value);
    // Picking from the ingredient suggestions adds it straight away.
    if (e.inputType === 'insertReplacementText' || e.inputType === undefined) {
        const match = [...$('#ing-options').options].some((o) => o.value === el.input.value);
        if (match) { addFridge(el.input.value); el.input.value = ''; }
    }
});

el.input.addEventListener('keydown', (e) => {
    if (state.mode !== 'fridge') return;
    if (e.key === ',' && el.input.value.trim()) {
        e.preventDefault();
        addFridge(el.input.value);
        el.input.value = '';
    }
    if (e.key === 'Backspace' && !el.input.value && state.fridge.length) removeFridge(state.fridge.length - 1);
});

$$('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

$('#surprise').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
        const d = await api('random.php', { fresh: true });
        cache.set('lookup.php?i=' + d.meals[0].idMeal, Promise.resolve(d));
        location.hash = '#/meal/' + d.meals[0].idMeal;
    } catch {
        toast('The dice rolled off the table — try again');
    } finally {
        btn.disabled = false;
    }
});

el.cats.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]');
    if (c) loadCategory(c.dataset.cat, { scroll: true });
});

el.area.addEventListener('change', () => {
    if (el.area.value) loadArea(el.area.value);
});

document.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
        e.preventDefault();
        const d = fav.closest('[data-id]').dataset;
        toggleFav({ id: d.id, name: d.name, thumb: d.thumb, cat: d.cat || '', area: d.area || '' });
        return;
    }
    const timer = e.target.closest('[data-timer]');
    if (timer) return startTimer(Number(timer.dataset.timer), timer.dataset.label);

    const suggest = e.target.closest('[data-suggest]');
    if (suggest) {
        if (state.mode === 'fridge') addFridge(suggest.dataset.suggest);
        else { el.input.value = suggest.dataset.suggest; searchDish(suggest.dataset.suggest, { scroll: true }); }
        return;
    }
    const unchip = e.target.closest('[data-unchip]');
    if (unchip) { removeFridge(Number(unchip.dataset.unchip)); el.input.focus(); return; }

    if (e.target.closest('[data-reroll]')) loadFeatured();
});

document.addEventListener('keydown', (e) => {
    const top = layers.at(-1)?.el;
    if (e.key === 'Escape' && top) { e.preventDefault(); dismiss(top); return; }
    if (top === el.cook) {
        if (e.key === 'ArrowRight') cookNav(1);
        if (e.key === 'ArrowLeft') cookNav(-1);
        return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (e.key === '/' && !top && !typing && state.view === 'discover') {
        e.preventDefault();
        el.input.focus();
        el.input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});

// ---------- Boot

$('#today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
hydrateIcons();
syncFavs();
setCount(el.listCount, state.list.filter((i) => !i.done).length);
renderList();
renderHint();
syncThemeColor();
loadFeatured();
loadCategories();
loadAreas();
route();
