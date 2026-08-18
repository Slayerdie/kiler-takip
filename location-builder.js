(()=>{
  const $=s=>document.querySelector(s);
  const normalise=s=>String(s||'').trim();
  const joinParts=parts=>parts.map(normalise).filter(Boolean).join(' > ');

  function buildUI(){
    const nameField=$('#locationName');
    if(!nameField||$('#locationBuilder')) return;
    const fieldLabel=nameField.closest('.field');
    if(!fieldLabel) return;

    const wrap=document.createElement('section');
    wrap.id='locationBuilder';
    wrap.className='location-builder';
    wrap.innerHTML=`
      <div class="location-builder-head">
        <div><strong>Konumu oluştur</strong><small>Dolap, raf ve kutu bilgilerini seç. Konum adı otomatik hazırlanır.</small></div>
      </div>
      <div class="location-builder-grid">
        <label class="mini-field"><span>Ana alan</span><select id="locArea"><option value="Kiler">Kiler</option><option value="Mutfak">Mutfak</option><option value="Balkon">Balkon</option><option value="Garaj">Garaj</option><option value="Depo">Depo</option><option value="">Diğer</option></select></label>
        <label class="mini-field"><span>Dolap / bölüm</span><input id="locSection" placeholder="Örn. Sağ dolap" maxlength="40"></label>
        <label class="mini-field"><span>Raf</span><input id="locShelf" placeholder="Örn. Raf 2" maxlength="30"></label>
        <label class="mini-field"><span>Kutu / kasa</span><input id="locBox" placeholder="Örn. Mavi kasa" maxlength="40"></label>
      </div>
      <div class="location-builder-preview"><b>Oluşacak konum</b><span id="locPreview">Kiler</span></div>`;
    fieldLabel.parentNode.insertBefore(wrap,fieldLabel);
    nameField.classList.add('location-name-generated');
    nameField.placeholder='Otomatik oluşturulur; istersen elle düzenleyebilirsin';

    ['locArea','locSection','locShelf','locBox'].forEach(id=>$('#'+id)?.addEventListener('input',()=>syncName(true)));
    nameField.addEventListener('input',()=>{$('#locPreview').textContent=nameField.value.trim()||'—'});
  }

  function syncName(force=false){
    const name=$('#locationName'); if(!name) return;
    const area=$('#locArea')?.value||'';
    const section=$('#locSection')?.value||'';
    const shelf=$('#locShelf')?.value||'';
    const box=$('#locBox')?.value||'';
    const built=joinParts([area,section,shelf,box]);
    if(force||!name.value.trim()) name.value=built;
    const preview=$('#locPreview'); if(preview) preview.textContent=name.value.trim()||built||'—';
  }

  function fillFromExisting(){
    buildUI();
    const name=$('#locationName'); if(!name) return;
    const value=name.value.trim();
    if(!value){
      $('#locArea').value='Kiler'; $('#locSection').value=''; $('#locShelf').value=''; $('#locBox').value=''; syncName(true); return;
    }
    const parts=value.split('>').map(x=>x.trim()).filter(Boolean);
    const known=['Kiler','Mutfak','Balkon','Garaj','Depo'];
    $('#locArea').value=known.includes(parts[0])?parts[0]:'';
    $('#locSection').value=parts[1]||'';
    $('#locShelf').value=parts[2]||'';
    $('#locBox').value=parts.slice(3).join(' > ')||'';
    $('#locPreview').textContent=value;
  }

  document.addEventListener('DOMContentLoaded',()=>{
    buildUI();
    const dlg=$('#locationDialog');
    if(dlg) dlg.addEventListener('toggle',()=>{if(dlg.open) setTimeout(fillFromExisting,0)});
    // Safari dialog does not always emit toggle consistently; watch the open attribute as a fallback.
    if(dlg){
      new MutationObserver(()=>{if(dlg.hasAttribute('open')) setTimeout(fillFromExisting,0)}).observe(dlg,{attributes:true,attributeFilter:['open']});
    }
  });
})();
