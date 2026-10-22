import {useEffect,useMemo,useState} from 'react';
type Cell='X'|'O'|'';
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const winner=(b:Cell[])=>{for(const [a,c,d] of LINES)if(b[a]&&b[a]===b[c]&&b[c]===b[d])return b[a];return null};

interface TNode{id:number;parent:number;cell:number;max:boolean;board:Cell[];depth:number;children:number[];score:number}
interface Ev{id:number;t:'enter'|'done';text:string}
const signed=(n:number)=>n>0?`+${n}`:String(n);

// Plain minimax (same scoring as the server) recorded as a list of steps to replay. No pruning here, to keep the idea simple.
function trace(start:Cell[]){
 const nodes:TNode[]=[],events:Ev[]=[];
 function visit(board:Cell[],max:boolean,depth:number,parent:number,cell:number):number{
  const n:TNode={id:nodes.length,parent,cell,max,board:[...board],depth,children:[],score:0};nodes.push(n);if(parent>=0)nodes[parent].children.push(n.id);
  const empties=board.map((v,i)=>v?-1:i).filter(i=>i>=0);
  if(parent<0)events.push({id:n.id,t:'enter',text:`It is the AI's turn (it plays O). It has ${empties.length} choices: ${empties.map(i=>`cell ${i+1}`).join(' or ')}. To pick, it imagines each one.`});
  else events.push({id:n.id,t:'enter',text:max?`Now imagine you (X) reply with cell ${cell+1}.`:`Imagine the AI plays cell ${cell+1}.`});
  const w=winner(board);
  if(w||!empties.length){
   n.score=w==='O'?10-depth:w==='X'?depth-10:0;
   events.push({id:n.id,t:'done',text:w==='O'?`The game ends and O wins! That is great for the AI: ${signed(n.score)} points.`:w==='X'?`The game ends and X wins. That is bad for the AI: ${signed(n.score)} points.`:'The board is full: a draw, worth 0 points.'});
   return n.score;
  }
  const scores:number[]=[];
  for(const i of empties){board[i]=max?'O':'X';scores.push(visit(board,!max,depth+1,n.id,i));board[i]=''}
  n.score=max?Math.max(...scores):Math.min(...scores);
  const list=scores.join(' and ');
  events.push({id:n.id,t:'done',text:parent<0
   ?`The AI looked at everything. Its options are worth ${list}. It chooses the best one: ${signed(n.score)}.`
   :max?`The AI's options here are worth ${list}. It would pick the best: ${signed(n.score)}.`
   :`Your options here are worth ${list} to the AI. You would pick the worst for the AI, so this move is worth ${signed(n.score)}.`});
  return n.score;
 }
 visit([...start],true,0,-1,-1);
 return{nodes,events};
}

// Two tiny positions (2 empty cells, AI = O to move) so the whole search fits on screen.
const PRESETS:{name:string;hint:string;board:Cell[]}[]=[
 {name:'Win now',hint:'One move wins at once, the other lets X win.',board:['O','X','X','O','O','X','X','','']},
 {name:'Block a threat',hint:'X threatens to win. Can the AI stop it?',board:['O','','X','X','O','O','X','','X']},
];

function Mini({board,hl}:{board:Cell[];hl:number}){
 return <div className="mini">{board.map((v,i)=><span key={i} className={`${v.toLowerCase()} ${i===hl?'last':''}`}>{v}</span>)}</div>;
}

export default function AlgoAnimation(){
 const [preset,setPreset]=useState(0),[step,setStep]=useState(0),[playing,setPlaying]=useState(false);
 const t=useMemo(()=>trace(PRESETS[preset].board),[preset]);
 const last=t.events.length-1;
 useEffect(()=>{setStep(0);setPlaying(false)},[preset]);
 useEffect(()=>{if(!playing)return;if(step>=last){setPlaying(false);return}const id=setTimeout(()=>setStep(s=>s+1),1700);return()=>clearTimeout(id)},[playing,step,last]);

 // Replay events up to `step`: which positions exist so far, and which have a final score.
 const {shown,done}=useMemo(()=>{
  const shown=new Set<number>(),done=new Set<number>();
  for(let i=0;i<=step;i++){const e=t.events[i];if(e.t==='enter')shown.add(e.id);else done.add(e.id)}
  return{shown,done};
 },[t,step]);
 const ev=t.events[step],finished=step===last;
 const root=t.nodes[0];
 const bestChild=finished?root.children.find(c=>t.nodes[c].score===root.score):-1;

 const render=(id:number)=>{
  const n=t.nodes[id],isDone=done.has(id),active=ev.id===id,tone=isDone?(n.score>0?'pos':n.score<0?'neg':'zero'):'';
  const who=n.parent<0?'Board now':`${n.max?'X':'O'} plays ${n.cell+1}`;
  return <div className="tnode" key={id}>
   <div className={`card ${tone} ${active?'active':''} ${bestChild===id?'best':''}`}>
    <small>{who}</small><Mini board={n.board} hl={n.cell}/>
    <b className="pill2">{isDone?signed(n.score):'?'}</b>{bestChild===id&&<em>✓ AI picks this</em>}
   </div>
   {n.children.some(c=>shown.has(c))&&<div className="kids">{n.children.filter(c=>shown.has(c)).map(render)}</div>}
  </div>;
 };

 return <section className="panel anim" aria-label="Animated minimax walkthrough">
  <small className="eyebrow">WATCH IT THINK</small><h2>The AI plays out the future before it moves</h2>
  <p className="muted">The AI is <b>O</b>. For every move it could make, it imagines your best reply, and so on until the game ends. Each ending gets points: <b className="g">+ good for the AI</b>, <b className="p">− bad for the AI</b>. Then it chooses the move with the best points.</p>
  <div className="presets">{PRESETS.map((p,i)=><button key={p.name} className={i===preset?'sel':''} onClick={()=>setPreset(i)}>{p.name}</button>)}<span className="hint">{PRESETS[preset].hint}</span></div>
  <div className="treebox">{render(0)}</div>
  <div className="cap" aria-live="polite"><small>STEP {step+1} OF {t.events.length}</small><p>{ev.text}</p></div>
  <div className="ctrl">
   <button onClick={()=>{setPlaying(false);setStep(s=>Math.max(0,s-1))}} aria-label="Previous step" disabled={step===0}>◀ Back</button>
   <button className="play" onClick={()=>{if(finished)setStep(0);setPlaying(p=>!p||finished)}}>{playing?'⏸ Pause':finished?'↻ Replay':'▶ Play'}</button>
   <button onClick={()=>{setPlaying(false);setStep(s=>Math.min(last,s+1))}} aria-label="Next step" disabled={finished}>Next ▶</button>
  </div>
 </section>;
}
