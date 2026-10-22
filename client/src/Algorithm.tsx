import {useMemo,useState} from 'react';
import AlgoAnimation from './AlgoAnimation';
type Cell='X'|'O'|'';
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const winner=(b:Cell[])=>{for(const [a,c,d] of LINES)if(b[a]&&b[a]===b[c]&&b[c]===b[d])return b[a];return null};
// Mirrors server/src/game.js: AI is O (maximizing), human is X. Counts visited nodes so pruning savings are visible.
function search(b:Cell[],max:boolean,a:number,be:number,depth:number,prune:boolean,c:{n:number}):number{
 c.n++;const w=winner(b);if(w==='O')return 10-depth;if(w==='X')return depth-10;if(!b.includes(''))return 0;
 let best=max?-Infinity:Infinity;
 for(let i=0;i<9;i++)if(!b[i]){b[i]=max?'O':'X';const s=search(b,!max,a,be,depth+1,prune,c);b[i]='';
  if(max){best=Math.max(best,s);a=Math.max(a,best)}else{best=Math.min(best,s);be=Math.min(be,best)}
  if(prune&&a>=be)break;}
 return best;
}
function analyse(board:Cell[],prune:boolean){
 const scores:(number|null)[]=Array(9).fill(null),c={n:0},b=[...board];
 if(winner(b)||!b.includes(''))return{scores,nodes:0,best:null as number|null};
 let best:number|null=null,bs=-Infinity;
 for(let i=0;i<9;i++)if(!b[i]){b[i]='O';const s=search(b,false,-Infinity,Infinity,1,prune,c);b[i]='';scores[i]=s;if(s>bs){bs=s;best=i}}
 return{scores,nodes:c.n,best};
}
const Mark=({v}:{v:Cell})=>v==='X'?<svg viewBox="0 0 40 40" className="mark x"><path d="M8 8L32 32M32 8L8 32"/></svg>:v==='O'?<svg viewBox="0 0 40 40" className="mark o"><circle cx="20" cy="20" r="13"/></svg>:null;

export default function Algorithm(){
 const [board,setBoard]=useState<Cell[]>(['X','','','','O','','','','X']);
 const [turn,setTurn]=useState<'X'|'O'>('O');
 const [prune,setPrune]=useState(true);
 const on=useMemo(()=>analyse(board,true),[board]),off=useMemo(()=>analyse(board,false),[board]);
 const cur=prune?on:off, over=Boolean(winner(board))||!board.includes('');
 const click=(i:number)=>{if(board[i]||over)return;const n=[...board];n[i]=turn;setBoard(n);setTurn(turn==='X'?'O':'X')};
 const reset=(b:Cell[],t:'X'|'O')=>{setBoard(b);setTurn(t)};
 const saved=off.nodes?Math.round((1-on.nodes/off.nodes)*100):0;
 return <div className="algo">
  <section className="panel intro"><small className="eyebrow">BEHIND THE SCREEN</small><h2>How the Minimax AI thinks</h2>
   <p className="muted">Tic-tac-toe is a <b>solved game</b>: there are only 549,946 possible move sequences. Our AI looks at all of the ones that matter, assumes you will play your best, and picks the move with the best guaranteed outcome. That is why it can be drawn but never beaten.</p>
   <div className="steps">
    <article><b>01</b><h3>Imagine every future</h3><p>From the current board, try each empty cell, then each reply, and so on until someone wins or the board fills. This tree of "what ifs" is the search.</p></article>
    <article><b>02</b><h3>Score the endings</h3><p>An AI win is <code>10 − depth</code>, a loss is <code>depth − 10</code>, a draw is <code>0</code>. Subtracting depth makes the AI prefer quick wins and slow losses.</p></article>
    <article><b>03</b><h3>Assume the best opponent</h3><p>On the AI's turn it picks the <em>highest</em> score (max). On your turn it assumes you pick the <em>lowest</em> (min). Scores bubble up the tree to the root.</p></article>
    <article><b>04</b><h3>Prune what can't matter</h3><p>Alpha-beta tracks the best score each side is already guaranteed. If a branch can't beat that, it is skipped (<code>alpha ≥ beta</code>). Same answer, far less work.</p></article>
   </div></section>
  <AlgoAnimation/>
  <section className="panel lab"><div className="labhead"><div><small className="eyebrow">LIVE SANDBOX</small><h2>Watch it evaluate every move</h2></div>
    <label className="switch"><input type="checkbox" checked={prune} onChange={e=>setPrune(e.target.checked)}/><span/>Alpha-beta pruning</label></div>
   <p className="muted">Click cells to place pieces (it alternates X and O). Each empty cell shows the minimax score if <b>O</b> (the AI) plays there. The green cell is the AI's choice. This runs the same code as the server.</p>
   <div className="labgrid"><div className="board small">{board.map((v,i)=>{const s=cur.scores[i];return <button key={i} className={`cell ${v?'filled':''} ${cur.best===i?'best':''}`} onClick={()=>click(i)} aria-label={`Cell ${i+1} ${v||'empty'}${s!==null?`, score ${s}`:''}`}>{v?<Mark v={v}/>:s!==null&&<span className={`score ${s>0?'pos':s<0?'neg':''}`}>{s>0?'+':''}{s}</span>}</button>})}</div>
    <div className="stats">
     <div className="stat"><small>Next to move</small><strong>{over?'Game over':turn}</strong></div>
     <div className="stat"><small>Nodes searched</small><strong>{cur.nodes.toLocaleString()}</strong></div>
     <div className="stat"><small>Without pruning</small><strong>{off.nodes.toLocaleString()}</strong></div>
     <div className="stat hi"><small>Work saved by pruning</small><strong>{saved}%</strong></div>
     <div className="presets"><button onClick={()=>reset(Array(9).fill(''),'O')}>Empty board</button><button onClick={()=>reset(['X','','','','O','','','','X'],'O')}>Corner trap</button><button onClick={()=>reset(['X','X','','','O','','','',''],'O')}>Must block</button><button onClick={()=>reset(['O','O','','X','X','','','',''],'O')}>Win in one</button></div>
    </div></div>
   <div className="legend"><span className="pos">+ AI wins</span><span>0 draw</span><span className="neg">− AI loses</span></div></section>
  <section className="panel code"><small className="eyebrow">THE CODE</small><h2>Twenty lines that never lose</h2>
<pre>{`function minimax(board, maximizing, alpha, beta, depth) {
  const w = getWinner(board);
  if (w === AI)    return 10 - depth;   // faster win = better
  if (w === HUMAN) return depth - 10;   // slower loss = better
  if (isFull(board)) return 0;          // draw

  let best = maximizing ? -Infinity : Infinity;
  for (const cell of emptyCells(board)) {
    board[cell] = maximizing ? AI : HUMAN;
    const score = minimax(board, !maximizing, alpha, beta, depth + 1);
    board[cell] = EMPTY;                // undo
    if (maximizing) { best = Math.max(best, score); alpha = Math.max(alpha, best); }
    else            { best = Math.min(best, score); beta  = Math.min(beta,  best); }
    if (alpha >= beta) break;           // prune
  }
  return best;
}`}</pre>
   <div className="facts"><div><b>O(b<sup>d</sup>)</b><span>worst-case time without pruning</span></div><div><b>~O(b<sup>d/2</sup>)</b><span>with ideal move ordering</span></div><div><b>Server-side</b><span>the AI runs on the server; clients can't fake its moves</span></div></div></section>
 </div>;
}
