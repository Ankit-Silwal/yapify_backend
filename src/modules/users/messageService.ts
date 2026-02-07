import pool from "../../config/db.ts";

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
      AND deleted_at IS NULL
    `,[conversationId,senderId]);

    if(memberCheck.rowCount === 0)
      throw new Error("NOT_MEMBER");

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
