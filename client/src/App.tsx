import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {apiUrl,socket} from './socket';
import Algorithm from './Algorithm';
import type {Ack,Game,Identity,Mode} from './types';
const ID_KEY='ttt-guest-identity', ROOM_KEY='ttt-last-room', SCORE_KEY='ttt-score', MUTE_KEY='ttt-muted';
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
type Score={w:number;l:number;d:number};
const winLine=(b:string[])=>LINES.find(([a,c,d])=>b[a]&&b[a]===b[c]&&b[c]===b[d])||null;

// Tiny WebAudio synth so there are no asset files to ship.
let ctx:AudioContext|null=null;
function beep(freq:number,dur=0.12,type:OscillatorType='square',delay=0){
 try{ctx??=new AudioContext();const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+delay;
  o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+dur)}catch{/* audio unavailable */}
}
const sfx={place:(x:boolean)=>beep(x?520:390,.1),win:()=>[523,659,784,1046].forEach((f,i)=>beep(f,.18,'triangle',i*.1)),lose:()=>[330,262,196].forEach((f,i)=>beep(f,.22,'sawtooth',i*.14)),draw:()=>[392,392].forEach((f,i)=>beep(f,.15,'triangle',i*.15))};

const Mark=({v}:{v:string})=>v==='X'?<svg viewBox="0 0 40 40" className="mark x"><path d="M8 8L32 32M32 8L8 32"/></svg>:v==='O'?<svg viewBox="0 0 40 40" className="mark o"><circle cx="20" cy="20" r="13"/></svg>:null;
const Confetti=()=><div className="confetti" aria-hidden>{Array.from({length:36},(_,i)=><i key={i} style={{left:`${(i*53)%100}%`,animationDelay:`${(i%9)*.12}s`,background:['#5eead4','#a78bfa','#fbbf24','#f472b6'][i%4]}}/>)}</div>;

