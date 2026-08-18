const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const APP_VERSION='1.0.0';
let state={items:[],locations:[],view:'all',sort:'az',member:'Emre',detailId:null,pendingPhoto:'',pendingLocationPhoto:''};

const catIcon=c=>({'Eşya':'📦','Yiyecek':'🍝','İçecek':'🥤','Temizlik':'🧴','Kişisel bakım':'🧼','Alet / Malzeme':'🧰','Diğer':'🧺'}[c]||'📦');
const uid=p=>(p||'id')+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]));
const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
function daysLeft(s){if(!s)return null;const d=new Date(s+'T00:00:00');return Math.ceil((d-today())/86400000)}
function expiryState(s){const d=daysLeft(s);if(d===null)return null;if(d<0)return {kind:'danger',text:`${Math.abs(d)} gün geçmiş`};if(d===0)return {kind:'danger',text:'Bugün son gün'};if(d<=7)return {kind:'danger',text:`${d} gün kaldı`};if(d<=30)return {kind:'warn',text:`${d} gün kaldı`};return {kind:'ok',text:`${d} gün kaldı`}}
function dateTR(s){if(!s)return '—';return new Intl.DateTimeFormat('tr-TR').format(new Date(s+'T00:00:00'))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2200)}
function showInfo(html){$('#infoContent').innerHTML=html;$('#infoDialog').showModal()}

async function imageToDataUrl(file,max=1500,quality=.78){
  if(!file)return '';
  const raw=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=raw});
  let {width,height}=img;const scale=Math.min(1,max/Math.max(width,height));width=Math.round(width*scale);height=Math.round(height*scale);
  const c=document.createElement('canvas');c.width=width;c.height=height;c.getContext('2d').drawImage(img,0,0,width,height);return c.toDataURL('image/jpeg',quality);
}

async function load(){
  await KilerDB.open();
  state.items=await KilerDB.all('items');state.locations=await KilerDB.all('locations');
  const member=await KilerDB.get('settings','member');if(member?.value)state.member=member.value;
  $('#memberBtn').textContent='👤 '+state.member;$('#itemOwner').value=state.member;
  seedDefaultLocationIfNeeded();
  handleQrDeepLink();
  render();
}
async function seedDefaultLocationIfNeeded(){if(state.locations.length)return;const loc={id:uid('loc'),name:'Kiler > Genel',code:'K001',notes:'',photo:'',createdAt:Date.now(),updatedAt:Date.now()};await KilerDB.put('locations',loc);state.locations=[loc]}

