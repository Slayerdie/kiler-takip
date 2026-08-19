(() => {
  const IS_LOCAL = location.hostname.endsWith('github.io') || location.protocol === 'file:';
  let pendingResolve = null;
  let current = null;
  let identityObserver = null;

  function ensureUi(){
    if(document.getElementById('authGate')) return;
    const gate=document.createElement('div');
    gate.id='authGate';
    gate.className='auth-gate hidden';
    gate.innerHTML=`<div class="auth-card">
      <div class="auth-logo">▦</div>
      <h1>Kiler Takip</h1>
      <p>Ev envanterine güvenli erişim</p>
      <form id="authForm" autocomplete="on">
        <label class="auth-field"><span>Kullanıcı adı</span><input id="authUser" name="username" autocomplete="username" placeholder="emre veya betul" required></label>
        <label class="auth-field"><span>Parola</span><input id="authPassword" name="password" type="password" autocomplete="current-password" required></label>
        <button id="authSubmit" class="auth-submit" type="submit">Giriş Yap</button>
        <div id="authError" class="auth-error"></div>
      </form>
      <div class="auth-device">Bu cihazda oturumun güvenli olarak hatırlanır. Çıkış yapmadıkça uygulamayı her açışında tekrar parola istenmez.</div>
    </div>`;
    document.body.appendChild(gate);
    gate.querySelector('#authForm').addEventListener('submit',login);
  }

  function show(){ensureUi();document.getElementById('authGate').classList.remove('hidden');setTimeout(()=>document.getElementById('authUser')?.focus(),100)}
  function hide(){document.getElementById('authGate')?.classList.add('hidden')}

  function applyIdentity(){
    if(!current?.displayName) return;
    const chip=document.getElementById('memberBtn');
    if(chip && chip.textContent !== '👤 '+current.displayName) chip.textContent='👤 '+current.displayName;
    const owner=document.getElementById('itemOwner');
    if(owner){
      if(![...owner.options].some(o=>o.value===current.displayName)) owner.add(new Option(current.displayName,current.displayName));
      owner.value=current.displayName;
      owner.disabled=true;
    }
  }

  function watchIdentity(){
    applyIdentity();
    if(identityObserver) return;
    identityObserver=new MutationObserver(()=>applyIdentity());
    identityObserver.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('submit',e=>{if(e.target?.id==='itemForm')applyIdentity()},true);
  }

  async function check(){
    const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'});
    if(r.ok){const data=await r.json();current=data;watchIdentity();return data}
    current=null;
    return null;
  }

  async function login(e){
    e?.preventDefault();
    const user=document.getElementById('authUser').value.trim();
    const password=document.getElementById('authPassword').value;
    const btn=document.getElementById('authSubmit');
    const err=document.getElementById('authError');
    btn.disabled=true;btn.textContent='Giriş yapılıyor…';err.textContent='';
    try{
      const r=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,password})});
      if(!r.ok){err.textContent='Kullanıcı adı veya parola hatalı.';return}
      current=await r.json();
      document.getElementById('authPassword').value='';
      hide();
      watchIdentity();
      if(pendingResolve){pendingResolve(true);pendingResolve=null}
    }catch(_){err.textContent='Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.'}
    finally{btn.disabled=false;btn.textContent='Giriş Yap'}
  }

  async function requireLogin(){
    if(IS_LOCAL) return true;
    const ok=await check().catch(()=>null);
    if(ok) return true;
    show();
    return new Promise(resolve=>{pendingResolve=resolve});
  }

  async function logout(){
    if(IS_LOCAL) return;
    try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'})}catch(_){ }
    location.reload();
  }

  function addLogoutButton(){
    if(IS_LOCAL) return;
    const menu=document.querySelector('#moreDialog .menu-list');
    if(!menu || document.getElementById('logoutBtn')) return;
    const b=document.createElement('button');
    b.id='logoutBtn';b.className='menu-row auth-logout-row';b.type='button';
    b.innerHTML='<span>↪️</span><div><strong>Çıkış Yap</strong><small>Bu cihazdaki güvenli oturumu kapat</small></div>';
    b.addEventListener('click',logout);
    menu.appendChild(b);
  }

  const ready = IS_LOCAL ? Promise.resolve(true) : new Promise(async resolve=>{
    if(document.readyState==='loading') await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
    ensureUi();
    const ok=await check().catch(()=>null);
    if(ok){hide();resolve(true)}
    else{show();pendingResolve=resolve}
    addLogoutButton();
  });

  window.KilerAuth={ready,requireLogin,logout,get currentUser(){return current}};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{addLogoutButton();watchIdentity()}); else {addLogoutButton();watchIdentity()}
})();
