import pool from "../../config/db.js";
import type { Request, Response } from "express";

export async function sendMessage(
  req: Request,
  res: Response
): Promise<Response> {
  const { conversationId, content, messageType = "text" } = req.body;
  const senderId = req.userId;

  if (!conversationId || !senderId || !content) {
    return res.status(400).json({
      success: false,
      message: "conversationId, senderId and content are required"
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    //checking if the conversation already exists for any of the users
    const memberCheck = await client.query(
      `
      select 1 from conversation_participants
      where conversation_id=$1
      and user_id=$2
      and deleted_at is null
      `,
      [conversationId, senderId]
    );

    if (memberCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "Not authorized"
      });
    }

    const messages = await client.query(
      `
      insert into messages (conversation_id,sender_id,content,message_type)
      values ($1,$2,$3,$4)
      returning *
      `,
      [conversationId, senderId, content, messageType]
    );

    const participants = await client.query(
      `
      select user_id from conversation_participants
      where conversation_id=$1
      and deleted_at is null
      `,
      [conversationId]
    );

    for (const row of participants.rows) {
      await client.query(
        `
        insert into message_status (message_id,user_id,status)
        values ($1,$2,$3)
        `,
        [
          messages.rows[0].id,
          row.user_id,
          row.user_id === senderId ? "read" : "sent"
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "The message was sent",
      data: {
        conversationId,
        data: messages.rows[0]
      }
    });

  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      success: false,
      message: "Failed to send the message",
      error: err instanceof Error ? err.message : "Unknown error"
    });
  } finally {
    client.release();
  }
}

export async function deleteForMe(
  req: Request,
  res: Response
): Promise<Response> {
  const userId = req.userId;
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
  const userId = req.userId;
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
  const userId = req.userId;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Unauthorized"
    });
  }

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
  const userId = req.userId;
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
      success: true,
      message: "There was error retiriveing the data",
      error: err instanceof Error ? err.message : "Unknown error"
    });
  }
}

export async function markAsRead(
  req: Request,
  res: Response
): Promise<Response> {
  const { conversationId } = req.body;
  const userId = req.userId;

  if (!conversationId) {
    return res.status(400).json({
      success: true,
      message: "conversationId is required"
    });
  }

  try {
    await pool.query(
      `
      update message_status ms
      set status='read',
          updated_at=now()
      from messages m
      where ms.message_id=m.id
      and m.conversation_id=$1
      and ms.user_id=$2
      and ms.status!='read'
      and m.sender_id!=$2
      `,
      [conversationId, userId]
    );

    return res.status(200).json({
      success: true,
      message: "Status updated"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err instanceof Error ? err.message : "Unknown error"
    });
  }
}

export async function openConversation(req:Request, res:Response): Promise<Response> {
  const userId = req.userId;
  const { receiverId } = req.body;

  if(!receiverId){
     return res.status(400).json({
      success:false,
      message: "receiverId is required"
     });
  }

  try {
    // Check for existing 1-on-1 conversation
    const result = await pool.query(`
      SELECT c.id
      FROM conversations c
      JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
      WHERE c.is_group = false
      AND cp1.user_id = $1
      AND cp2.user_id = $2
    `, [userId, receiverId]);

    if(result.rowCount && result.rowCount > 0){
      return res.status(200).json({
        success:true,
        conversationId: result.rows[0].id
      });
    }

    // Create new conversation
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const convoResult = await client.query(`
        INSERT INTO conversations (is_group) VALUES (false) RETURNING id
      `);
      const convoId = convoResult.rows[0].id;

      await client.query(`
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES ($1, $2), ($1, $3)
      `, [convoId, userId, receiverId]);

      await client.query("COMMIT");
      return res.status(200).json({
        success:true,
        conversationId: convoId
      });
    } catch(err){
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

  } catch(err) {
     return res.status(500).json({
      success: false,
      message: "Server error",
      error: err instanceof Error ? err.message : "Unknown error"
    });
  }
}

export async function getUnreadCounts(req:Request, res:Response): Promise<Response> {
  const userId = req.userId;
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
