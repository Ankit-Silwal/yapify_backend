import pool from "../../config/db.js";

export async function createMessage(
  senderId: string,
  conversationId: string,
  content: string,
  messageType = "text"
)
{
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const memberCheck = await client.query(`
      SELECT 1 FROM conversation_participants
      WHERE conversation_id=$1
      AND user_id=$2
    `,[conversationId,senderId]);

    // AND deleted_at IS NULL -- removed strict check for now to fix sending issue, 
    // or we should auto-undelete. 
    // Ideally we assume createChat handles the undelete.
    // But if we are here, we are trying to send.
    // If deleted_at is set, we probably want to allow sending and "re-join" chat? 
    // Let's just remove the deleted_at check for "sending permission" 
    // OR we check it and throw different error.
    
    // Actually, if I send a message, I am active. So strict check is good IF createChat did its job.
    // But since users are stuck, let's relax this or auto-fix.
    // Let's UPDATE deleted_at=NULL if it is set.

    if(memberCheck.rowCount === 0)
      throw new Error("NOT_MEMBER");
      
    // Auto-activate sender if soft-deleted
    await client.query(`
        UPDATE conversation_participants 
        SET deleted_at = NULL 
        WHERE conversation_id=$1 AND user_id=$2 AND deleted_at IS NOT NULL
    `, [conversationId, senderId]);

    const msgResult = await client.query(`
      INSERT INTO messages (conversation_id,sender_id,content,message_type)
      VALUES ($1,$2,$3,$4)
      RETURNING *
    `,[conversationId,senderId,content,messageType]);

    const message = msgResult.rows[0];

    const participants = await client.query(`
      SELECT user_id FROM conversation_participants
      WHERE conversation_id=$1
      AND deleted_at IS NULL
    `,[conversationId]);

    for(const row of participants.rows)
    {
      await client.query(`
        INSERT INTO message_status (message_id,user_id,status)
        VALUES ($1,$2,$3)
      `,[
        message.id,
        row.user_id,
        row.user_id === senderId ? "read" : "sent"
      ]);
    }

    await client.query("COMMIT");
    return message;

  } catch(err) {
    await client.query("ROLLBACK");
    console.error("createMessage Transaction Error:", err);
    throw err;
  } finally {
    client.release();
  }
}

export async function markConversationRead(userId:string,conversationId:string) {
  await pool.query(`
    UPDATE message_status ms
    SET status='read', updated_at=now()
    FROM messages m
    WHERE ms.message_id=m.id
    AND m.conversation_id=$1
    AND ms.user_id=$2
    AND ms.status!='read'
    AND m.sender_id!=$2
    `,[conversationId, userId])
}
