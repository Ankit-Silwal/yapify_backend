import { Server, Socket } from "socket.io";
import socketAuth from "./auth.ts";
import { createMessage } from "../modules/users/messageService.ts";
import pool from "../config/db.ts";

export default function registerHandlers(io: Server)
{
  io.use(socketAuth);

  io.on("connection", async (socket: Socket) =>
  {
    const userId = socket.data.user.id;
    console.log("connected:", userId);

    const result = await pool.query(`
      SELECT conversation_id
      FROM conversation_participants
      WHERE user_id=$1
      AND deleted_at IS NULL
    `,[userId]);

    result.rows.forEach(row =>
    {
      socket.join(row.conversation_id);
    });

    socket.on("message:send", async (payload) =>
    {
      try
      {
        const message = await createMessage(
          userId,
          payload.conversationId,
          payload.content,
          payload.messageType
        );

        // 1️ACK sender
        socket.emit("message:ack", {
          tempId: payload.tempId,
          messageId: message.id
        });

        // 2 SEND TO ALL IN CONVERSATION
        io.to(payload.conversationId).emit("message:new", message);
      }
      catch(err:any)
      {
        socket.emit("message:error", {
          tempId: payload.tempId,
          message: err.message
        });
      }
    });

    socket.on("disconnect", () =>
    {
      console.log("offline:", userId);
    });
  });
}
