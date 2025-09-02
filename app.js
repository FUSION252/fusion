// ---------- Config helpers ----------
function getEmbeddedConfig(){
  return { api:{provider:'google_cse'} };
}
function getApiConfig(){
  const storeKey = localStorage.getItem('ZENIX_API_KEY');
  const storeCx  = localStorage.getItem('ZENIX_API_CX');
  const emb = getEmbeddedConfig();
  return {
    provider: emb?.api?.provider || 'google_cse',
    key: storeKey || 'TANDERA_1',
    cx:  storeCx  || 'TANDERA_2'
  };
}
function getFirebaseConfig(){
  try{
    const raw = localStorage.getItem('ZENIX_FIREBASE_CFG');
    if(!raw) return null; return JSON.parse(raw);
  }catch{ return null; }
}
// ---------- UI helpers ----------
function qs(id){ return document.getElementById(id); }
function show(el){ el.style.display = ''; }
function hide(el){ el.style.display = 'none'; }
function openModal(id){ qs(id).style.display='flex'; }
function closeModal(id){ qs(id).style.display='none'; }

// ---------- Config modal ----------
qs('openCfg').addEventListener('click', ()=>{
  const {key,cx} = getApiConfig();
  qs('cfg_key').value = (key==='TANDERA_1'?'':key);
  qs('cfg_cx').value  = (cx==='TANDERA_2'?'':cx);
  const fb = localStorage.getItem('ZENIX_FIREBASE_CFG') || '';
  qs('cfg_firebase').value = fb;
  openModal('cfgModal');
});
qs('closeCfg').addEventListener('click', ()=> closeModal('cfgModal'));
qs('saveCfg').addEventListener('click', ()=>{
  const k = qs('cfg_key').value.trim();
  const cx = qs('cfg_cx').value.trim();
  if(k) localStorage.setItem('ZENIX_API_KEY', k);
  if(cx) localStorage.setItem('ZENIX_API_CX', cx);
  const fb = qs('cfg_firebase').value.trim();
  if(fb){ localStorage.setItem('ZENIX_FIREBASE_CFG', fb); }
  alert('Config salva ✅');
  closeModal('cfgModal');
});

// ---------- Auth (Firebase opcional; fallback convidado) ----------
let currentUser = null;
function updateAuthUI(){
  const name = currentUser?.email || currentUser?.displayName || (currentUser ? 'Usuário' : 'Convidado');
  document.title = 'ZENIX Tube' + (name ? ' · ' + name : '');
}
async function initAuth(){
  const cfg = getFirebaseConfig();
  if(!cfg || !window.firebase) { currentUser = { guest:true, displayName:'Convidado' }; updateAuthUI(); return; }
  try{
    firebase.initializeApp(cfg);
    const auth = firebase.auth();
    auth.onAuthStateChanged(u=>{ currentUser = u || { guest:true, displayName:'Convidado' }; updateAuthUI(); });
  }catch(e){ console.warn('Firebase init failed', e); currentUser = { guest:true }; updateAuthUI(); }
}
qs('openAuth').addEventListener('click', ()=> openModal('authModal'));
qs('closeAuth').addEventListener('click', ()=> closeModal('authModal'));
qs('auth_guest').addEventListener('click', ()=>{ currentUser = { guest:true, displayName:'Convidado' }; updateAuthUI(); closeModal('authModal'); });
qs('auth_login').addEventListener('click', async ()=>{
  const cfg = getFirebaseConfig();
  const email = qs('auth_email').value.trim();
  const pass = qs('auth_pass').value;
  if(!cfg || !window.firebase){ alert('Ative o Firebase nas Configurações para login real. Entrando como convidado.'); currentUser = { guest:true, displayName:'Convidado' }; closeModal('authModal'); updateAuthUI(); return; }
  try{
    const userCred = await firebase.auth().signInWithEmailAndPassword(email, pass);
    currentUser = userCred.user; updateAuthUI(); closeModal('authModal');
  }catch(e){ alert('Falha no login: '+(e?.message||e)); }
});
qs('auth_signup').addEventListener('click', async ()=>{
  const cfg = getFirebaseConfig();
  const email = qs('auth_email').value.trim();
  const pass = qs('auth_pass').value;
  if(!cfg || !window.firebase){ alert('Ative o Firebase nas Configurações.'); return; }
  try{
    const userCred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
    currentUser = userCred.user; updateAuthUI(); closeModal('authModal');
  }catch(e){ alert('Falha no cadastro: '+(e?.message||e)); }
});
qs('btnLogout').addEventListener('click', async ()=>{
  const cfg = getFirebaseConfig();
  if(cfg && window.firebase){ try{ await firebase.auth().signOut(); }catch{} }
  currentUser = { guest:true, displayName:'Convidado' }; updateAuthUI();
});

