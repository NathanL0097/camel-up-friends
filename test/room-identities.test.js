const test=require('node:test');
const assert=require('node:assert/strict');
const makeStore=require('../public/room-identities');
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
test('joining another game does not replace an existing room reconnect seat',()=>{
  const storage=memory(),first=makeStore(storage),second=makeStore(storage);
  first.save({code:'ABC123',playerToken:'seat-a'});second.save({code:'XYZ789',playerToken:'seat-b'});
  const reload=makeStore(storage);assert.equal(reload.load('ABC123').playerToken,'seat-a');assert.equal(reload.load('XYZ789').playerToken,'seat-b');assert.equal(reload.load('NEW456'),null);
});
test('legacy current identity migrates before the next room is saved',()=>{
  const storage=memory();storage.setItem('tabletopIdentity',JSON.stringify({code:'OLD123',playerToken:'legacy'}));
  const store=makeStore(storage);store.save({code:'NEW123',playerToken:'new'});assert.equal(makeStore(storage).load('OLD123').playerToken,'legacy');
});
test('corrupted identity entries fail closed and do not crash the lobby',()=>{
  const storage=memory();storage.setItem('tabletopIdentity','{');storage.setItem('tabletop.room.ABC123',JSON.stringify({code:'XYZ789',playerToken:'wrong-room'}));
  const store=makeStore(storage);assert.equal(store.latest(),null);assert.equal(store.load('ABC123'),null);store.save({code:'ABC123',password:'never-store'});assert.equal(store.load('ABC123'),null);
});
