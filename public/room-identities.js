/* Device-local reconnect credentials. Never put these records in public room state. */
(function(root, factory) {
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.createRoomIdentityStore=factory;
})(typeof window==='object'?window:this, function(storage) {
  const valid=value=>value&&typeof value.code==='string'&&/^[A-Z0-9]{6}$/.test(value.code)&&typeof value.playerToken==='string'&&value.playerToken.length>0;
  const read=key=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
  const write=(key,value)=>{try{storage.setItem(key,JSON.stringify(value));}catch{}};
  const legacy=()=>{const v=read('tabletopIdentity')||read('camelIdentity');return valid(v)?v:null;};
  function load(code){const saved=read(`tabletop.room.${code}`);if(valid(saved)&&saved.code===code)return saved;const old=legacy();return old?.code===code?old:null;}
  // Migrate the current seat before another room can replace the legacy entry.
  const previous=legacy();if(previous)write(`tabletop.room.${previous.code}`,previous);
  return {
    load,
    latest:legacy,
    save(value){if(!valid(value))return;const record={code:value.code,playerToken:value.playerToken};write(`tabletop.room.${record.code}`,record);write('tabletopIdentity',record);}
  };
});
