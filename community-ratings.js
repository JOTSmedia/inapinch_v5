// NIP-01 addressable events. Each device can replace its previous rating for
// a stop. Reads and writes start only after a visitor activates a control.
const eventKind=31588;
const relays=['wss://relay.damus.io','wss://nos.lol'];
const perRelayLimit=200;
const windowMs=6500;
const rootKey='in-a-pinch:v5:community-signing-seed';
const receiptKey=topic=>'in-a-pinch:v5:community-receipt:'+topic;
const encoder=new TextEncoder();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const bytes=encoded=>Uint8Array.from(encoded.match(/../g),b=>parseInt(b,16));
const hex64=value=>typeof value==='string' && /^[0-9a-f]{64}$/.test(value);
const seconds=()=>Math.floor(Date.now()/1000);
// A fixed local NIP-01 envelope signed with BIP340's public test key #0.
// Verify this and a tampered copy before using a downloaded signer. The
// example is never submitted to a relay or included in an average.
export function signingTestEvent(){
  return {
    kind:31588,created_at:1700000000,content:'4',
    tags:[['d','iap1-79f2eca6af94b954488dc4a9d2e1358095f00c289c4de191e1da394541df3490']],
    pubkey:'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
    id:'4a234c331a01035b0b654973e7a2e5f96a670648f0292810ba5d443593fe21c6',
    sig:'84d42a526460321fe09656805e60a428cd7b4785bc900da4c434132b4d248e429be7fdc00f9036ede48b4c9c846cf8c6ba7c3acda420cc777887cae1b13d564c'
  };
}
function checkLibrary(lib){
  if(typeof lib.finalizeEvent!=='function' || typeof lib.getPublicKey!=='function' ||
     typeof lib.verifyEvent!=='function' || !lib.verifyEvent(signingTestEvent()) ||
     lib.verifyEvent({...signingTestEvent(),content:'5'}))throw Error('Could not verify signing tools.');
  return lib;
}
let cryptoTools;
async function loadTools(){
  // This pinned browser ESM uses nostr-tools' upstream noble-curves BIP340 implementation.
  if(!cryptoTools){
    let timer;
    const deadline=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Rating tools timed out.')),9000);});
    cryptoTools=Promise.race([deadline,import('https://esm.sh/nostr-tools@2.15.2/pure?bundle')])
      .then(checkLibrary).catch(error=>{cryptoTools=null;throw error;}).finally(()=>clearTimeout(timer));
  }
  return cryptoTools;
}

export async function venueTopic(id,cryptoAPI=globalThis.crypto){
  if(typeof id!=='string' || !id || id.length>512)throw Error('Invalid venue.');
  const hash=await cryptoAPI.subtle.digest('SHA-256',encoder.encode('in-a-pinch:venue:v1:'+id));
  return 'iap1-'+hex(new Uint8Array(hash));
}

function isRating(event,topic,now){
  return event && event.kind===eventKind && hex64(event.pubkey) && hex64(event.id) &&
    typeof event.sig==='string' && /^[a-f0-9]{128}$/.test(event.sig) &&
    Number.isSafeInteger(event.created_at) && event.created_at>0 && event.created_at<=now+120 &&
    typeof event.content==='string' && /^[0-5]$/.test(event.content) &&
    Array.isArray(event.tags) && event.tags.length===1 && Array.isArray(event.tags[0]) &&
    event.tags[0].length===2 && event.tags[0][0]==='d' && event.tags[0][1]===topic;
}
function newer(a,b){
  // NIP-01 uses the lowest event ID if replaceable timestamps are equal.
  return !b || a.created_at>b.created_at || (a.created_at===b.created_at && a.id<b.id);
}
export function collectRatings(events,topic,verify,now=seconds()){
  const latest=new Map(),seen=new Set();
  for(const event of events){
    if(!isRating(event,topic,now) || seen.has(event.id))continue;
    try{if(!verify(event))continue;}catch{continue;}
    seen.add(event.id);
    if(newer(event,latest.get(event.pubkey)))latest.set(event.pubkey,event);
  }
  return latest;
}
export function summarizeRatings(latest){
  let total=0,count=0;
  for(const event of latest.values()){
    const score=Number(event.content);
    if(score>0){total+=score;count++;}
  }
  return {count,average:count?total/count:null};
}

