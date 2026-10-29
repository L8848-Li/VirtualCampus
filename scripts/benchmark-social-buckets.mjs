// Exploratory peer-filter benchmark. It does not run full social resolution.
// Every batch checks candidate lists and deterministic pair choices for equality.
import { World } from '../src/engine.ts';
import { isPrivateDorm } from '../src/core/campusLife.ts';
import { performance } from 'node:perf_hooks';
const world = new World(0);
while (world.tick < 168) world.step();
function scenario(size) {
  const order = Array.from({length: size}, (_, id) => ({
    id, loc: world.npcs[id % world.npcs.length].loc,
    intent: world.npcs[id % world.npcs.length].intent,
  }));
  const rooms = order.map(a => isPrivateDorm(a.loc) ? Math.floor(a.id / 2) : 0);
  return {order, rooms};
}
function peersOld(order, rooms) {
  const paired = new Set(), pairs = [], trace = [];
  for (const a of order) {
    if (paired.has(a.id) || a.intent?.kind === 'delivery_pickup') continue;
    const peers = order.filter(b => b.id !== a.id && !paired.has(b.id) && b.intent?.kind !== 'delivery_pickup' && b.loc === a.loc && (!isPrivateDorm(a.loc) || rooms[a.id] === rooms[b.id]));
    trace.push(peers.map(b=>b.id).join(','));
    if (peers.length) { const b=peers[0]; paired.add(a.id); paired.add(b.id); pairs.push([a.id,b.id]); }
  }
  return JSON.stringify([trace,pairs]);
}
function peersBucket(order, rooms) {
  const paired = new Set(), pairs = [], trace = [], buckets = new Map();
  const key = a => isPrivateDorm(a.loc) ? `${a.loc}:${rooms[a.id]}` : `${a.loc}`;
  for (const a of order) { const k=key(a); let bucket=buckets.get(k); if (!bucket) buckets.set(k,bucket=[]); bucket.push(a); }
  for (const a of order) {
    if (paired.has(a.id) || a.intent?.kind === 'delivery_pickup') continue;
    const peers = buckets.get(key(a)).filter(b => b.id !== a.id && !paired.has(b.id) && b.intent?.kind !== 'delivery_pickup');
    trace.push(peers.map(b=>b.id).join(','));
    if (peers.length) { const b=peers[0]; paired.add(a.id); paired.add(b.id); pairs.push([a.id,b.id]); }
  }
  return JSON.stringify([trace,pairs]);
}
for (const [size, repeats] of [[12,1000],[120,50],[1200,2]]) {
  const {order,rooms}=scenario(size), old=peersOld(order,rooms), bucket=peersBucket(order,rooms);
  if(old!==bucket) throw Error(`peer mismatch ${size}`);
  const timings={old:[],bucket:[]};
  for (let round=0;round<35;round++) for (const [name,fn] of round%2 ? [['bucket',peersBucket],['old',peersOld]] : [['old',peersOld],['bucket',peersBucket]]) {
    const start=performance.now();
    for(let i=0;i<repeats;i++) if(fn(order,rooms)!==old) throw Error('peer mismatch');
    if(round>=5) timings[name].push(performance.now()-start);
  }
  console.log(JSON.stringify({size,repeats,events:world.events.length,timings}));
}
