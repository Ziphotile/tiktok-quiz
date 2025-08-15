
import { useState, useEffect } from 'react';

export default function AdminView(){
  const [code, setCode] = useState('');
  const [file, setFile] = useState<File|null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const api = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('ADMIN_TOKEN') || '';

  async function upload(){
    if(!file||!code) return alert('Pick file & code');
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(`${api}/admin/upload-questions/${code}`, { method:'POST', headers:{ 'x-admin-token': token }, body: fd });
    alert(await res.text());
  }

  async function fetchRoster(){
    const codeVal = code.trim(); if (!codeVal) return;
    const res = await fetch(`${api}/state/${codeVal}`);
    if (res.ok) { const data = await res.json(); setRoster(data?.roster||[]); }
  }

  async function swap(a:string,b:string){
    const res = await fetch(`${api}/admin/swap/${code}`, { method:'POST', headers:{'x-admin-token': token,'Content-Type':'application/json'}, body: JSON.stringify({fromId:a, toId:b}) });
    if (res.ok) { const data = await res.json(); setRoster(data.roster||[]); } else alert('Swap failed');
  }

  useEffect(()=>{ const t=setInterval(fetchRoster, 3000); return ()=>clearInterval(t); },[code]);

  return (
    <div>
      <h2>Admin</h2>
      <input placeholder="Room code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} />
      <input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} style={{marginLeft:8}}/>
      <button onClick={upload} style={{marginLeft:8}}>Upload CSV</button>
      <div style={{marginTop:12}}>
        <button onClick={()=>localStorage.setItem('ADMIN_TOKEN', prompt('Set admin token')||'')}>Set Admin Token</button>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16}}>
        <div>
          <h3 style={{color:'#00f0ff'}}>Team A</h3>
          {roster.filter(r=>r.team==='A').map(r=> <div key={r.id}>{r.name} — {r.score}</div>)}
        </div>
        <div>
          <h3 style={{color:'#ff00aa'}}>Team B</h3>
          {roster.filter(r=>r.team==='B').map(r=> <div key={r.id}>{r.score} — {r.name}</div>)}
        </div>
      </div>
      <div style={{marginTop:8}}>
        <input placeholder="PlayerId A" id="pidA"/>
        <input placeholder="PlayerId B" id="pidB" style={{marginLeft:8}}/>
        <button onClick={()=>{
          const a=(document.getElementById('pidA') as HTMLInputElement).value;
          const b=(document.getElementById('pidB') as HTMLInputElement).value;
          swap(a,b);
        }} style={{marginLeft:8}}>Swap</button>
      </div>
    </div>
  );
}