function activeItems(){return state.items.filter(x=>x.status!=='used')}
function render(){renderStats();renderLocationOptions();renderItems();renderNav()}
function renderStats(){const a=activeItems();$('#statTotal').textContent=a.length;$('#statSoon').textContent=a.filter(x=>{const d=daysLeft(x.expiry);return d!==null&&d>=0&&d<=30}).length;$('#statExpired').textContent=a.filter(x=>{const d=daysLeft(x.expiry);return d!==null&&d<0}).length;$('#statLocations').textContent=state.locations.length}
function renderNav(){ $$('.nav-btn').forEach(b=>b.classList.toggle('active',(state.view==='locations'&&b.dataset.nav==='locations')||(['soon','expired'].includes(state.view)&&b.dataset.nav==='expiry')||(!['locations','soon','expired'].includes(state.view)&&b.dataset.nav==='home')))}
function renderLocationOptions(){const sel=$('#itemLocation');const cur=sel.value;sel.innerHTML='<option value="">Konum seç…</option>'+state.locations.sort((a,b)=>a.name.localeCompare(b.name,'tr')).map(l=>`<option value="${esc(l.id)}">${esc(l.name)} · ${esc(l.code||'')}</option>`).join('');if(cur&&state.locations.some(l=>l.id===cur))sel.value=cur}
function filteredItems(){
  const q=$('#searchInput').value.trim().toLocaleLowerCase('tr');let arr=activeItems().filter(x=>{const loc=state.locations.find(l=>l.id===x.locationId);const hay=[x.name,x.category,x.quantity,x.notes,loc?.name,loc?.code].join(' ').toLocaleLowerCase('tr');return !q||hay.includes(q)});
  if(state.view==='soon')arr=arr.filter(x=>{const d=daysLeft(x.expiry);return d!==null&&d>=0&&d<=30});
  if(state.view==='expired')arr=arr.filter(x=>{const d=daysLeft(x.expiry);return d!==null&&d<0});
  if(state.sort==='az')arr.sort((a,b)=>a.name.localeCompare(b.name,'tr')); else arr.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));return arr;
}
function renderItems(){
  if(state.view==='locations'){renderLocations();return}
  const titles={all:'Tüm eşyalar',soon:'Tarihi yaklaşanlar',expired:'Tarihi geçenler'};$('#viewTitle').textContent=titles[state.view]||'Tüm eşyalar';$('#sortBtn').classList.remove('hidden');
  const arr=filteredItems();const root=$('#itemList');root.className='item-list';$('#emptyState').classList.toggle('hidden',arr.length>0);root.innerHTML=arr.map(x=>{const loc=state.locations.find(l=>l.id===x.locationId);const ex=expiryState(x.expiry);return `<article class="item-card" data-id="${x.id}">${x.photo?`<img class="item-photo" src="${x.photo}" alt="">`:`<div class="item-photo-fallback">${catIcon(x.category)}</div>`}<div class="item-main"><h3>${esc(x.name)}</h3><div class="item-meta">${esc(x.quantity||x.category||'Eşya')}<br>📍 ${esc(loc?.name||'Konum yok')}</div><div class="tag-row">${x.expiry?`<span class="tag ${ex.kind}">${ex.text}</span>`:''}<span class="tag">${esc(x.owner||'')}</span></div></div><div class="chevron">›</div></article>`}).join('');
  $$('.item-card').forEach(el=>el.onclick=()=>openDetail(el.dataset.id));
}
function renderLocations(){
  $('#viewTitle').textContent='Konumlar';$('#sortBtn').classList.add('hidden');$('#emptyState').classList.add('hidden');const root=$('#itemList');root.className='location-list';
  root.innerHTML=`<button class="secondary-btn full" id="addLocationInline">＋ Yeni konum ekle</button>`+state.locations.sort((a,b)=>a.name.localeCompare(b.name,'tr')).map(l=>{const count=activeItems().filter(x=>x.locationId===l.id).length;return `<button class="location-row" data-id="${l.id}">${l.photo?`<img class="location-thumb" src="${l.photo}" alt="">`:`<div class="location-fallback">📍</div>`}<div><h3>${esc(l.name)}</h3><small>${esc(l.code||'KOD YOK')} · ${count} eşya</small></div><span class="chevron">›</span></button>`}).join('');
  $('#addLocationInline').onclick=()=>openLocation();$$('.location-row').forEach(el=>el.onclick=()=>openLocation(el.dataset.id));
}

function setView(v){state.view=v;render();window.scrollTo({top:0,behavior:'smooth'})}
function openItem(id=''){
  $('#itemForm').reset();$('#itemId').value='';state.pendingPhoto='';$('#itemPhotoPreview').classList.add('hidden');$('#itemPhotoPlaceholder').classList.remove('hidden');$('#deleteItemBtn').classList.add('hidden');$('#itemDialogEyebrow').textContent='YENİ KAYIT';$('#itemDialogTitle').textContent='Eşya ekle';$('#itemOwner').value=state.member;renderLocationOptions();
  if(id){const x=state.items.find(i=>i.id===id);if(!x)return;$('#itemId').value=x.id;$('#itemName').value=x.name;$('#itemCategory').value=x.category;$('#itemQuantity').value=x.quantity||'';$('#itemLocation').value=x.locationId||'';$('#itemExpiry').value=x.expiry||'';$('#itemNotes').value=x.notes||'';$('#itemOwner').value=x.owner||state.member;$('#itemStatus').value=x.status||'active';state.pendingPhoto=x.photo||'';if(x.photo){$('#itemPhotoPreview').src=x.photo;$('#itemPhotoPreview').classList.remove('hidden');$('#itemPhotoPlaceholder').classList.add('hidden')}$('#deleteItemBtn').classList.remove('hidden');$('#itemDialogEyebrow').textContent='DÜZENLE';$('#itemDialogTitle').textContent=x.name}
  $('#itemDialog').showModal();
}
async function saveItem(e){
  e.preventDefault();const name=$('#itemName').value.trim(),locationId=$('#itemLocation').value;if(!name||!locationId){toast('Ad ve konum zorunlu.');return}
  const id=$('#itemId').value||uid('item');const old=state.items.find(x=>x.id===id);const x={id,name,category:$('#itemCategory').value,quantity:$('#itemQuantity').value.trim(),locationId,expiry:$('#itemExpiry').value,notes:$('#itemNotes').value.trim(),owner:$('#itemOwner').value,status:$('#itemStatus').value,photo:state.pendingPhoto||old?.photo||'',createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};await KilerDB.put('items',x);state.items=await KilerDB.all('items');$('#itemDialog').close();render();toast(old?'Kayıt güncellendi.':'Eşya kaydedildi.')
}
async function deleteItem(){const id=$('#itemId').value;if(!id)return;if(!confirm('Bu kaydı silmek istediğine emin misin?'))return;await KilerDB.remove('items',id);state.items=await KilerDB.all('items');$('#itemDialog').close();render();toast('Kayıt silindi.')}

