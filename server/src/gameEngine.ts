
import { Room, Question, Player, Team, TeamScores, GameSettings } from './types';

export function createRoom(code: string, hostId: string, settings: GameSettings): Room {
  return { code, hostId, players: {}, round: 0, inQuestion: false, settings, lockJoins: false, teamScores: { A: 0, B: 0 } };
}

function pickTeam(room: Room): Team | null {
  const counts = { A: 0, B: 0 };
  Object.values(room.players).forEach(p => counts[p.team]++);
  if (counts.A < room.settings.teamSize) return 'A';
  if (counts.B < room.settings.teamSize) return 'B';
  return null;
}

export function addPlayer(room: Room, socketId: string, name: string): Player | null {
  if (Object.keys(room.players).length >= room.settings.maxPlayers) return null;
  if (room.lockJoins) return null;
  const team = pickTeam(room);
  if (!team) return null; // teams full
  const p: Player = { id: socketId, name, score: 0, joinedAt: Date.now(), answeredThisRound: false, team };
  room.players[socketId] = p; return p;
}

export function removePlayer(room: Room, socketId: string) {
  delete room.players[socketId];
}

export function startRound(room: Room, q: Question) {
  room.round += 1; room.inQuestion = true; room.question = q;
  Object.values(room.players).forEach(p => p.answeredThisRound = false);
}

export function scoreAnswer(room: Room, socketId: string, choiceIndex: number) {
  const p = room.players[socketId];
  if (!room.inQuestion || !p || p.answeredThisRound) return;
  p.answeredThisRound = true;
  if (!room.question) return;
  const correct = (choiceIndex === room.question.correctIndex);
  const delta = correct ? room.settings.pointsCorrect : room.settings.pointsWrong;
  p.score += delta;
  room.teamScores[p.team] += delta;
}

export function endQuestion(room: Room) {
  room.inQuestion = false;
}

export function topPlayers(room: Room, n = 3) {
  return Object.values(room.players).sort((a,b)=> b.score - a.score).slice(0, n);
}

export function roster(room: Room) {
  return Object.values(room.players).map(p => ({ id: p.id, name: p.name, score: p.score, team: p.team }));
}
