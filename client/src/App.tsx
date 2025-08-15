
import { useState } from 'react';
import HostView from './views/HostView';
import PlayerView from './views/PlayerView';
import OverlayView from './views/OverlayView';
import AdminView from './views/AdminView';

export default function App(){
  const [mode, setMode] = useState<'host'|'player'|'overlay'|'admin'|null>(null);
  return (
    <div style={{fontFamily:'Inter, system-ui', padding:20}}>
      {!mode && (
        <div>
          <h1>TikTok Live Quiz</h1>
          <button onClick={()=>setMode('host')}>Host</button>
          <button onClick={()=>setMode('player')} style={{marginLeft:8}}>Player</button>
          <button onClick={()=>setMode('overlay')} style={{marginLeft:8}}>OBS Overlay</button>
          <button onClick={()=>setMode('admin')} style={{marginLeft:8}}>Admin</button>
          <p style={{marginTop:12}}>10‑player (5v5) quiz with negative scoring.</p>
        </div>
      )}
      {mode==='host' && <HostView/>}
      {mode==='player' && <PlayerView/>}
      {mode==='overlay' && <OverlayView/>}
      {mode==='admin' && <AdminView/>}
    </div>
  );
}
