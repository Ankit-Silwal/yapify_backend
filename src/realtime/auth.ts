import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
export default function socketAuth(socket: Socket, next: any)
{
  try
  {
    const token = socket.handshake.auth.token;
    if(!token) throw new Error("Token not provided");
    const user = jwt.verify(token, process.env.JWT_SECRET!);
    socket.data.user = user;
    next();
  }
  catch
  {
    next(new Error("Unauthorized"));
  }
}
