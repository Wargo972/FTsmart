// FTsmart backend - server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());

const {
  USE_MOCK = 'true',
  CLIENT_ID,
  CLIENT_SECRET,
  FT_TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire',
  FT_API_BASE = 'https://api.francetravail.io/partenaire/offresdemploi/v2',
  ALLOWED_ORIGIN = '',
  PORT = 4000
} = process.env;

const allowed = (ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!allowed.length) return cb(null, true);
    cb(null, allowed.includes(origin));
  }
}));

const MOCK_OFFERS = [
  { id:'1', intitule:'Développeur Frontend React', description:'React, TypeScript, tests', lieuTravail:{ geoCoordinates:{ latitude:48.8566, longitude:2.3522 }, libelle:'Paris' }, entreprise:{ nom:'Acme' }, competences:['react','typescript','css'] },
  { id:'2', intitule:'Développeur Backend Node', description:'Node.js, Express, Postgres', lieuTravail:{ geoCoordinates:{ latitude:48.8566, longitude:2.4 }, libelle:'Paris 12' }, entreprise:{ nom:'BackCorp' }, competences:['node','postgres'] },
  { id:'3', intitule:'Ingénieur Data', description:'Python, SQL, Data', lieuTravail:{ geoCoordinates:{ latitude:45.7640, longitude:4.8357 }, libelle:'Lyon' }, entreprise:{ nom:'DataFlow' }, competences:['python','sql'] }
];

function haversineKm(lat1, lon1, lat2, lon2){
  function r(a){return a*Math.PI/180;}
  const R=6371;
  const dLat=r(lat2-lat1), dLon=r(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(r(lat1))*Math.cos(r(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function scoreOffer(offer, skills=[], userLocation=null, maxKm=100){
  const text = ((offer.intitule||'')+' '+(offer.description||'')+' '+(offer.competences||[]).join(' ')).toLowerCase();
  const s = skills.map(x=>x.trim().toLowerCase()).filter(Boolean);
  let matches = 0;
  for(const k of s) if (text.includes(k)) matches++;
  const skillScore = s.length ? (matches / s.length) : 0;
  let distanceKm = null, distanceScore = 0;
  if (userLocation && offer.lieuTravail && offer.lieuTravail.geoCoordinates){
    const lat = Number(offer.lieuTravail.geoCoordinates.latitude);
    const lon = Number(offer.lieuTravail.geoCoordinates.longitude);
    if (!isNaN(lat) && !isNaN(lon)){
      distanceKm = haversineKm(userLocation.lat, userLocation.lon, lat, lon);
      const capped = Math.min(distanceKm, maxKm);
      distanceScore = 1 - (capped / maxKm);
      if (distanceScore < 0) distanceScore = 0;
    }
  }
  const wSkill = 0.75, wDist = 0.25;
  const finalScore = (skillScore * wSkill) + (distanceScore * wDist);
  return { skillScore, distanceScore, distanceKm, finalScore };
}

let tokenCache = { access_token:null, expires_at:0 };

async function getAccessToken(){
  if (USE_MOCK === 'true') return null;
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('CLIENT_ID/CLIENT_SECRET manquants');
  const now = Date.now()/1000;
  if (tokenCache.access_token && tokenCache.expires_at - 60 > now) return tokenCache.access_token;
  const params = new URLSearchParams();
  params.append('grant_type','client_credentials');
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('scope','api_offresdemploiv2 o2dsoffre');
  const resp = await axios.post(FT_TOKEN_URL, params.toString(), { headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, timeout:10000 });
  tokenCache.access_token = resp.data.access_token;
  tokenCache.expires_at = now + (resp.data.expires_in || 1500);
  return tokenCache.access_token;
}

app.post('/api/search', async (req, res) => {
  try {
    const { motsCles, commune, departement, region, typeContrat, experience, qualification, distance=100, range='0-9', skills=[], userLocation=null } = req.body||{};
    if (USE_MOCK === 'true' || !CLIENT_ID || !CLIENT_SECRET){
      const scored = MOCK_OFFERS.map(o => {
        const meta = scoreOffer(o, skills, userLocation, Number(distance||100));
        return { offer:o, score:meta.finalScore, meta };
      }).sort((a,b)=>b.score - a.score);
      return res.json({ total: scored.length, results: scored });
    }
    const token = await getAccessToken();
    const params = {};
    if (motsCles) params.motsCles = motsCles;
    if (commune) params.commune = commune;
    if (departement) params.departement = departement;
    if (region) params.region = region;
    if (typeContrat) params.typeContrat = typeContrat;
    if (experience) params.experience = experience;
    if (qualification) params.qualification = qualification;
    if (distance) params.distance = distance;
    if (range) params.range = range;
    const resp = await axios.get(`${FT_API_BASE}/offres/search`, { headers:{ Authorization:`Bearer ${token}` }, params, timeout:15000 });
    const data = resp.data || {};
    let offers = [];
    if (Array.isArray(data.resultats)) offers = data.resultats;
    else if (Array.isArray(data.offres)) offers = data.offres;
    else if (Array.isArray(data.hits)) offers = data.hits;
    else if (Array.isArray(data)) offers = data;
    else offers = data.results || [];
    const scored = offers.map(o => {
      const meta = scoreOffer(o, skills, userLocation, Number(distance||100));
      return { offer:o, score:meta.finalScore, meta };
    }).sort((a,b)=>b.score - a.score);
    return res.json({ total: scored.length, results: scored });
  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    res.status(500).json({ error:'erreur serveur', details: err?.response?.data || err?.message });
  }
});

app.get('/api/health', (req,res) => res.json({ ok:true, mock: USE_MOCK === 'true' }));
app.listen(PORT, ()=> console.log(`FTsmart backend lancé sur ${PORT} (USE_MOCK=${USE_MOCK})`));
