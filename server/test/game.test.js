import test from 'node:test';
import assert from 'node:assert/strict';
import {AI,HUMAN,EMPTY,getWinner,isTerminal,findBestMove,validateMove,createInitialGame} from '../src/game.js';
test('detects row winner',()=>assert.equal(getWinner([HUMAN,HUMAN,HUMAN,EMPTY,AI,EMPTY,AI,EMPTY,EMPTY]),HUMAN));
test('detects diagonal winner',()=>assert.equal(getWinner([AI,HUMAN,EMPTY,HUMAN,AI,EMPTY,EMPTY,EMPTY,AI]),AI));
test('recognizes full draw',()=>{const b=[HUMAN,AI,HUMAN,HUMAN,AI,AI,AI,HUMAN,HUMAN];assert.equal(getWinner(b),null);assert.equal(isTerminal(b),true)});
test('AI takes immediate win',()=>assert.equal(findBestMove([AI,AI,EMPTY,HUMAN,HUMAN,EMPTY,EMPTY,EMPTY,EMPTY]),2));
test('AI blocks immediate loss',()=>assert.equal(findBestMove([HUMAN,HUMAN,EMPTY,AI,EMPTY,EMPTY,EMPTY,AI,EMPTY]),2));
test('rejects invalid, occupied, and wrong-turn moves',()=>{const g=createInitialGame({roomCode:'ABC123',mode:'pvp',hostId:'u1',hostName:'X'});g.status='playing';g.players.O={id:'u2',name:'O',connected:true};assert.match(validateMove(g,'u1',9),/integer/);g.board[0]=HUMAN;assert.match(validateMove(g,'u1',0),/occupied/);assert.match(validateMove(g,'u2',1),/not your turn/)});
