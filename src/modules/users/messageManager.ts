import pool from "../../config/db.js";
import type { Request, Response } from "express";
import { createMessage } from "./messageService.ts";

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
