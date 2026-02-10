import pool from "../../config/db.js";
import type { Request, Response } from "express";
import { createMessage, markConversationRead } from "./messageService.ts";
import { getIo } from "../../realtime/io.js";

export async function sendMessage(req: Request, res: Response)
{
  try {
    const { conversationId, content, messageType } = req.body;
    const senderId = req.userId!;
    const message = await createMessage(
      senderId,
      conversationId,
      content,
      messageType
    );

    return res.json({ success:true, data:message });

  } catch(err:any){

    if(err.message === "NOT_MEMBER")
      return res.status(403).json({ success:false, message:"Not authorized" });

    return res.status(500).json({ success:false });
  }
}

export async function deleteForMe(
  req: Request,
  res: Response
): Promise<Response> {
  const userId = req.userId!;
  const { messageId } = req.body;

  if (!messageId) {
    return res.status(400).json({
      success: false,
      message: "Please provide the messageId"
    });
  }

  const result = await pool.query(
    `
    update messages
    set deleted_for_sender=true
    where id=$1
    and sender_id=$2
    `,
    [messageId, userId]
  );

  if (result.rowCount === 0) {
    return res.status(400).json({
      success: false,
      message: "Not authorized to delete this message"
    });
  }

  return res.status(200).json({
    success: true,
    message: "Hence the message was deleted for you"
  });
}

export async function deleteForEveryOne(
  req: Request,
  res: Response
): Promise<Response> {
  const userId = req.userId!;
  const { messageId } = req.body;

  if (!messageId) {
    return res.status(400).json({
      success: false,
      message: "Please provide the message Id"
    });
  }

  const result = await pool.query(
    `
    update messages
    set deleted_for_everyone=true
    where id=$1
    and sender_id=$2
    `,
    [messageId, userId]
  );

  if (result.rowCount === 0) {
    return res.status(400).json({
      success: false,
      message: "You arent authorized for the given action"
    });
  }

  return res.status(200).json({
    success: true,
    message: "The message was succusfully deleted now"
  });
}

export async function loadChatList(
  req: Request,
  res: Response
): Promise<Response> {
  const userId = req.userId!;

  try {
    const result = await pool.query(
      `
      select *
      from (
        select distinct on (m.conversation_id)
          m.conversation_id,
          m.id as message_id,
          m.content,
          m.sender_id,
          m.message_type,
          m.created_at
        from conversation_participants cp
        join messages m
        on m.conversation_id=cp.conversation_id
        where cp.user_id=$1
        and cp.deleted_at is null
        order by m.conversation_id,m.created_at desc
      ) t
      order by created_at desc;
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: "All the messages were retrived",
      data: result.rows
    });

  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "There was an error on that process",
      error: err instanceof Error ? err.message : "Unknown error"
    });
  }
}

export async function loadMessage(
  req: Request,
  res: Response
): Promise<Response> {
  const userId = req.userId!;
  const { conversationId } = req.body;

  if (!conversationId || !userId) {
    return res.status(400).json({
      success: false,
      message: "ConversationId and userId are required"
    });
  }

  try {
    const results = await pool.query(
      `
      select
        m.id,
        m.conversation_id,
        m.sender_id,
        m.message_type,
        m.created_at,
        case
          when m.deleted_for_everyone=true
          then 'Message was deleted for everyone'
          else m.content
        end as content
      from messages m
      join conversation_participants cp
      on cp.conversation_id=m.conversation_id
      where m.conversation_id=$1
      and cp.user_id=$2
      and cp.deleted_at is null
      and not (
        m.sender_id=$2
        and m.deleted_for_sender=true
      )
      order by m.created_at asc;
      `,
      [conversationId, userId]
    );

    return res.status(200).json({
      success: true,
      message: "Hence the messages were retrieved",
      data: results.rows
    });

  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "There was error retrieving the data",
      error: err instanceof Error ? err.message : "Unknown error"
    });
  }
}

export async function getUnreadCounts(req:Request, res:Response): Promise<Response> {
  const userId = req.userId!;
  try {
     const result = await pool.query(`
      SELECT m.conversation_id, COUNT(*) as unread_count
      FROM messages m
      JOIN message_status ms ON m.id = ms.message_id
      WHERE ms.user_id = $1
      AND ms.status != 'read'
      GROUP BY m.conversation_id
     `, [userId]);

     return res.status(200).json({
      success: true,
      data: result.rows
     });
  } catch(err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err instanceof Error ? err.message : "Unknown error"
    });
  }
}

export async function markAsRead(req: Request, res: Response) {
  const userId = req.userId!;
  const { conversationId } = req.body;

  if (!conversationId) {
    return res.status(400).json({ success: false, message: "ConversationId is required" });
  }

  try {
    await markConversationRead(userId, conversationId);
    
    // Notify realtime users
    const io = getIo();
    if (io) {
      io.to(conversationId).emit("conversation:read", {
        conversationId,
        userId,
        readAt: new Date() 
      });
    }

    return res.json({ success: true, message: "Marked as read" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function createChat(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { partnerId } = req.body;

    if (!partnerId) {
      return res.status(400).json({ success: false, message: "Partner ID required" });
    }

    // Check existing
    const existing = await pool.query(`
       SELECT c.id 
       FROM conversations c
       JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
       JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
       WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.is_group = false
       LIMIT 1
    `, [userId, partnerId]);

    let conversationId: string;

    if (existing.rowCount && existing.rowCount > 0) {
        conversationId = existing.rows[0].id;
    } else {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const resConv = await client.query("INSERT INTO conversations (is_group) VALUES (false) RETURNING id");
            conversationId = resConv.rows[0].id;
            await client.query("INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES ($1, $2, 'member'), ($1, $3, 'member')", [conversationId, userId, partnerId]);
            await client.query('COMMIT');
        } catch(e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    const userRes = await pool.query("SELECT email FROM users WHERE id = $1", [partnerId]);
    const partnerEmail = userRes.rows[0]?.email || 'User';

    // Return compatible with ConversationItem
    return res.status(200).json({
        conversation_id: conversationId,
        message_id: 'START-' + Date.now(),
        content: 'Start a conversation',
        sender_id: userId,
        message_type: 'system',
        created_at: new Date().toISOString(),
        name: partnerEmail,
        is_group: false
    });

  } catch (err: any) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
  }
}
