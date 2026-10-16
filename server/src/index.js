import 'dotenv/config';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import pg from 'pg';
import { AI, HUMAN, applyMove, createInitialGame, findBestMove, validateMove } from './game.js';

const PORT=Number(process.env.PORT||3001);
const SECRET=process.env.JWT_SECRET||'local-development-secret-change-this';
const ORIGIN=process.env.CLIENT_ORIGIN||'http://localhost:5173';
const redisUrl=process.env.REDIS_URL||'redis://localhost:6379';
const dbUrl=process.env.DATABASE_URL||'postgres://game:change-me@localhost:5432/tictactoe';
const TTL=43200;
const app=express(); app.use(cors({origin:ORIGIN})); app.use(express.json());
const pool=new pg.Pool({connectionString:dbUrl,max:10});
const redis=new Redis(redisUrl,{maxRetriesPerRequest:null});
const pub=new Redis(redisUrl,{maxRetriesPerRequest:null}); const sub=pub.duplicate();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:ORIGIN,methods:['GET','POST']},transports:['websocket','polling'],pingInterval:25000,pingTimeout:20000});
io.adapter(createAdapter(pub,sub));
const rkey=code=>`ttt:room:${code}`; const lkey=code=>`ttt:lock:${code}`;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function guest(){const userId=crypto.randomUUID();return {userId,token:jwt.sign({sub:userId},SECRET,{expiresIn:'30d'}),displayName:`Guest-${userId.slice(0,5)}`};}
function code(){return crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();}
function publicGame(g){const {persisted,...safe}=g;return safe;}
async function getGame(c){const v=await redis.get(rkey(c));return v&&v!=='__creating__'?JSON.parse(v):null;}
async function saveGame(g){g.updatedAt=new Date().toISOString();await redis.set(rkey(g.roomCode),JSON.stringify(g),'EX',TTL);}
async function lock(c,fn){if(!/^[A-Z0-9]{6}$/.test(c))throw new Error('Invalid room code.');const key=lkey(c),id=crypto.randomUUID();let ok=false;
 for(let i=0;i<80;i++){if(await redis.set(key,id,'PX',5000,'NX')==='OK'){ok=true;break;}await delay(25);}
 if(!ok)throw new Error('Room is busy. Please retry.');
 try{return await fn();}finally{await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",1,key,id);}}
async function emitGame(g){io.to(g.roomCode).emit('game:state',publicGame(g));}
async function persist(g){if(g.status!=='finished'||g.persisted)return;g.persisted=true;await saveGame(g);
 try{await pool.query('INSERT INTO matches(room_code,mode,player_x,player_o,winner,final_board) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[g.roomCode,g.mode,g.players.X?.id||'unknown',g.players.O?.id||'unknown',g.winner,JSON.stringify(g.board)]);}
 catch(e){g.persisted=false;await saveGame(g);console.error('Match history insert failed:',e.message);}}
async function doAiMove(c){await lock(c,async()=>{const g=await getGame(c);if(!g||g.mode!=='ai'||g.status!=='playing'||g.currentTurn!==AI)return;const cell=findBestMove([...g.board]);if(cell===null)return;applyMove(g,AI,cell);await saveGame(g);await emitGame(g);await persist(g);});}
app.get('/health',async(_req,res)=>{try{await redis.ping();await pool.query('SELECT 1');res.json({ok:true,redis:'ok',postgres:'ok'});}catch(e){res.status(503).json({ok:false,error:e.message});}});
app.post('/api/guest',(_req,res)=>res.json(guest()));
app.get('/api/matches',async(req,res)=>{try{const n=Math.min(100,Math.max(1,Number(req.query.limit)||20));const q=await pool.query('SELECT id,room_code AS "roomCode",mode,winner,final_board AS board,finished_at AS "finishedAt" FROM matches ORDER BY finished_at DESC LIMIT $1',[n]);res.json(q.rows);}catch(e){console.error(e);res.status(500).json({error:'Could not load match history.'});}});
io.use((socket,next)=>{try{const p=jwt.verify(socket.handshake.auth?.token||'',SECRET);socket.data.userId=p.sub;socket.data.displayName=`Guest-${String(p.sub).slice(0,5)}`;next();}catch{next(new Error('Invalid or missing guest token. Refresh the page.'));}});
io.on('connection',socket=>{
 const userId=socket.data.userId,name=socket.data.displayName;
 socket.on('room:create',async(payload={},ack=()=>{})=>{try{const mode=payload.mode==='ai'?'ai':'pvp';let c,g;
  for(let i=0;i<8;i++){c=code();if(await redis.set(rkey(c),'__creating__','EX',5,'NX')==='OK')break;c=null;}
  if(!c)throw new Error('Could not allocate a room. Try again.');g=createInitialGame({roomCode:c,mode,hostId:userId,hostName:name});await saveGame(g);socket.join(c);ack({ok:true,roomCode:c,game:publicGame(g)});await emitGame(g);
 }catch(e){ack({ok:false,error:e.message});}});
 socket.on('room:join',async(payload={},ack=()=>{})=>{const c=String(payload.roomCode||'').trim().toUpperCase();try{const g=await lock(c,async()=>{const x=await getGame(c);if(!x)throw new Error('Room not found or expired.');if(x.mode!=='pvp')throw new Error('This is not a PvP room.');if(x.status==='finished')throw new Error('This game has finished.');const existing=['X','O'].find(s=>x.players[s]?.id===userId);if(existing)x.players[existing].connected=true;else{if(x.players.O)throw new Error('Room is full.');x.players.O={id:userId,name,connected:true};x.status='playing';}await saveGame(x);return x;});socket.join(c);ack({ok:true,game:publicGame(g)});await emitGame(g);}catch(e){ack({ok:false,error:e.message});}});
 socket.on('room:reconnect',async(payload={},ack=()=>{})=>{const c=String(payload.roomCode||'').trim().toUpperCase();try{const g=await lock(c,async()=>{const x=await getGame(c);if(!x)throw new Error('Room not found or expired.');const s=['X','O'].find(v=>x.players[v]?.id===userId);if(!s)throw new Error('This guest identity does not belong to this room.');x.players[s].connected=true;await saveGame(x);return x;});socket.join(c);ack({ok:true,game:publicGame(g)});await emitGame(g);}catch(e){ack({ok:false,error:e.message});}});
 socket.on('game:move',async(payload={},ack=()=>{})=>{const c=String(payload.roomCode||'').trim().toUpperCase();try{const g=await lock(c,async()=>{const x=await getGame(c);if(!x)throw new Error('Room not found or expired.');const s=['X','O'].find(v=>x.players[v]?.id===userId);if(!s)throw new Error('You are not a player in this room.');const err=validateMove(x,userId,payload.cell);if(err)throw new Error(err);applyMove(x,s,payload.cell);await saveGame(x);await emitGame(x);await persist(x);return x;});ack({ok:true,game:publicGame(g)});if(g.mode==='ai'&&g.status==='playing'&&g.currentTurn===AI)setTimeout(()=>doAiMove(c).catch(e=>console.error('AI move failed:',e.message)),100);}catch(e){ack({ok:false,error:e.message||'Move rejected.'});}});
 socket.on('disconnect',async()=>{try{const rooms=[...socket.rooms].filter(r=>r!==socket.id);for(const c of rooms)await lock(c,async()=>{const g=await getGame(c);if(!g)return;const s=['X','O'].find(v=>g.players[v]?.id===userId);if(!s)return;const sockets=await io.in(c).fetchSockets();if(!sockets.some(other=>other.id!==socket.id&&other.data.userId===userId)){g.players[s].connected=false;await saveGame(g);await emitGame(g);}});}catch(e){console.error('Disconnect handling failed:',e.message);}});
});
async function start(){await pool.query('SELECT 1');await redis.ping();server.listen(PORT,'0.0.0.0',()=>console.log(`Tic-Tac-Toe API listening on ${PORT}`));}
start().catch(e=>{console.error('Startup failed:',e);process.exit(1);});
