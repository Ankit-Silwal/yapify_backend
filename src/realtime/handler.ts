import { Server, Socket } from "socket.io";
import socketAuth from "./auth";

export default function registerHandlers(io: Server)
{
  io.use(socketAuth);
  io.on("connection", (socket: Socket) =>
  {
    const userId = socket.data.user.id;
    console.log("User connected:", userId);
    socket.join(userId);
    socket.on("disconnect", () =>
    {
      console.log("User offline:", userId);
    });
  });
}