function exchange(url,{topic,event},WS,timeout){
  return new Promise(resolve=>{
    let socket,done=false,received=0;
    const sub='venue-rating',events=[];
    function finish(ok,limited=false){
      if(done)return;
      done=true;clearTimeout(timer);
      if(socket){socket.onopen=null;socket.onmessage=null;socket.onerror=null;socket.onclose=null;
        try{if(!event && socket.readyState===1)socket.send(JSON.stringify(['CLOSE',sub]));socket.close();}catch{}}
      resolve({ok,events,limited});
    }
    const timer=setTimeout(()=>finish(false),timeout);
    try{
      socket=new WS(url);
      socket.onopen=()=>{
        try{socket.send(JSON.stringify(event?['EVENT',event]:['REQ',sub,{kinds:[eventKind],'#d':[topic],limit:perRelayLimit}]));}
        catch{finish(false);}
      };
      socket.onerror=()=>finish(false);socket.onclose=()=>finish(false);
      socket.onmessage=message=>{
        if(done || typeof message.data!=='string' || message.data.length>3600)return;
        let payload;
        try{payload=JSON.parse(message.data);}catch{return;}
        if(!Array.isArray(payload))return;
        const [type,id,value]=payload;
        if(event){
          if(type==='OK' && id===event.id && typeof value==='boolean')finish(value);
          return;
        }
        if(id!==sub)return;
        if(type==='EOSE'){finish(true,received>=perRelayLimit);return;}
        if(type==='CLOSED'){finish(false);return;}
        if(type==='EVENT'){
          if(++received>perRelayLimit){finish(true,true);return;}
          if(isRating(value,topic,seconds()))events.push(value);
        }
      };
    }catch{finish(false);}
  });
}

async function getSeed(storage,cryptoAPI,locks){
  const read=()=>{
    let value=storage.getItem(rootKey);
    if(value===null){
      value=hex(cryptoAPI.getRandomValues(new Uint8Array(32)));
      storage.setItem(rootKey,value);
      value=storage.getItem(rootKey);
    }
    if(!hex64(value))throw Error('Signing identity unavailable.');
    return bytes(value);
  };
  return locks?.request ? locks.request(rootKey,read) : read();
}
function storedReceipt(storage,topic){
  try{
    const data=JSON.parse(storage.getItem(receiptKey(topic)));
    return data && isRating(data,topic,seconds())?data:null;
  }catch{return null;}
}
export function createCommunityClient({WebSocketAPI=globalThis.WebSocket,cryptoAPI=globalThis.crypto,
  storage,locks=globalThis.navigator?.locks,library=loadTools,targets=relays,timeout=windowMs}={}){
  async function read(id){
    const [lib,topic]=await Promise.all([library(),venueTopic(id,cryptoAPI)]);
    const replies=await Promise.all(targets.map(url=>exchange(url,{topic},WebSocketAPI,timeout)));
    const latest=collectRatings(replies.flatMap(reply=>reply.events),topic,lib.verifyEvent);
    const available=replies.filter(reply=>reply.ok).length;
    return {latest,available,total:targets.length,limited:replies.some(reply=>reply.limited)};
  }
  async function publish(id,score){
    if(!Number.isInteger(score) || score<0 || score>5)throw Error('Select 1–5 stars.');
    const [lib,topic]=await Promise.all([library(),venueTopic(id,cryptoAPI)]);
    const store=storage || globalThis.localStorage;
    const seed=await getSeed(store,cryptoAPI,locks);
    // A different public key for each venue keeps this person's ratings at
    // different stops from sharing a publicly searchable author identifier.
    const hmac=await cryptoAPI.subtle.importKey('raw',seed,{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const secret=new Uint8Array(await cryptoAPI.subtle.sign('HMAC',hmac,encoder.encode(topic)));
    async function post(){
      const receipt=storedReceipt(store,topic);
      const last=receipt && receipt.pubkey===lib.getPublicKey(secret) && lib.verifyEvent(receipt)?receipt.created_at:0;
      const now=seconds(),stamp=Math.max(now,last+1);
      if(stamp>now+120)throw Error('Please wait a moment before rating again.');
      const event=lib.finalizeEvent({kind:eventKind,created_at:stamp,tags:[['d',topic]],content:String(score)},secret);
      if(!isRating(event,topic,now) || !lib.verifyEvent(event))throw Error('Signature unavailable.');
      const replies=await Promise.all(targets.map(url=>exchange(url,{event},WebSocketAPI,timeout)));
      const accepted=replies.filter(reply=>reply.ok).length;
      if(accepted){try{store.setItem(receiptKey(topic),JSON.stringify(event));}catch{}}
      return {event,accepted,total:targets.length};
    }
    try{return await (locks?.request ? locks.request(receiptKey(topic),post) : post());}
    finally{secret.fill(0);seed.fill(0);}
  }
  async function previous(id){
    try{
      const topic=await venueTopic(id,cryptoAPI),receipt=storedReceipt(storage || globalThis.localStorage,topic);
      if(!receipt)return null;
      const lib=await library();
      return lib.verifyEvent(receipt)?receipt:null;
    }catch{return null;}
  }
  return {read,publish,previous};
}