function nextLocationCode(){let n=1;const nums=state.locations.map(l=>Number((l.code||'').match(/\d+/)?.[0]||0));if(nums.length)n=Math.max(...nums)+1;return 'K'+String(n).padStart(3,'0')}
function openLocation(id=''){
  $('#locationForm').reset();$('#locationId').value='';state.pendingLocationPhoto='';$('#locationPhotoPreview').classList.add('hidden');$('#locationPhotoPlaceholder').classList.remove('hidden');$('#deleteLocationBtn').classList.add('hidden');$('#locationQrArea').classList.add('hidden');$('#locationDialogTitle').textContent='Yeni konum';$('#locationCode').value=nextLocationCode();
  if(id){const l=state.locations.find(x=>x.id===id);if(!l)return;$('#locationId').value=l.id;$('#locationName').value=l.name;$('#locationCode').value=l.code||'';$('#locationNotes').value=l.notes||'';state.pendingLocationPhoto=l.photo||'';if(l.photo){$('#locationPhotoPreview').src=l.photo;$('#locationPhotoPreview').classList.remove('hidden');$('#locationPhotoPlaceholder').classList.add('hidden')}$('#deleteLocationBtn').classList.remove('hidden');$('#locationDialogTitle').textContent=l.name;setQr(l)}
  $('#locationDialog').showModal();
}
function setQr(l){
  if(!l?.code)return;const base=location.protocol.startsWith('http')?location.origin+location.pathname:'https://KILER-TAKIP-ADRESI/';const target=base+'?loc='+encodeURIComponent(l.code);$('#qrImage').src='https://api.qrserver.com/v1/create-qr-code/?size=300x300&data='+encodeURIComponent(target);$('#locationQrArea').classList.remove('hidden');
}
async function saveLocation(e){
  e.preventDefault();const name=$('#locationName').value.trim();if(!name){toast('Konum adı zorunlu.');return}const id=$('#locationId').value||uid('loc'),old=state.locations.find(l=>l.id===id);let code=$('#locationCode').value.trim().toUpperCase()||nextLocationCode();if(state.locations.some(l=>l.id!==id&&l.code===code)){toast('Bu kısa kod başka bir konumda kullanılıyor.');return}const l={id,name,code,notes:$('#locationNotes').value.trim(),photo:state.pendingLocationPhoto||old?.photo||'',createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};await KilerDB.put('locations',l);state.locations=await KilerDB.all('locations');$('#locationDialog').close();render();toast(old?'Konum güncellendi.':'Konum oluşturuldu.')
}
async function deleteLocation(){const id=$('#locationId').value;if(activeItems().some(x=>x.locationId===id)){toast('Bu konumda kayıtlı eşya var. Önce onları taşı.');return}if(!confirm('Bu konumu silmek istediğine emin misin?'))return;await KilerDB.remove('locations',id);state.locations=await KilerDB.all('locations');$('#locationDialog').close();render();toast('Konum silindi.')}

