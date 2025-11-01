#!/usr/bin/env node
require('dotenv').config();
const http = require('http');
const PORT = process.env.PORT || 3001;
const API_BASE = `http://127.0.0.1:${PORT}`;

function httpGet(path){
  const url = new URL(path, API_BASE);
  const opts = { method:'GET', hostname:url.hostname, port:url.port, path:url.pathname+url.search, headers:{'Accept':'application/json','Cache-Control':'no-cache'}, timeout:20000 };
  return new Promise((resolve,reject)=>{
    const req = http.request(opts, res=>{
      let raw='';
      res.on('data',d=>raw+=d);
      res.on('end',()=>{
        try{ resolve({status:res.statusCode, json: raw? JSON.parse(raw): null}); }
        catch(e){ reject(new Error('Invalid JSON: '+e.message+'\n'+raw)); }
      });
    });
    req.on('error',reject);
    req.on('timeout',()=>{ req.destroy(new Error('timeout')); });
    req.end();
  });
}

(async()=>{
  function assertArray(name, resp){
    if(resp.status!==200 || !Array.isArray(resp.json)){
      console.error(name+': unexpected response', resp.status, resp.json);
      process.exit(2);
    }
    if(resp.json.length===0){
      console.error(name+': empty result');
      process.exit(3);
    }
    console.log(name+': OK ('+resp.json.length+' items)');
  }
  try{
    const a = await httpGet('/api/recommendations/trending?limit=10');
    assertArray('trending', a);
    const b = await httpGet('/api/recommendations/discover?mood=calm&limit=10');
    assertArray('discover:calm', b);
    const c = await httpGet('/api/recommendations/discover?mood=positive&limit=10');
    assertArray('discover:positive', c);
    console.log('SMOKE OK ✅');
    process.exit(0);
  }catch(e){
    console.error('Smoke test error:', e && e.message);
    process.exit(1);
  }
})();
