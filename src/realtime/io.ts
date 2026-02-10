import { Server } from "socket.io";
import http from "http"
 
let io:Server

export const initSocket=(server:http.Server)=>{
  io=new Server(server,{
    cors:{
      origin:"http://localhost:3000",
      credentials:true
    }
  })
  return io
}

export const getIo=()=>io;