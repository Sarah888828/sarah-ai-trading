import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const instruments = readFile(join(root,'master.json'),'utf8').then(text=>new Map(JSON.parse(text).map(item=>[item.code,item.kind])));
let appKey = process.env.NHPLUG_APP_KEY;
let appSecret = process.env.NHPLUG_APP_SECRET;
const base = 'https://api.nhplug.com:8443';
let token, expiresAt = 0, pending;
let requestQueue=Promise.resolve(), nextRequestAt=0;
function pacedRequest(fn) {
  const run=requestQueue.then(async()=>{const wait=Math.max(0,nextRequestAt-Date.now());if(wait)await new Promise(resolve=>setTimeout(resolve,wait));nextRequestAt=Date.now()+350;return fn()});
  requestQueue=run.catch(()=>{});return run;
}

async function getToken() {
  if (token && Date.now() < expiresAt - 60000) return token;
  if (!appKey || !appSecret) throw new Error('API 키가 설정되지 않았습니다. start.mjs를 실행하세요.');
  if (pending) return pending;
  pending = (async () => {
    const url = new URL('/oauth2/token', base);
    url.search = new URLSearchParams({appkey: appKey, appsecretkey: appSecret, grant_type: 'client_credentials', scope: 'oob'});
    const res = await fetch(url, {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, signal:AbortSignal.timeout(15000)});
    if (!res.ok) { const data=await res.json().catch(()=>({})); const code=String(data.error_code || data.rsp_cd || data.error || '').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,40); throw new Error(`나무 인증에 실패했습니다 (HTTP ${res.status}${code ? `, ${code}` : ''}).`); }
    const body = await res.json();
    if (!body.access_token || !Number.isFinite(Number(body.expires_in))) throw new Error('인증 응답을 확인할 수 없습니다.');
    token = body.access_token; expiresAt = Date.now() + Number(body.expires_in) * 1000;
    return token;
  })();
  try { return await pending; } finally { pending = null; }
}

