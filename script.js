const API_BASE = ''; // si tu déploies, mets ici 'https://<ton-backend-render>'

function showMessage(t){ document.getElementById('messages').textContent = t; }

async function searchOffers(){
  showMessage('Recherche en cours...');
  const body = {
    motsCles: document.getElementById('motsCles').value.trim(),
    commune: document.getElementById('commune').value.trim(),
    departement: document.getElementById('departement').value.trim(),
    region: document.getElementById('region').value.trim(),
    typeContrat: document.getElementById('typeContrat').value.trim(),
    experience: document.getElementById('experience').value.trim(),
    qualification: document.getElementById('qualification').value.trim(),
    skills: document.getElementById('skills').value.split(',').map(s=>s.trim()).filter(Boolean),
    distance: Number(document.getElementById('distance').value || 100)
  };
  let base = API_BASE;
  if (!base) base = window.location.hostname === 'localhost' ? 'http://localhost:4000' : '';
  if (!base){
    showMessage('API non configurée : ouvre script.js et colle l’URL publique du backend dans API_BASE.');
    return;
  }
  try {
    const resp = await fetch(base + '/api/search', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error('Erreur backend ' + resp.status);
    const data = await resp.json();
    renderResults(data.results || []);
    showMessage('');
  } catch (e){
    console.error(e);
    showMessage('Erreur : ' + (e.message || 'problème'));
  }
}

function renderResults(results){
  const container = document.getElementById('results');
  if (!results.length){ container.innerHTML = '<div class="muted">Aucun résultat</div>'; return; }
  container.innerHTML = results.map(item => {
    const o = item.offer || item;
    const score = item.score !== undefined ? Number(item.score).toFixed(2) : (item.meta?.finalScore||0).toFixed(2);
    const dist = item.meta?.distanceKm ? (Number(item.meta.distanceKm).toFixed(1)+' km') : '';
    return `<div class="offer">
      <div>
        <div class="title">${escapeHtml(o.intitule || o.title || '—')}</div>
        <div class="meta">${escapeHtml(o.entreprise?.nom || o.employeur?.nom || '')} — ${escapeHtml(o.lieuTravail?.libelle || '')}</div>
        <div class="small">${escapeHtml((o.description||'').slice(0,240))}</div>
      </div>
      <div style="text-align:right">
        <div class="small">score: ${score}</div>
        <div class="small">${dist}</div>
      </div>
    </div>`;
  }).join('');
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

document.getElementById('searchBtn').addEventListener('click', searchOffers);
