const KilerDB = (() => {
  const DB_NAME = 'kiler-takip-db';
  const DB_VERSION = 1;
  let dbPromise;
  function open(){
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
  async function all(store){const db=await open();return new Promise((res,rej)=>{const tx=db.transaction(store,'readonly');const r=tx.objectStore(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}
  async function get(store,key){const db=await open();return new Promise((res,rej)=>{const tx=db.transaction(store,'readonly');const r=tx.objectStore(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
  async function put(store,value){const db=await open();return new Promise((res,rej)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>res(value);tx.onerror=()=>rej(tx.error);});}
  async function remove(store,key){const db=await open();return new Promise((res,rej)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
  async function clear(store){const db=await open();return new Promise((res,rej)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
  return {open,all,get,put,remove,clear};
})();
