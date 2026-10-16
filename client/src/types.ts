export type Mark='X'|'O'|''; export type Mode='pvp'|'ai';
export interface Player {id:string;name:string;connected:boolean}
export interface Game {roomCode:string;mode:Mode;board:Mark[];currentTurn:'X'|'O';status:'waiting'|'playing'|'finished';winner:'X'|'O'|'draw'|null;players:{X:Player|null;O:Player|null};createdAt:string;updatedAt:string}
export interface Ack {ok:boolean;error?:string;roomCode?:string;game?:Game}
export interface Identity {userId:string;token:string;displayName:string}
