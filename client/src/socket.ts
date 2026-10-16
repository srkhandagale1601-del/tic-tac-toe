import {io} from 'socket.io-client';
export const apiUrl=import.meta.env.VITE_API_URL||'http://localhost:3001';
export const socket=io(apiUrl,{autoConnect:false,transports:['websocket','polling'],reconnection:true,reconnectionAttempts:8,reconnectionDelay:500,reconnectionDelayMax:4000});