// ---------- Search with Google CSE ----------
async function doSearch(){
  const q = qs('q').value.trim();
  if(!q){ alert('Digite algo para buscar.'); return; }
  const {key, cx} = getApiConfig();
  hide(qs('player')); hide(qs('playerbar')); hide(qs('hlsPlayer'));
  qs('results').innerHTML = '<div class="card">Carregando…</div>';
  try{
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&num=10`;
    const res = await fetch(url);
    const data = await res.json();
    if(!data.items){
      qs('results').innerHTML = '<div class="card"><b>Nenhum resultado</b><p>Verifique a KEY e o CX.</p></div>';
      return;
    }
    const list = data.items.map(item=>{
      const link = item.link || '#';
      const title = item.title || link;
      const snippet = (item.snippet || '').replace(/\n/g,' ');
      const thumb = item.pagemap?.cse_thumbnail?.[0]?.src || item.pagemap?.cse_image?.[0]?.src || '';
      return `
        <article class="card">
          ${thumb ? `<img src="${thumb}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:12px;margin-bottom:8px"/>` : ''}
          <a href="${link}" data-open="${link}" class="open">${title}</a>
          ${snippet ? `<p>${snippet}</p>` : ''}
        </article>
      `;
    }).join('');
    qs('results').innerHTML = list || '<div class="card">Sem resultados.</div>';
    document.querySelectorAll('a.open').forEach(a=>{
      a.addEventListener('click', (ev)=>{
        ev.preventDefault();
        const href = a.getAttribute('data-open') || a.href;
        openLinkSmart(href, a.textContent || 'Reprodução');
      });
    });
  }catch(e){
    qs('results').innerHTML = `<div class="card"><b>Erro de busca</b><p>${(e && e.message) || 'Falha inesperada.'}</p></div>`;
  }
}

function extractYouTubeId(u){
  try{
    if(u.hostname.replace(/^www\./,'') === 'youtu.be'){ return u.pathname.slice(1); }
    if(u.searchParams.has('v')){ return u.searchParams.get('v'); }
    const m = u.pathname.match(/\/embed\/([\w-]{6,})/i);
    if(m) return m[1];
  }catch{}
  return null;
}
function isM3U8(url){ return /\.m3u8(\?.*)?$/.test(url); }

function openLinkSmart(href, title){
  try{
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./,'');
    const isYouTube = /(^|\.)youtube\.com$/.test(host) || host === 'youtu.be';

    if(isYouTube){
      const vid = extractYouTubeId(u);
      if(vid){
        const src = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0`;
        const iframe = qs('player'); const bar = qs('playerbar');
        qs('playertitle').textContent = title;
        iframe.src = src; show(iframe); bar.style.display='flex'; hide(qs('hlsPlayer')); return;
      }
    }
    if(isM3U8(href)){ return playHls(href, title); }

    // fallback: abre no mesmo webview
    window.location.href = href;
  }catch{
    window.location.href = href;
  }
}
function playHls(src, title){
  hide(qs('player')); show(qs('playerbar')); qs('playertitle').textContent = title;
  const video = qs('hlsPlayer'); show(video);
  if (video.canPlayType('application/vnd.apple.mpegURL')){
    video.src = src; video.play().catch(()=>{});
  } else if(window.Hls && Hls.isSupported()){
    if(window._hls){ window._hls.destroy(); }
    const hls = new Hls(); window._hls = hls;
    hls.loadSource(src); hls.attachMedia(video); hls.on(Hls.Events.MANIFEST_PARSED, ()=> video.play().catch(()=>{}));
  } else {
    alert('Seu navegador não suporta HLS.');
  }
}

qs('doSearch').addEventListener('click', doSearch);
qs('q').addEventListener('keydown', (e)=>{ if(e.key==='Enter') doSearch(); });
qs('closePlayer').addEventListener('click', (e)=>{
  e.preventDefault();
  qs('player').src = 'about:blank'; hide(qs('player')); hide(qs('playerbar'));
  const v = qs('hlsPlayer'); v.pause(); v.removeAttribute('src'); v.load(); hide(v);
});

// Quick nav presets
document.querySelectorAll('nav.nav .btn[data-q]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const val = btn.getAttribute('data-q');
    qs('q').value = val; doSearch();
  });
});

initAuth();