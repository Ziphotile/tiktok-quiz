
// Optional: TikTok Live chat -> in-game answers bridge.
// This is best-effort and may break if TikTok changes internals.
import { WebcastPushConnection } from 'tiktok-live-connector';
import { Server } from 'socket.io';

const mapAnswer = (msg: string) => {
  const m = (msg || '').trim().toUpperCase();
  if (m.startsWith('A')) return 0;
  if (m.startsWith('B')) return 1;
  if (m.startsWith('C')) return 2;
  if (m.startsWith('D')) return 3;
  return null;
};

export function attachTikTokLive(io: Server, rooms: Map<string, any>){
  const username = process.env.TIKTOK_LIVE_USERNAME;
  if (!username) { console.warn('TIKTOK_LIVE_USERNAME not set'); return; }
  const tiktok = new WebcastPushConnection(username);
  tiktok.connect().then(()=> console.log('TikTok Live connected')).catch(console.error);

  tiktok.on('chat', (data:any)=>{
    const user = data?.uniqueId || data?.nickname || 'ChatUser';
    const idx = mapAnswer(data?.comment || '');
    if (idx === null) return;
    rooms.forEach((room, code) => {
      if (!room.inQuestion) return;
      const player = Object.values(room.players).find((p:any)=> (p.name||'').toLowerCase() === (user||'').toLowerCase());
      if (!player) return;
      // emit to that player's socket
      io.to(player.id).emit('player:answer', idx);
    });
  });
}
