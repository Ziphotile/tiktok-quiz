
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'fs';
import { parse } from 'csv-parse';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { createRoom, addPlayer, removePlayer, startRound, scoreAnswer, endQuestion, topPlayers, roster } from './gameEngine';
import { DEFAULT_SETTINGS } from './config';
import { Room, Question, ClientRoundView } from './types';
import { attachTikTokLive } from './tiktokBridge';

dotenv.config();
const app = express();
const limiter = rateLimit({ windowMs: 10_000, max: 100 });
app.use(limiter);
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CORS_ORIGIN || '*' } });

const rooms = new Map<string, Room>();
const questionBank: Record<string, any[]> = {};
const categoriesByRoom: Record<string, Set<string>> = {};

function genCode(){ return Math.random().toString(36).slice(2,6).toUpperCase(); }

function scrub(room: Room): ClientRoundView {
  const q = room.question ? { id: room.question.id, text: room.question.text, options: room.question.options, category: room.question.category } : undefined;
  return {
    round: room.round,
    question: q,
    secondsLeft: room.settings.questionSeconds,
    inQuestion: room.inQuestion,
    teamScores: room.teamScores,
    roster: roster(room)
  };
}

io.on('connection', (socket) => {
  let roomCode: string | null = null;

  socket.on('host:createRoom', () => {
    const code = genCode();
    const room = createRoom(code, socket.id, DEFAULT_SETTINGS);
    rooms.set(code, room);
    roomCode = code;
    io.to(socket.id).emit('host:roomCreated', { code, settings: room.settings });
  });

  socket.on('player:join', (data: { code: string; name: string }) => {
    const schema = z.object({ code: z.string().min(3), name: z.string().min(1).max(20) });
    const { code, name } = schema.parse(data);
    const room = rooms.get(code);
    if (!room) return socket.emit('errorMsg', 'Room not found');
    const p = addPlayer(room, socket.id, name);
    if (!p) return socket.emit('errorMsg', 'Room or teams are full, or locked');
    roomCode = code; socket.join(code);
    io.to(socket.id).emit('player:joined', { code, me: p, settings: room.settings, team: p.team, teamScores: room.teamScores });
    io.in(code).emit('room:players', roster(room));
    io.in(code).emit('room:teamScores', room.teamScores);
  });

  socket.on('host:lockJoins', (lock: boolean) => {
    if (!roomCode) return;
    const room = rooms.get(roomCode); if (!room || room.hostId !== socket.id) return;
    room.lockJoins = lock; io.in(roomCode).emit('room:locked', lock);
  });

  socket.on('host:startRound', (q: Question) => {
    if (!roomCode) return; const room = rooms.get(roomCode); if (!room || room.hostId !== socket.id) return;
    if (room.inQuestion) return;
    startRound(room, q);
    io.in(roomCode).emit('round:start', scrub(room));
    let secondsLeft = room.settings.questionSeconds;
    const interval = setInterval(() => {
      secondsLeft -= 1;
      io.in(roomCode!).emit('round:tick', secondsLeft);
      if (secondsLeft <= 0 || !room.inQuestion) {
        clearInterval(interval);
        endQuestion(room);
        io.in(roomCode!).emit('round:end', { top: topPlayers(room), teamScores: rooms.get(roomCode!)?.teamScores });
      }
    }, 1000);
  });

  socket.on('player:answer', (choiceIndex: number) => {
    if (!roomCode) return; const room = rooms.get(roomCode); if (!room) return;
    scoreAnswer(room, socket.id, choiceIndex);
    io.in(roomCode).emit('room:scores', roster(room));
    io.in(roomCode).emit('room:teamScores', room.teamScores);
  });

  socket.on('host:endGame', ()=>{
    if (!roomCode) return; const room = rooms.get(roomCode); if (!room || room.hostId !== socket.id) return;
    const rosterArr = roster(room);
    const topInd = [...rosterArr].sort((a,b)=> b.score-a.score).slice(0,3);
    const winningTeam = room.teamScores.A===room.teamScores.B ? 'TIE' : (room.teamScores.A>room.teamScores.B ? 'A' : 'B');
    io.in(roomCode).emit('game:ended', { top: topInd, teamScores: room.teamScores, winningTeam });
  });

  socket.on('disconnect', () => {
    if (!roomCode) return; const room = rooms.get(roomCode); if (!room) return;
    if (room.hostId === socket.id) {
      io.in(roomCode).emit('room:ended');
      rooms.delete(roomCode);
      return;
    }
    removePlayer(room, socket.id);
    io.in(roomCode).emit('room:players', roster(room));
    io.in(roomCode).emit('room:teamScores', room.teamScores);
  });
});

