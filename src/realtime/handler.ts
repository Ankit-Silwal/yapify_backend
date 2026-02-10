import { Server, Socket } from "socket.io";
import socketAuth from "./auth.ts";
import { createMessage, markConversationRead } from "../modules/users/messageService.ts";
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

    // Join user-specific room for notifications
    socket.join(userId);

    result.rows.forEach(row =>
    {
      socket.join(row.conversation_id);
    });

    socket.on("conversation:join", (conversationId) => {
        console.log(`User ${userId} joining conversation ${conversationId}`);
        socket.join(conversationId);
    });

    socket.on("message:send", async (payload) =>
    {
      try
      {
        console.log(`Received message from ${userId}:`, payload);
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

        io.to(payload.conversationId).emit("message:new", message);
      }
      catch(err:any)
      {
        console.error("Message Send Error:", err);
        socket.emit("message:error", {
          tempId: payload.tempId,
          message: err.message
        });
      }
    });

    socket.on("conversation:markRead", async (payload) => {
      try {
        await markConversationRead(userId, payload.conversationId);
        io.to(payload.conversationId).emit("conversation:read", {
          conversationId: payload.conversationId,
          userId,
          readAt: new Date()
        });
      } catch (err) {
        console.error("Error marking read via socket:", err);
      }
    });

    socket.on("disconnect", () =>
    {
      console.log("offline:", userId);
    });
  });
}
