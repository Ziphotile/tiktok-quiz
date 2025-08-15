
import { useEffect, useState } from 'react';
import { socket } from '../socket';

type Player = { id:string; name:string; score:number; team:'A'|'B' };

export default function HostView(){
  const [code, setCode] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [qText, setQText] = useState('2 + 2 = ?');
  const [opts, setOpts] = useState(['3','4','5','6']);
  const [correctIndex, setCorrectIndex] = useState(1);
  const [inQuestion, setInQuestion] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [teamScores, setTeamScores] = useState<{A:number;B:number}>({A:0,B:0});
  const [category, setCategory] = useState('');

  useEffect(()=>{
    socket.emit('host:createRoom');
    socket.on('host:roomCreated', (d:any)=> setCode(d.code));
    socket.on('room:players', (p:any)=> setPlayers(p));
    socket.on('room:teamScores', (ts:any)=> setTeamScores(ts));
    socket.on('round:start', (v:any)=>{ setInQuestion(v.inQuestion); setSecondsLeft(v.secondsLeft); setTeamScores(v.teamScores); });
    socket.on('round:tick', (s:number)=> setSecondsLeft(s));
    socket.on('round:end', ()=> setInQuestion(false));
    return ()=>{ socket.off(); };
  },[]);

  const startRound = ()=>{
    socket.emit('host:startRound', { id: crypto.randomUUID(), text:qText, options:opts, correctIndex });
  };

  const list = (team:'A'|'B') => players.filter(p=>p.team===team).sort((a,b)=>b.score-a.score);

  const nextFromBank = async()=>{
    const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/next-from-bank/${code}`, {
      method:'POST',
      headers:{ 'x-admin-token': localStorage.getItem('ADMIN_TOKEN')||'', 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: category || undefined })
    });
    if (!res.ok) alert('No question available for that category');
  }

  return (
    <div>
      <h2>Host Dashboard</h2>
      <p>Room code: <strong>{code}</strong></p>
      <p>Team A: {list('A').length}/5 | Team B: {list('B').length}/5</p>
      <p>Team Scores — A: {teamScores.A} | B: {teamScores.B}</p>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div>
          <h4 style={{color:'#00f0ff'}}>Team A</h4>
          <ul>{list('A').map(p=> <li key={p.id}>{p.name}: {p.score}</li>)}</ul>
        </div>
        <div>
          <h4 style={{color:'#ff00aa'}}>Team B</h4>
          <ul>{list('B').map(p=> <li key={p.id}>{p.name}: {p.score}</li>)}</ul>
        </div>
      </div>
      <hr/>
      <h3>Compose Question</h3>
      <input value={qText} onChange={e=>setQText(e.target.value)} style={{width:'100%'}}/>
      {opts.map((o,i)=> (
        <div key={i}>
          <input value={o} onChange={e=>{ const copy=[...opts]; copy[i]=e.target.value; setOpts(copy); }}/>
          <label style={{marginLeft:8}}>
            <input type="radio" name="correct" checked={correctIndex===i} onChange={()=>setCorrectIndex(i)} /> correct
          </label>
        </div>
      ))}
      <div style={{marginTop:8}}>
        <input placeholder="Category (optional)" value={category} onChange={e=>setCategory(e.target.value)} />
      </div>
      <button onClick={startRound} disabled={inQuestion}>Start Round</button>
      <button onClick={nextFromBank} style={{marginLeft:8}} disabled={inQuestion}>Next from Bank</button>
      <button onClick={()=>socket.emit('host:endGame')} style={{marginLeft:8}}>End Game</button>
      {inQuestion && <p>Time left: {secondsLeft}s</p>}
    </div>
  );
}