export default function App(){
 const [tab,setTab]=useState<'play'|'algo'>('play');
 const [identity,setIdentity]=useState<Identity|null>(null),[game,setGame]=useState<Game|null>(null),[mode,setMode]=useState<Mode>('ai'),[room,setRoom]=useState(''),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('Connecting to game server…');
 const [muted,setMuted]=useState(()=>localStorage.getItem(MUTE_KEY)==='1');
 const [score,setScore]=useState<Score>(()=>{try{return JSON.parse(localStorage.getItem(SCORE_KEY)||'')as Score}catch{return{w:0,l:0,d:0}}});
 const mutedRef=useRef(muted);mutedRef.current=muted;
 const prev=useRef<Game|null>(null);
 const mySymbol=useMemo(()=>!game||!identity?null:game.players.X?.id===identity.userId?'X':game.players.O?.id===identity.userId?'O':null,[game,identity]);
 const line=useMemo(()=>game?winLine(game.board):null,[game]);

 // Sound + scoreboard reactions to state changes within the same room.
 useEffect(()=>{
  const p=prev.current;prev.current=game;if(!game||!mySymbol||!p||p.roomCode!==game.roomCode)return;
  const filled=(g:Game)=>g.board.filter(Boolean).length;
  if(filled(game)>filled(p)&&!mutedRef.current){const last=game.board.findIndex((v,i)=>v&&!p.board[i]);sfx.place(game.board[last]==='X')}
  if(game.status==='finished'&&p.status!=='finished'){
   const r=game.winner==='draw'?'d':game.winner===mySymbol?'w':'l';
   setScore(s=>{const n={...s,[r]:s[r]+1};localStorage.setItem(SCORE_KEY,JSON.stringify(n));return n});
   if(!mutedRef.current)setTimeout(()=>r==='w'?sfx.win():r==='l'?sfx.lose():sfx.draw(),250);
  }
 },[game,mySymbol]);

 const init=useCallback(async()=>{let guest:Identity|null=null;try{const saved=localStorage.getItem(ID_KEY);if(saved)guest=JSON.parse(saved) as Identity;}catch{localStorage.removeItem(ID_KEY)}if(!guest?.token){const r=await fetch(`${apiUrl}/api/guest`,{method:'POST'});if(!r.ok)throw Error('Could not create guest identity.');guest=await r.json() as Identity;localStorage.setItem(ID_KEY,JSON.stringify(guest));}setIdentity(guest);socket.auth={token:guest.token};if(!socket.connected)socket.connect();},[]);
 useEffect(()=>{init().catch((e:Error)=>setNotice(e.message));
  const onConnect=()=>{setConnected(true);setNotice('Connected. Create a room or join with a code.');const last=localStorage.getItem(ROOM_KEY);if(last)socket.emit('room:reconnect',{roomCode:last},(a:Ack)=>{if(a.ok&&a.game){prev.current=a.game;setGame(a.game)}});};
  const onDisconnect=()=>{setConnected(false);setNotice('Connection lost. Reconnecting…')};
  const onError=(e:Error)=>setNotice(`Connection error: ${e.message}`);
  const onState=(g:Game)=>{setGame(g);localStorage.setItem(ROOM_KEY,g.roomCode);};
  socket.on('connect',onConnect);socket.on('disconnect',onDisconnect);socket.on('connect_error',onError);socket.on('game:state',onState);
  return()=>{socket.off('connect',onConnect);socket.off('disconnect',onDisconnect);socket.off('connect_error',onError);socket.off('game:state',onState)};},[init]);

 const create=()=>{setBusy(true);socket.emit('room:create',{mode},(a:Ack)=>{setBusy(false);if(!a.ok||!a.game)return setNotice(a.error||'Could not create room');prev.current=a.game;setGame(a.game);setRoom(a.game.roomCode);localStorage.setItem(ROOM_KEY,a.game.roomCode);setNotice(`Room ${a.game.roomCode} created. ${mode==='pvp'?'Share the code with a friend.':'Play against the AI.'}`)});};
 const join=()=>{const c=room.trim().toUpperCase();if(!c)return setNotice('Enter a room code.');setBusy(true);socket.emit('room:join',{roomCode:c},(a:Ack)=>{setBusy(false);if(!a.ok||!a.game)return setNotice(a.error||'Could not join room');prev.current=a.game;setGame(a.game);localStorage.setItem(ROOM_KEY,c);setNotice(`Joined room ${c}.`)});};
 const reconnect=()=>{const c=room.trim().toUpperCase()||localStorage.getItem(ROOM_KEY);if(!c)return setNotice('No previous room found.');socket.emit('room:reconnect',{roomCode:c},(a:Ack)=>{if(!a.ok||!a.game)return setNotice(a.error||'Could not reconnect');prev.current=a.game;setGame(a.game);setNotice(`Reconnected to ${c}.`)});};
 const move=(cell:number)=>{if(!game||!mySymbol)return;socket.emit('game:move',{roomCode:game.roomCode,cell},(a:Ack)=>{if(!a.ok)setNotice(a.error||'Move rejected');else if(a.game)setGame(a.game)});};
 const leave=()=>{prev.current=null;setGame(null);setRoom('');localStorage.removeItem(ROOM_KEY)};
 const toggleMute=()=>{setMuted(m=>{localStorage.setItem(MUTE_KEY,m?'0':'1');return!m})};

 const myTurn=game?.status==='playing'&&game.currentTurn===mySymbol;
 const result=game?.status==='finished'?(game.winner==='draw'?'draw':game.winner===mySymbol?'win':'lose'):null;
 const status=()=>{if(!game)return 'Press start to enter the arena';if(game.status==='waiting')return 'Waiting for a challenger…';if(result==='draw')return 'Stalemate!';if(result==='win')return 'VICTORY';if(result==='lose')return 'DEFEAT';if(!mySymbol)return 'Spectating';return myTurn?'Your move':game.mode==='ai'?'AI is thinking…':'Opponent’s move'};

 return <main className="shell">
  <header className="top"><div className="logo">X<span>O</span></div><div><small className="eyebrow">ARENA · REAL-TIME</small><h1>Tic-Tac-Toe <em>Online</em></h1></div>
   <nav className="tabs" role="tablist"><button role="tab" aria-selected={tab==='play'} className={tab==='play'?'on':''} onClick={()=>setTab('play')}>🎮 Play</button><button role="tab" aria-selected={tab==='algo'} className={tab==='algo'?'on':''} onClick={()=>setTab('algo')}>🧠 How the AI works</button></nav>
   <button className="icon" onClick={toggleMute} aria-label={muted?'Unmute sound':'Mute sound'} title="Sound">{muted?'🔇':'🔊'}</button>
   <span className={`pill ${connected?'on':''}`}>{connected?'● Online':'● Offline'}</span></header>
  {tab==='algo'?<Algorithm/>:
  <section className="layout"><aside className="panel lobby"><small className="eyebrow">LOBBY</small><h2>Choose your battle</h2>
   <div className="modes"><button className={mode==='ai'?'on':''} onClick={()=>setMode('ai')}><span>🤖</span><b>vs AI</b><small>Unbeatable minimax</small></button><button className={mode==='pvp'?'on':''} onClick={()=>setMode('pvp')}><span>⚔️</span><b>vs Friend</b><small>Share a room code</small></button></div>
   <button className="primary" disabled={!connected||busy} onClick={create}>{busy?'Please wait…':'▶ START MATCH'}</button>
   <div className="or">OR JOIN A FRIEND</div>
   <input value={room} onChange={e=>setRoom(e.target.value.toUpperCase())} placeholder="ROOM CODE" aria-label="Room code" maxLength={6}/>
   <button className="secondary" disabled={!connected||busy} onClick={join}>Join room <span>→</span></button>
   <button className="link" disabled={!connected} onClick={reconnect}>↻ Reconnect to last room</button>
   <div className="notice">● {notice}</div>
   <div className="scoreboard"><small className="eyebrow">YOUR RECORD</small><div><span className="w"><b>{score.w}</b>Wins</span><span className="d"><b>{score.d}</b>Draws</span><span className="l"><b>{score.l}</b>Losses</span></div></div></aside>
  <section className={`panel game ${result||''}`}>
   <div className="gamehead"><div><small className="eyebrow">{game?(game.mode==='ai'?'VS MINIMAX AI':'FRIEND MATCH'):'READY PLAYER ONE'}</small><h2>{game?`Room ${game.roomCode}`:'Arena'}</h2></div>{game&&<button className="copy" onClick={()=>{navigator.clipboard?.writeText(game.roomCode);setNotice('Room code copied.')}}>▣ Copy code</button>}</div>
   <div className="players"><div className={`player ${game?.status==='playing'&&game.currentTurn==='X'?'turn':''}`}><b className="x">X</b><span><strong>{game?.players.X?.name||'Player X'}</strong><small>{mySymbol==='X'?'YOU':'PLAYER 1'}</small></span></div><i>VS</i><div className={`player ${game?.status==='playing'&&game.currentTurn==='O'?'turn':''}`}><b className="o">O</b><span><strong>{game?.players.O?.name||(game?.mode==='ai'?'Minimax AI':'Waiting…')}</strong><small>{mySymbol==='O'?'YOU':game?.mode==='ai'?'AI OPPONENT':'PLAYER 2'}</small></span></div></div>
   <div className={`status ${result||''} ${myTurn?'mine':''}`} aria-live="polite"><strong>{status()}</strong></div>
   <div className="boardwrap">{result==='win'&&<Confetti/>}
    <div className="board">{(game?.board||Array(9).fill('')).map((v,i)=><button key={i} aria-label={`Cell ${i+1}${v?`, ${v}`:', empty'}`} className={`cell ${v?'filled':''} ${line?.includes(i)?'winning':''} ${myTurn&&!v?'hot':''}`} disabled={!myTurn||Boolean(v)} onClick={()=>move(i)}>{v?<Mark v={v}/>:<small>{i+1}</small>}</button>)}</div></div>
   <div className="gamefoot"><span>{game?.status==='finished'?'Match over. Start a new match from the lobby.':'Moves are validated by the server.'}</span>{game&&<button className={game.status==='finished'?'primary mini':'link'} onClick={leave}>{game.status==='finished'?'New match':'Leave board'}</button>}</div>
  </section></section>}
  <footer>Built with React, Socket.IO & Minimax <span>Made for friendly competition.</span></footer></main>;
}