// --- Admin & utility routes ---
function adminGuard(req:any,res:any,next:any){
  if (req.headers['x-admin-token'] === process.env.ADMIN_TOKEN) return next();
  return res.status(401).json({error:'unauthorised'});
}

app.get('/', (_req,res)=> res.send('ok'));

app.get('/state/:code', (req,res)=>{
  const { code } = req.params; const room = rooms.get(code); if (!room) return res.status(404).json({error:'Room not found'});
  res.json(scrub(room));
});

app.post('/admin/upload-questions/:code', adminGuard, upload.single('file'), (req, res) => {
  const { code } = req.params;
  if (!rooms.get(code)) return res.status(404).json({ error: 'Room not found' });
  const file = req.file; if (!file) return res.status(400).json({ error: 'No file' });
  const rows: any[] = [];
  fs.createReadStream(file.path)
    .pipe(parse({ columns: true, trim: true }))
    .on('data', (r) => rows.push(r))
    .on('end', () => {
      (questionBank as any)[code] = rows.map((r: any, idx: number) => ({
        id: r.id || String(idx + 1),
        text: r.text,
        options: [r.optionA, r.optionB, r.optionC, r.optionD],
        correctIndex: Number(r.correctIndex),
        category: r.category || 'General'
      }));
      (categoriesByRoom as any)[code] = new Set((questionBank as any)[code].map((q:any)=> q.category));
      fs.unlinkSync(file.path);
      res.json({ loaded: (questionBank as any)[code].length, categories: Array.from((categoriesByRoom as any)[code]) });
    });
});

app.post('/admin/next-from-bank/:code', adminGuard, (req,res)=>{
  const { code } = req.params; const { category } = (req.body||{}) as any;
  const bank = (questionBank as any)[code] || [];
  const idx = bank.findIndex((q:any)=> !category || q.category===category);
  if (idx<0) return res.status(404).json({error:'No question in category'});
  const [next] = bank.splice(idx,1);
  const room = rooms.get(code); if (!room) return res.status(404).json({error:'Room not found'});
  startRound(room, next);
  io.in(code).emit('round:start', scrub(room));
  res.json({ ok:true });
});

app.post('/admin/kick/:code/:playerId', adminGuard, (req,res)=>{
  const { code, playerId } = req.params; const room = rooms.get(code); if (!room) return res.status(404).json({error:'Room not found'});
  removePlayer(room, playerId);
  (io as any).in(code).emit('room:players', roster(room));
  res.json({ ok:true });
});

app.post('/admin/lock/:code', adminGuard, (req,res)=>{
  const { code } = req.params; const room = rooms.get(code); if (!room) return res.status(404).json({error:'Room not found'});
  room.lockJoins = true; (io as any).in(code).emit('room:locked', true);
  res.json({ ok:true });
});

app.post('/admin/unlock/:code', adminGuard, (req,res)=>{
  const { code } = req.params; const room = rooms.get(code); if (!room) return res.status(404).json({error:'Room not found'});
  room.lockJoins = false; (io as any).in(code).emit('room:locked', false);
  res.json({ ok:true });
});

app.post('/admin/swap/:code', adminGuard, (req,res)=>{
  const { code } = req.params; const { fromId, toId } = (req.body||{}) as any;
  const room = rooms.get(code); if (!room) return res.status(404).json({error:'Room not found'});
  const A = (room.players as any)[fromId]; const B = (room.players as any)[toId];
  if (!A && !B) return res.status(400).json({error:'Invalid player ids'});
  const count = { A:0, B:0 }; Object.values(room.players).forEach((p:any)=> count[p.team]++);
  function move(p:any, target:'A'|'B'){ if (!p) return false; if (p.team===target) return true; if (count[target] >= room.settings.teamSize) return false; count[p.team]--; p.team = target; count[target]++; return true; }
  if (A && B) { const Ta=A.team, Tb=B.team; A.team=Tb; B.team=Ta; }
  else if (A) { if (!move(A, A.team==='A'?'B':'A')) return res.status(400).json({error:'Target team full'}); }
  else if (B) { if (!move(B, B.team==='A'?'B':'A')) return res.status(400).json({error:'Target team full'}); }
  (io as any).in(code).emit('room:players', roster(room));
  return res.json({ ok:true, roster: roster(room) });
});

httpServer.listen(process.env.PORT || 3001, () => console.log('Server on :' + (process.env.PORT || 3001)));

attachTikTokLive(io, rooms);
