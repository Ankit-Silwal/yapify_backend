import pool from "../../config/db.ts";
export async function createMessage(
  senderId:string,
  conversationId:string,
  content:string,
  messageType="text"
){
  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    const memberCheck=await client.query(`
      Select 1 from coversation_participants
      where conversation_id=$1
      and user_id=$2
      and deleted_at is NULL`
    ,[conversationId,senderId]);
    
    if(memberCheck.rowCount===0)
      throw new Error("NOT_MEMBER");
    const msgResult=await client.query(`
    insert into messages (conversation_id,sender_id,content,message_type)
    values ($1,$2,$3,$4)`,
    [conversationId,senderId,content,messageType]);
    const message=msgResult.rows[0];
    const participants=await client.query(`
      select user_id from conversation_participants
      where conversation_id=$1
      and deleted_at is null`,[conversationId]);
    for(const row of participants.rows){
      await client.query(`
        insert into message_status (message_id,user_id,status)
        values($1,$2,$3)
        `,[message.id,row.user.id,row.user_id===senderId?"read":"sent"])
    }
    await client.query("COMMIT");
    return message;
  }catch(err){
    await client.query("ROLLBACK");
    throw err;
  }finally{
    client.release();
  }

}