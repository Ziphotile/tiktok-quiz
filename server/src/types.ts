
export type Team = 'A' | 'B';

export type Player = {
  id: string;
  name: string;
  score: number;
  joinedAt: number;
  answeredThisRound: boolean;
  team: Team;
};

export type TeamScores = { A: number; B: number };

export type Room = {
  code: string;
  hostId: string;
  players: Record<string, Player>; // socketId -> Player
  round: number;
  inQuestion: boolean;
  question?: Question;
  settings: GameSettings;
  lockJoins: boolean;
  teamScores: TeamScores;
};

export type Question = { id: string; text: string; options: string[]; correctIndex: number; category?: string };
export type GameSettings = { maxPlayers: number; rounds: number; pointsCorrect: number; pointsWrong: number; questionSeconds: number; teamSize: number };

export type ClientRoundView = {
  round: number;
  question?: Omit<Question, 'correctIndex'>;
  secondsLeft: number;
  inQuestion: boolean;
  teamScores: TeamScores;
  roster: Array<{ id: string; name: string; score: number; team: Team }>;
};
