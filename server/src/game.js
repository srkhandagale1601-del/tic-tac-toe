export const EMPTY = "";
export const HUMAN = "X";
export const AI = "O";
export const WINNING_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function getWinner(board) {
  for (const [a,b,c] of WINNING_LINES) if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
  return null;
}
export function isTerminal(board) { return Boolean(getWinner(board)) || !board.includes(EMPTY); }
export function minimax(board, maximizing, alpha=-Infinity, beta=Infinity, depth=0) {
  const result = getWinner(board);
  if (result === AI) return 10-depth;
  if (result === HUMAN) return depth-10;
  if (!board.includes(EMPTY)) return 0;
  if (maximizing) {
    let best = -Infinity;
    for (let i=0;i<9;i++) if (board[i] === EMPTY) {
      board[i]=AI; const score=minimax(board,false,alpha,beta,depth+1); board[i]=EMPTY;
      best=Math.max(best,score); alpha=Math.max(alpha,best); if (alpha>=beta) break;
    }
    return best;
  }
  let best=Infinity;
  for (let i=0;i<9;i++) if (board[i] === EMPTY) {
    board[i]=HUMAN; const score=minimax(board,true,alpha,beta,depth+1); board[i]=EMPTY;
    best=Math.min(best,score); beta=Math.min(beta,best); if (alpha>=beta) break;
  }
  return best;
}
export function findBestMove(board) {
  if (isTerminal(board)) return null;
  let bestScore=-Infinity, bestMove=null;
  for (let i=0;i<9;i++) if (board[i]===EMPTY) {
    board[i]=AI; const score=minimax(board,false,-Infinity,Infinity,1); board[i]=EMPTY;
    if (score>bestScore) { bestScore=score; bestMove=i; }
  }
  return bestMove;
}
export function createInitialGame({roomCode,mode,hostId,hostName}) {
  return {roomCode,mode,board:Array(9).fill(EMPTY),currentTurn:HUMAN,status:mode==='ai'?'playing':'waiting',winner:null,
    players:{X:{id:hostId,name:hostName||'Player X',connected:true},O:mode==='ai'?{id:'AI',name:'Minimax AI',connected:true}:null},
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),persisted:false};
}
export function validateMove(game,userId,cell) {
  if (!Number.isInteger(cell)||cell<0||cell>8) return 'Cell must be an integer from 0 to 8.';
  if (game.status!=='playing') return 'This game is not currently accepting moves.';
  if (game.board[cell]!==EMPTY) return 'That cell is already occupied.';
  if (!game.players[game.currentTurn]||game.players[game.currentTurn].id!==userId) return 'It is not your turn.';
  return null;
}
export function applyMove(game,symbol,cell) {
  if (game.status!=='playing'||game.board[cell]!==EMPTY) throw new Error('Cannot apply this move.');
  game.board[cell]=symbol;
  const winner=getWinner(game.board);
  if (winner) { game.status='finished'; game.winner=winner; }
  else if (!game.board.includes(EMPTY)) { game.status='finished'; game.winner='draw'; }
  else game.currentTurn=symbol===HUMAN?AI:HUMAN;
  game.updatedAt=new Date().toISOString();
  return game;
}
