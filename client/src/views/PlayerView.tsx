
import { useEffect, useState } from 'react';
import { socket } from '../socket';

type Team = 'A'|'B';

export default function PlayerView(){
  const [code, setCode] = useState('');
  const [name, setName] = useState('Player');
  const [joined, setJoined] = useState(false);
  const [question, setQuestion] = useState<any>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [scores, setScores] = useState<any[]>([]);
  const [teamScores, setTeamScores] = useState<{A:number;B:number}>({A:0,B:0});
  const [team, setTeam] = useState<Team>('A');

  useEffect(()=>{
    socket.on('player:joined', (d:any)=>{ setJoined(true); setTeam(d.team); setTeamScores(d.teamScores||{A:0,B:0}); });
    socket.on('round:start', (v:any)=>{ setQuestion(v.question); setSecondsLeft(v.secondsLeft); setTeamScores(v.teamScores); });
    socket.on('round:tick', (s:number)=> setSecondsLeft(s));
    socket.on('room:scores', (s:any)=> setScores(s));
    socket.on('room:teamScores', (ts:any)=> setTeamScores(ts));
    socket.on('round:end', ()=> setQuestion(null));
    socket.on('errorMsg', (m:string)=> alert(m));
    return ()=>{ socket.off(); };
  },[]);

  const join = ()=> socket.emit('player:join', { code: code.trim().toUpperCase(), name: name.trim()||'Player' });
  const answer = (i:number)=> socket.emit('player:answer', i);

  if (!joined) return (
    <div>
      <h2>Join Game</h2>
      <input placeholder="Room code" value={code} onChange={e=>setCode(e.target.value)} />
      <input placeholder="Your name (TikTok handle for chat answers)" value={name} onChange={e=>setName(e.target.value)} style={{marginLeft:8}}/>
      <button onClick={join} style={{marginLeft:8}}>Join</button>
    </div>
  );

  return (
    <div>
      <h2>Quiz — Team {team}</h2>
      <p>Team scores — A: {teamScores.A} | B: {teamScores.B}</p>
      {question ? (
        <div>
          <p><strong>{question.text}</strong></p>
          <p>Time left: {secondsLeft}s</p>
          {question.options.map((o:string,i:number)=> (
            <button key={i} onClick={()=>answer(i)} style={{display:'block', margin:'6px 0'}}>{o}</button>
          ))}
        </div>
      ) : (
        <p>Waiting for next question…</p>
      )}
      <h3>Scores</h3>
      <ul>
        {scores.sort((a,b)=> b.score-a.score).map((s:any)=> (
          <li key={s.id} style={{color: s.team==='A' ? '#00f0ff' : '#ff00aa'}}>
            {s.name} (Team {s.team}): {s.score}
          </li>
        ))}
      </ul>
    </div>
  );
}
