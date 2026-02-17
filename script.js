// FTsmart - frontend script
// Lit meta ftmsmart-api-base si présente
function getApiBaseFromMeta() {
  const m = document.querySelector('meta[name="ftsmart-api-base"]');
  return m ? m.getAttribute('content').trim() : '';
}
const API_BASE = getApiBaseFromMeta() || (window.location.hostname === 'localhost' ? 'http://localhost:4000' : '');

function showMessage(t){ const el = document.getElementById('messages'); if(el) el.textContent = t; }

// utile pour tooltip hints
const HINTS = {
  motsCles: 'Mots-clés : tapez un métier, une tâche ou un intitulé. Ex : "employé polyvalent", "comptable".',
  commune: 'Code INSEE : code officiel de la commune (facultatif). Vous pouvez laisser vide et préciser la région.',
  region: 'Région : nom de la région (ex : Île-de-France).',
  typeContrat: 'Type de contrat : CDI, CDD, intérim, apprentissage, etc.',
  experience: 'Niveaux D / E / S : D = débutant, E = expérimenté, S = senior.',
  skills: 'Compétences : mots séparés par des virgules (ex : vente, accueil, mécanique).'
};

// small utilities
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

// popup logic
const overlay = document.getElementById('overlay');
const popupBody = document.getElementById('popup-body');
const popupClose = document.getElementById('popupClose');
document.getElementById('help-trigger').addEventListener('click', openWhatIs);
document.getElementById('whatIs').addEventListener('click', openWhatIs);
popupClose.addEventListener('click', closePopup);
overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closePopup(); });

function openWhatIs(e){
  e && e.preventDefault();
  const html = `
    <p><strong>FTsmart</strong> est une solution de recherche d’offres conçue pour rendre la recherche d’emploi plus rapide, plus ciblée et plus efficace.</p>

  <h3>Ce que nous faisons</h3>
  <ul>
    <li>Un moteur qui agrège des offres publiques et consolide les résultats.</li>
    <li>Un tri par pertinence centré sur vos compétences et votre localisation.</li>
    <li>Des liens directs vers des outils pratiques (création de CV, lettre de motivation) pour agir immédiatement.</li>
  </ul>

  <h3>Pourquoi l’utiliser ?</h3>
  <p>Parce que la recherche d’emploi ne doit pas être un parcours d’obstacles : FTsmart réduit le bruit, met en avant les offres réellement adaptées et fournit des actions concrètes pour candidater immédiatement.</p>

  <h3>Ce que nous apportons</h3>
  <p>Simplicité, rapidité et valeur pratique — pour les candidats qui veulent postuler, et pour les recruteurs qui veulent trouver des profils qualifiés.</p>

  <h3>Données & potentiel</h3>
  <p>Il existe un grand nombre de profils sur les plateformes publiques et privées (ordres de grandeur : millions de profils/CV). FTsmart transforme cet immense vivier en opportunités ciblées pour chaque utilisateur.</p>
  `;
  popupBody.innerHTML = html;
  overlay.classList.remove('hidden');
}
function closePopup(){ overlay.classList.add('hidden'); }

// hint tooltip behaviour
const hintEl = document.getElementById('hint');
document.querySelectorAll('.hint-btn').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    const k = e.currentTarget.getAttribute('data-key');
    const text = HINTS[k] || 'Information';
    // position near button
    const rect = e.currentTarget.getBoundingClientRect();
    hintEl.textContent = text;
    hintEl.style.left = (rect.right + 8) + 'px';
    hintEl.style.top = (rect.top) + 'px';
    hintEl.classList.remove('hidden');
    setTimeout(()=> hintEl.classList.add('hidden'), 8000);
  });
});

// search and rendering
async function searchOffers(){
  showMessage('Recherche en cours...');
  const body = {
    motsCles: document.getElementById('motsCles').value.trim(),
    commune: document.getElementById('commune') ? document.getElementById('commune').value.trim() : '',
    region: document.getElementById('region') ? document.getElementById('region').value.trim() : '',
    typeContrat: document.getElementById('typeContrat') ? document.getElementById('typeContrat').value.trim() : '',
    experience: document.getElementById('experience') ? document.getElementById('experience').value.trim() : '',
    qualification: document.getElementById('qualification') ? document.getElementById('qualification').value.trim() : '',
    skills: document.getElementById('skills').value.split(',').map(s=>s.trim()).filter(Boolean),
    distance: Number(document.getElementById('distance').value || 50)
  };

  if (!API_BASE){
    showMessage('API non configurée : ajoute la meta ftmsmart-api-base dans index.html ou définis API_BASE.');
    return;
  }

  try {
    const resp = await fetch(API_BASE + '/api/search', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error('Erreur backend ' + resp.status);
    const data = await resp.json();
    renderResults(data.results || []);
    showMessage('');
  } catch (err){
    console.error(err);
    showMessage('Erreur : ' + (err.message || 'problème'));
  }
}

function renderResults(results){
  const node = document.getElementById('results');
  if (!results.length){ node.innerHTML = '<div class="muted">Aucun résultat — essayez d’élargir les critères.</div>'; return; }
  node.innerHTML = results.map(r=>{
    const o = r.offer || r;
    const title = escapeHtml(o.intitule || o.title || '—');
    const company = escapeHtml(o.entreprise?.nom || o.employeur?.nom || '');
    const place = escapeHtml(o.lieuTravail?.libelle || '');
    const desc = escapeHtml((o.description||'').slice(0,240));
    const score = (r.score !== undefined ? Number(r.score).toFixed(2) : (r.meta?.finalScore||0).toFixed(2));
    const dist = r.meta?.distanceKm ? (Number(r.meta.distanceKm).toFixed(1) + ' km') : '';
    return `<div class="offer">
      <div>
        <div class="title">${title}</div>
        <div class="meta">${company} — ${place}</div>
        <div class="small">${desc}</div>
      </div>
      <div style="text-align:right">
        <div class="small">score: ${score}</div>
        <div class="small">${dist}</div>
      </div>
    </div>`;
  }).join('');
}

// attach search button
document.getElementById('searchBtn').addEventListener('click', (e)=>{ e.preventDefault(); searchOffers(); });

// keyboard: press Enter in input triggers search
['motsCles','skills','commune','region'].forEach(id=>{
  const el = document.getElementById(id);
  if(el){ el.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') { e.preventDefault(); searchOffers(); } }); }
});

