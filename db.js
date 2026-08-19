const KilerDB = (() => {
  const USE_LOCAL = location.hostname.endsWith('github.io') || location.protocol === 'file:';
  const DB_NAME = 'kiler-takip-db';
  const DB_VERSION = 1;
  let dbPromise;
  let opened = false;

  function localOpen(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('items')) db.createObjectStore('items',{keyPath:'id'});
        if(!db.objectStoreNames.contains('locations')) db.createObjectStore('locations',{keyPath:'id'});
        if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings',{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    return dbPromise;
  }

  async function remoteRequest(path, options={}, retried=false){
    const res = await fetch('/api'+path, {
      cache:'no-store',
      credentials:'same-origin',
      headers:{'Content-Type':'application/json', ...(options.headers||{})},
      ...options
    });
    if(res.status===401 && !retried && window.KilerAuth?.requireLogin){
      await window.KilerAuth.requireLogin();
      return remoteRequest(path, options, true);
    }
    if(res.status===404) return undefined;
    if(!res.ok) throw new Error(`Kiler sunucu hatası (${res.status})`);
    if(res.status===204) return undefined;
    return res.json();
  }

  async function open(){
    if(USE_LOCAL) return localOpen();
    if(opened) return true;
    if(window.KilerAuth?.ready) await window.KilerAuth.ready;
    const health = await remoteRequest('/health');
    if(!health?.ok) throw new Error('Kiler sunucusuna ulaşılamıyor.');
    opened = true;
    return true;
  }

  async function all(store){
    await open();
    if(!USE_LOCAL) return (await remoteRequest('/'+encodeURIComponent(store))) || [];
    const db=await localOpen();
    return new Promise((res,rej)=>{const tx=db.transaction(store,'readonly');const r=tx.objectStore(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});
  }

  async function get(store,key){
    await open();
    if(!USE_LOCAL) return remoteRequest('/'+encodeURIComponent(store)+'/'+encodeURIComponent(key));
    const db=await localOpen();
    return new Promise((res,rej)=>{const tx=db.transaction(store,'readonly');const r=tx.objectStore(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  }

  async function put(store,value){
    await open();
    if(!USE_LOCAL){
      const key = store==='settings' ? value?.key : value?.id;
      if(!key) throw new Error('Kayıt anahtarı eksik.');
      return remoteRequest('/'+encodeURIComponent(store)+'/'+encodeURIComponent(key), {method:'PUT', body:JSON.stringify(value)});
    }
    const db=await localOpen();
    return new Promise((res,rej)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>res(value);tx.onerror=()=>rej(tx.error);});
  }

  async function remove(store,key){
    await open();
    if(!USE_LOCAL) return remoteRequest('/'+encodeURIComponent(store)+'/'+encodeURIComponent(key), {method:'DELETE'});
    const db=await localOpen();
    return new Promise((res,rej)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});
  }

  async function clear(store){
    await open();
    if(!USE_LOCAL) return remoteRequest('/'+encodeURIComponent(store), {method:'DELETE'});
    const db=await localOpen();
    return new Promise((res,rej)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});
  }

  function mode(){ return USE_LOCAL ? 'local' : 'server'; }
  return {open,all,get,put,remove,clear,mode};
})();