async function query(path, input, retry = true) {
  const accessToken = await getToken();
  const res = await pacedRequest(()=>fetch(base + path, {method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${accessToken}`}, body:JSON.stringify({Input_0:input}), signal:AbortSignal.timeout(15000)}));
  if (res.status === 401 && retry) { token = null; return query(path, input, false); }
  if (!res.ok) throw new Error(`나무 시세 서버 오류 (${res.status})`);
  const result = await res.json();
  if (!result.Output_0) throw new Error('시세 응답이 없거나 조회가 거부되었습니다.');
  return result.Output_0;
}
const number = value => { if (value === null || value === undefined || String(value).trim() === '') return null; const n=Number(String(value).replaceAll(',','')); return Number.isFinite(n) ? n : null; };
const date = value => { const s=String(value||'').trim(); if(/^\d{8}$/.test(s))return s; const m=s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/); if(!m)return ''; const year=Number(m[1]); return `${year<=69?'20':'19'}${m[1]}${m[2]}${m[3]}`; };
async function quoteOnly(code) {
  const kind=(await instruments).get(code);
  if(!kind)throw new Error('종목마스터에 없는 코드입니다.');
  const isFund=kind==='ETF'||kind==='ETN';
  const quote=isFund ? await query('/krstock/quote/v1/etfCurrent',{iem_cd:code}) : await query('/krstock/quote/v1/currentPrice',{market_cd:'KRX',iem_cd:code});
  const price=number(quote.stck_prpr), previous=number(isFund?quote.prdy_clpr:quote.stck_prdy_clpr);
  if(price===null||price<=0||previous===null||previous<=0)throw new Error('유효한 현재가가 없습니다.');
  return {code,price,change:(price-previous)/previous*100,receivedAt:new Date().toISOString()};
}
async function dollarRate() {
  const q=await query('/gbstock/quote/v1/current',{iem_cd:'AAPL'});
  const rate=number(q.currency_prc);
  if(String(q.currency_unit||'').trim()!=='USD'||rate===null||rate<=0) throw new Error('유효한 환율이 없습니다.');
  return {currency:'USD',rate,receivedAt:new Date().toISOString(),source:'해외주식 AAPL 시세의 환율 필드'};
}
async function marketIndex(symbol) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('-','');
  const q=await query('/gbstock/quote/v1/symbolIndexFxPeriod',{iem_cd:symbol,end_dt:today,array_cnt:'2',maxavg:'',gubun:'1',xtick:'',today_cls:'0',scale_change:''});
  const price=number(q.ovrs_prpr),previous=number(q.prdy_clpr);
  if(String(q.iem_cd||'').trim()!==symbol||price===null||price<=0||previous===null||previous<=0)throw new Error('유효한 지수 데이터가 없습니다.');
  return {symbol,name:String(q.iem_nm||symbol),price,change:(price-previous)/previous*100,receivedAt:new Date().toISOString()};
}
async function market(code) {
  const kind=(await instruments).get(code),isFund=kind==='ETF'||kind==='ETN';
  const quote = isFund ? await query('/krstock/quote/v1/etfCurrent',{iem_cd:code}) : await query('/krstock/quote/v1/currentPrice', {market_cd:'KRX', iem_cd:code});
  const daily = await query('/krstock/quote/v1/currentDaily', {market_cd:'KRX', iem_cd:code, array_cnt:'100', view_main_yn:'Y'});
  if (!Array.isArray(daily)) throw new Error('일봉 데이터를 확인할 수 없습니다.');
  const bars = daily.map(x => ({date:date(x.bsop_date), open:number(x.stck_oprc), high:number(x.stck_hgpr), low:number(x.stck_lwpr), close:number(x.stck_clpr)})).filter(x => /^\d{8}$/.test(x.date) && [x.open,x.high,x.low,x.close].every(n => n !== null && n > 0)).sort((a,b)=>a.date.localeCompare(b.date));
  const price = number(quote.stck_prpr), previousClose = number(isFund?quote.prdy_clpr:quote.stck_prdy_clpr);
  const change = price !== null && previousClose !== null && previousClose > 0 ? (price - previousClose) / previousClose * 100 : null;
  if (price === null || price <= 0 || change === null || !bars.length) { const sample=daily.find(x=>x.bsop_date) || {}; const checks=['stck_oprc','stck_hgpr','stck_lwpr','stck_clpr'].map(k=>`${k}:${number(sample[k])!==null && number(sample[k])>0}`); throw new Error(`유효한 현재가 또는 일봉이 없습니다. (현재가:${price !== null && price > 0}, 등락률:${change !== null}, 일봉:${bars.length}/${daily.length}, 날짜형식:${String(sample.bsop_date||'').replace(/[0-9]/g,'9').slice(0,30)}, 수치:${checks.join('|')})`); }
  return {code, name:String(quote.iem_nm || ''), price, change, bars, receivedAt:new Date().toISOString()};
}
const types = {'/':'text/html; charset=utf-8','/app.js':'text/javascript; charset=utf-8','/master.json':'application/json; charset=utf-8'};
const server = http.createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  const host = req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost):8766$/.test(host) || req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403); res.end(); return; }
  const url = new URL(req.url, 'http://127.0.0.1:8766');
  if (url.pathname === '/api/setup' && req.method === 'POST') {
    if (req.headers.origin !== `http://${host}` || req.headers['content-type'] !== 'application/json') { res.writeHead(403); res.end(); return; }
    let body = ''; for await (const part of req) { body += part; if (body.length > 4096) { res.writeHead(413); res.end(); return; } }
    try {
      const data=JSON.parse(body);
      if (typeof data.key !== 'string' || typeof data.secret !== 'string' || !data.key.trim() || !data.secret.trim()) throw new Error('invalid');
      appKey=data.key.trim(); appSecret=data.secret.trim(); token=null; expiresAt=0;
      res.writeHead(204); res.end();
    } catch { res.writeHead(400); res.end(); }
    return;
  }
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  if (url.pathname === '/api/status') { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({configured:Boolean(appKey && appSecret)})); return; }
  if (url.pathname === '/api/fx') {
    try { const data=await dollarRate();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data)); }
    catch {res.writeHead(502,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'환율을 조회할 수 없습니다.'}));}return;
  }
  if (url.pathname === '/api/index') {
    const symbol=url.searchParams.get('symbol')||'.DJI';if(!['.DJI','.SPX','.KS11','.KQ11'].includes(symbol)){res.writeHead(400);res.end();return;}
    try { const data=await marketIndex(symbol);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data)); }
    catch {res.writeHead(502,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'지수를 조회할 수 없습니다.'}));}return;
  }
  if (url.pathname === '/api/stock' || url.pathname === '/api/quote') {
    if (!/^[0-9A-Z]{6}$/.test(url.searchParams.get('code') || '')) { res.writeHead(400); res.end(); return; }
    try { const data = await (url.pathname === '/api/quote' ? quoteOnly(url.searchParams.get('code')) : market(url.searchParams.get('code'))); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); }
    catch (err) { res.writeHead(502,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify({error:err.message.startsWith('나무') || err.message.startsWith('API ') || err.message.startsWith('시세 ') || err.message.startsWith('일봉 ') || err.message.startsWith('유효한 ') ? err.message : '시세 서버에 연결할 수 없습니다.'})); }
    return;
  }
  if (!types[url.pathname]) { res.writeHead(404); res.end(); return; }
  try { const file = await readFile(join(root,url.pathname === '/' ? 'index.html' : url.pathname.slice(1))); res.writeHead(200,{'Content-Type':types[url.pathname]}); res.end(file); }
  catch { res.writeHead(500); res.end(); }
});
server.on('error',()=>{ try { writeFileSync(join(root,'.startup-status.json'),JSON.stringify({stage:'server_listen_failed',updatedAt:new Date().toISOString()})); } catch {} });
server.listen(8766,'127.0.0.1',()=>{ try { writeFileSync(join(root,'.startup-status.json'),JSON.stringify({stage:'server_listening',updatedAt:new Date().toISOString()})); } catch {} console.log('Market Studio: http://127.0.0.1:8766/'); });