function openDetail(id){const x=state.items.find(i=>i.id===id);if(!x)return;state.detailId=id;const l=state.locations.find(v=>v.id===x.locationId),ex=expiryState(x.expiry);$('#detailName').textContent=x.name;$('#detailBody').innerHTML=`${x.photo?`<img class="detail-hero" src="${x.photo}" alt="">`:`<div class="detail-fallback">${catIcon(x.category)}</div>`}${ex?`<div class="expiry-box ${ex.kind}">${ex.text} · ${dateTR(x.expiry)}</div>`:''}<div class="detail-grid"><div class="info-tile"><b>Kategori</b>${esc(x.category)}</div><div class="info-tile"><b>Miktar</b>${esc(x.quantity||'—')}</div><div class="info-tile full"><b>Konum</b>📍 ${esc(l?.name||'—')} ${l?.code?`<small>(${esc(l.code)})</small>`:''}</div>${x.notes?`<div class="info-tile full"><b>Not</b>${esc(x.notes)}</div>`:''}<div class="info-tile"><b>Ekleyen</b>${esc(x.owner||'—')}</div><div class="info-tile"><b>Son güncelleme</b>${new Intl.DateTimeFormat('tr-TR').format(new Date(x.updatedAt||x.createdAt))}</div></div>${l?.photo?`<img class="location-image" src="${l.photo}" alt="Konum fotoğrafı">`:''}`;$('#markUsedBtn').textContent=x.status==='used'?'Tekrar aktif et':'Tükendi / Çıkar';$('#detailDialog').showModal()}
async function markUsed(){const x=state.items.find(i=>i.id===state.detailId);if(!x)return;x.status=x.status==='used'?'active':'used';x.updatedAt=Date.now();await KilerDB.put('items',x);state.items=await KilerDB.all('items');$('#detailDialog').close();render();toast(x.status==='used'?'Listeden çıkarıldı.':'Tekrar aktif edildi.')}

async function exportBackup(){const payload={app:'Kiler Takip',version:APP_VERSION,exportedAt:new Date().toISOString(),items:await KilerDB.all('items'),locations:await KilerDB.all('locations'),settings:await KilerDB.all('settings')};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='kiler-takip-yedek-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Yedek dosyası hazırlandı.')}
async function importBackup(file){try{const data=JSON.parse(await file.text());if(data.app!=='Kiler Takip'||!Array.isArray(data.items)||!Array.isArray(data.locations))throw new Error('invalid');if(!confirm('Mevcut kayıtlar silinip bu yedek geri yüklenecek. Devam edilsin mi?'))return;for(const s of ['items','locations','settings'])await KilerDB.clear(s);for(const x of data.items)await KilerDB.put('items',x);for(const x of data.locations)await KilerDB.put('locations',x);for(const x of (data.settings||[]))await KilerDB.put('settings',x);state.items=await KilerDB.all('items');state.locations=await KilerDB.all('locations');render();toast('Yedek geri yüklendi.')}catch{showInfo('<h2>Yedek açılamadı</h2><p>Seçilen dosya Kiler Takip yedeği gibi görünmüyor.</p>')}}
async function addDemo(){if(!state.locations.length)await seedDefaultLocationIfNeeded();const l=state.locations[0],d=new Date();const ds=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};const demos=[{name:'Boş kavanozlar',category:'Eşya',quantity:'8 adet',expiry:''},{name:'Makarna',category:'Yiyecek',quantity:'3 paket',expiry:ds(18)},{name:'Bulaşık makinesi tableti',category:'Temizlik',quantity:'1 kutu',expiry:ds(70)}];for(const v of demos)await KilerDB.put('items',{id:uid('item'),...v,locationId:l.id,notes:'',owner:state.member,status:'active',photo:'',createdAt:Date.now(),updatedAt:Date.now()});state.items=await KilerDB.all('items');$('#moreDialog').close();render();toast('Örnek kayıtlar eklendi.')}

function handleQrDeepLink(){const code=new URLSearchParams(location.search).get('loc');if(!code)return;setTimeout(()=>{const l=state.locations.find(x=>x.code===code);if(l){setView('locations');toast('QR konumu: '+l.name)}},350)}

