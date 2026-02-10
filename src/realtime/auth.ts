import { Socket } from "socket.io";
import REDIS_CLIENT from "../config/redis.js";
import cookie from "cookie"; // You might need to install 'cookie' and '@types/cookie'

export default async function socketAuth(socket: Socket, next: any)
{
  try
  {
    // 1. Get cookies from handshake
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
        return next(new Error("No cookies found"));
    }

    // 2. Parse cookies
    const cookies = cookie.parse(cookieHeader);
    const sessionId = cookies.sessionId;

    if (!sessionId) {
        return next(new Error("Session ID missing"));
    }

    // 3. Validate against Redis
    const sessionKey = `session:${sessionId}`;
    const sessionRaw = await REDIS_CLIENT.get(sessionKey);
    
    if (!sessionRaw) {
        return next(new Error("Session expired or invalid"));
    }

    const sessionData = JSON.parse(sessionRaw);
    
    // 4. Attach user info to socket
    socket.data.user = { id: sessionData.userId };
    
    next();
  }
  catch (err)
  {
    console.error("Socket Auth Error:", err);
    next(new Error("Unauthorized"));
  }
}
