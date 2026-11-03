// Test-only canonical-state writes. Production never imports legacy tokens.
export async function seedSession(page, session, { bump = true, callback, notify = true } = {}) {
  return page.evaluate(async ({ session, bump, callback, notify }) => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('compass-auth-v2', 1); r.onupgradeneeded = () => r.result.createObjectStore('state'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const generation = await new Promise((resolve, reject) => { const tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state'), request = store.get('canonical'); let next; request.onsuccess = () => { const previous = request.result ?? { generation: 0, values: {} }; next = { generation: previous.generation + (bump ? 1 : 0), values: session ? { ...previous.values, 'compass-session-v2': JSON.stringify(session) } : {}, callback }; store.put(next, 'canonical'); }; tx.oncomplete = () => resolve(next.generation); tx.onabort = tx.onerror = () => reject(tx.error); });
    db.close();
    if (notify) { const channel = new BroadcastChannel('compass-auth-v2'); channel.postMessage({ generation }); channel.close(); }
    return generation;
  }, { session, bump, callback, notify });
}
export async function readSession(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('compass-auth-v2'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const state = await new Promise((resolve, reject) => { const r = db.transaction('state').objectStore('state').get('canonical'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); db.close();
    return state?.values['compass-session-v2'] ? JSON.parse(state.values['compass-session-v2']) : null;
  });
}

/** Compatibility bridge for old test fixtures only, never shipped to visitors. */
export async function installAuthFixture(page) {
 await page.evaluateOnNewDocument(() => {
  if (window.fixtureAuth) return;
  const legacy='sb-ctailpmcoyvaplwbwskf-auth-token';
  const channelName='compass-auth-v2';
  const realChannel=window.BroadcastChannel;
  const db=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('compass-auth-v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const write=async(value,bump=true)=>{if(value){const parsed=JSON.parse(value);if(parsed.expires_at===undefined){parsed.expires_at=Math.floor(Date.now()/1000)+(parsed.expires_in??3600);value=JSON.stringify(parsed);}}const database=await db();const generation=await new Promise((resolve,reject)=>{const tx=database.transaction('state','readwrite'),store=tx.objectStore('state'),r=store.get('canonical');let next;r.onsuccess=()=>{const state=r.result??{generation:0,values:{}};next={...state,generation:state.generation+(bump?1:0),values:value?{...state.values,'compass-session-v2':value}:{}};store.put(next,'canonical');};tx.oncomplete=()=>resolve(next.generation);tx.onabort=tx.onerror=()=>reject(tx.error);});database.close();return generation;};
  const read=async()=>{const database=await db();const result=await new Promise((resolve,reject)=>{const r=database.transaction('state').objectStore('state').get('canonical');r.onsuccess=()=>resolve(r.result?.values['compass-session-v2']??null);r.onerror=()=>reject(r.error);});database.close();return result;};
  window.fixtureAuth={
   setItem:async(key,value)=>key===legacy?write(value):localStorage.setItem(key,value),
   getItem:async key=>key===legacy?read():localStorage.getItem(key),
   removeItem:async key=>key===legacy?write(null):localStorage.removeItem(key),
  };
  window.BroadcastChannel=class extends realChannel {
   constructor(name){super(name===legacy?channelName:name);this.isFixture=name===legacy;}
   postMessage(message){if(!this.isFixture)return super.postMessage(message);void write(message.session?JSON.stringify(message.session):null,message.event!=='TOKEN_REFRESHED').then(generation=>{const c=new realChannel(channelName);c.postMessage({generation});c.close();});}
  };
 });
}

export async function fixtureNavigation(page, url) {
 if (url.includes('#type=recovery') && !url.includes('error=')) {
  const session=await readSession(page);
  if (session) {const payload=btoa(JSON.stringify({sub:session.user.id,exp:4000000000})).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');url=url.replace('#type=recovery',`#access_token=eyJhbGciOiJIUzI1NiJ9.${payload}.fake&refresh_token=fixture&type=recovery`);}
 }
 if (url.includes('access_token=')) {
  // Old recovery tests model a newly issued callback. The dedicated controller
  // tests separately exercise missing, used and superseded callback bindings.
  const callback='fixture-issued-link';
  await seedSession(page,null,{callback,notify:false});
  const parsed=new URL(url);parsed.searchParams.set('compassAuth',callback);url=parsed.toString();
 }
 return page.goto(url);
}