function wire(){
  $('#heroAddBtn').onclick=$('#emptyAddBtn').onclick=$('#navAddBtn').onclick=()=>openItem();$('#searchInput').oninput=()=>{if(state.view==='locations')state.view='all';render()};$('#sortBtn').onclick=()=>{state.sort=state.sort==='az'?'recent':'az';$('#sortBtn').textContent=state.sort==='az'?'A–Z':'Yeni';render()};$$('.stat').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $$('.nav-btn').forEach(b=>b.onclick=()=>{const n=b.dataset.nav;if(n==='home')setView('all');if(n==='locations')setView('locations');if(n==='expiry')setView('soon');if(n==='more')$('#moreDialog').showModal()});
  $('#filterBtn').onclick=()=>showInfo('<h2>Filtreler</h2><p>V1.0’da hızlı filtreler ana ekrandaki <b>Yaklaşan</b> ve <b>Geçen</b> kutularında. Kategori ve kişiye göre gelişmiş filtreyi V1.1’e ekleyebiliriz.</p>');
  $('#memberBtn').onclick=async()=>{state.member=state.member==='Emre'?'Betül':'Emre';await KilerDB.put('settings',{key:'member',value:state.member});$('#memberBtn').textContent='👤 '+state.member;$('#itemOwner').value=state.member;toast('Aktif kullanıcı: '+state.member)};
  $('#itemForm').onsubmit=saveItem;$('#locationForm').onsubmit=saveLocation;$('#deleteItemBtn').onclick=deleteItem;$('#deleteLocationBtn').onclick=deleteLocation;$('#quickLocationBtn').onclick=()=>openLocation();
  $('#itemPhotoInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;toast('Fotoğraf hazırlanıyor…');state.pendingPhoto=await imageToDataUrl(f);$('#itemPhotoPreview').src=state.pendingPhoto;$('#itemPhotoPreview').classList.remove('hidden');$('#itemPhotoPlaceholder').classList.add('hidden')};
  $('#locationPhotoInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;toast('Fotoğraf hazırlanıyor…');state.pendingLocationPhoto=await imageToDataUrl(f);$('#locationPhotoPreview').src=state.pendingLocationPhoto;$('#locationPhotoPreview').classList.remove('hidden');$('#locationPhotoPlaceholder').classList.add('hidden')};
  $('#detailCloseBtn').onclick=()=>$('#detailDialog').close();$('#editItemBtn').onclick=()=>{$('#detailDialog').close();openItem(state.detailId)};$('#markUsedBtn').onclick=markUsed;$('#moreCloseBtn').onclick=()=>$('#moreDialog').close();$('#infoCloseBtn').onclick=()=>$('#infoDialog').close();
  $('#exportBtn').onclick=exportBackup;$('#importInput').onchange=e=>{const f=e.target.files[0];if(f)importBackup(f);e.target.value=''};$('#demoBtn').onclick=addDemo;
  $('#installHelpBtn').onclick=()=>showInfo('<div class="eyebrow">IPHONE</div><h2>Ana ekrana yükleme</h2><ol><li>Uygulamanın yayınlanmış internet adresini <b>Safari</b> ile aç.</li><li>Alt menüdeki <b>Paylaş</b> simgesine dokun.</li><li><b>Ana Ekrana Ekle</b> seçeneğini seç.</li><li>Adı “Kiler Takip” olarak bırakıp <b>Ekle</b> de.</li></ol><p>Bu proje HTTPS ile yayınlandıktan sonra uygulama simgesi ana ekranda normal uygulama gibi açılacaktır.</p>');
  $('#syncInfoBtn').onclick=()=>showInfo('<div class="eyebrow">AİLE SENKRONİZASYONU</div><h2>Bir sonraki bağlantı</h2><p>Bu V1.0 veriyi güvenli biçimde cihazın içinde saklıyor. Emre ve Betül’ün iki ayrı iPhone’dan aynı kayıtları görmesi için projeyi bir bulut veritabanına bağlayacağız.</p><p>Uygulama yapısı buna hazır: kayıtların <code>items</code> ve <code>locations</code> katmanları ayrıldı. Bulut bağlandıktan sonra ekranları yeniden yazmamız gerekmeyecek.</p>');
  $('#locationCode').oninput=()=>{const id=$('#locationId').value,l=state.locations.find(x=>x.id===id);if(l){setQr({...l,code:$('#locationCode').value.trim().toUpperCase()})}};
}

if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
wire();load().catch(err=>{console.error(err);showInfo('<h2>Uygulama açılamadı</h2><p>Tarayıcı veri deposu başlatılamadı. Safari gizli moddaysa normal sekmede tekrar deneyin.</p>')});
