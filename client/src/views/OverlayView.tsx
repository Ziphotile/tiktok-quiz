
import { useEffect, useState } from 'react';
import { socket } from '../socket';

export default function OverlayView(){
  const [question, setQuestion] = useState<any>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [top, setTop] = useState<any[]>([]);
  const [teamScores, setTeamScores] = useState<{A:number;B:number}>({A:0,B:0});

  useEffect(()=>{
    socket.on('round:start', (v:any)=>{ setQuestion(v.question); setSecondsLeft(v.secondsLeft); setTeamScores(v.teamScores); });
    socket.on('round:tick', (s:number)=> setSecondsLeft(s));
    socket.on('round:end', (d:any)=>{ setQuestion(null); setTop(d.top || []); setTeamScores(d.teamScores || {A:0,B:0}); });
    socket.on('room:teamScores', (ts:any)=> setTeamScores(ts));
    socket.on('game:ended', (d:any)=>{
      setQuestion(null); setTop(d.top||[]); setTeamScores(d.teamScores||{A:0,B:0});
      const banner = document.createElement('div');
      banner.textContent = d.winningTeam==='TIE' ? 'Match Tied!' : `Team ${d.winningTeam} Wins!`;
      Object.assign(banner.style,{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontSize:'48px',fontWeight:'900', color:'#fff'});
      document.body.appendChild(banner); setTimeout(()=> banner.remove(), 4000);
    });
    return ()=>{ socket.off(); };
  },[]);

  return (
    <div style={{fontFamily:'Inter, system-ui', padding:10, position:'relative'}}>
      <img src="/logo.svg" alt="logo" style={{position:'absolute', top:8, left:8, width:120, opacity:0.9}}/>
      <div style={{position:'absolute', top:8, right:8, display:'flex', gap:12}}>
        <div style={{color:'#00f0ff', fontWeight:700}}>Team A: {teamScores.A}</div>
        <div style={{color:'#ff00aa', fontWeight:700}}>Team B: {teamScores.B}</div>
      </div>
      {question ? (
        <div>
          <div style={{fontSize:24, fontWeight:700}}>{question.text}</div>
          <div style={{marginTop:8}}>⏳ {secondsLeft}s</div>
          <ol style={{marginTop:8}}>
            {question.options.map((o:string,i:number)=> <li key={i}>{o}</li>)}
          </ol>
        </div>
      ) : (
        <div>
          <div style={{fontSize:20, fontWeight:600}}>Top Players</div>
          <ol>
            {top.map((p:any)=> <li key={p.id}>{p.name}: {p.score}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}
