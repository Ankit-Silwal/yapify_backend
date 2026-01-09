import pool from "../../config/db.js";
import type { Request, Response } from "express";

export async function sendMessage(
  req: Request,
  res: Response
): Promise<Response> {
  const {receiverId,content,messageType="text"}=req.body;
  const senderId=req.userId;
  if(!receiverId|| !senderId||!content){
    return res.status(400).json({
      success:false,
      message:"receiverId,senderId and content are required"
    })
  }
  const client=await pool.connect();
  try{
    await client.query("BEGIN");

    //checking if the conversation already exists for any of the users

    const conversationResult=await client.query(
      `
      select c.id from conversations c
      join conversation_participants cp1
      on c.id=cp1.conversation_id
      join conversation_participants cp2
      on c.id=cp2.conversation_id
      where cp1.user_id=$1
      and cp2.user_id=$2
      and c.is_group=false
      limit 1;
      `,
      [senderId,receiverId]
    );

    //if the conversation doesnt exists create it
    let conversationId:string
    if(conversationResult.rowCount==0){
      const newConversation=await client.query(
        `
        insert into conversations(is_group)
        values (false)
        returning id
        `
      );
      conversationId=newConversation.rows[0].id
      await client.query(
        `
        insert into conversation_participants (conversation_id,user_id)
        values ($1,$2),($1,$3)`,
        [conversationId,senderId,receiverId]
      )
    }else{
      conversationId=conversationResult.rows[0].id;
    }

    const messages=await client.query(
      `insert into messages (conversation_id,sender_id,content,message_type)
      values ($1,$2,$3,$4)
      returning *`,
      [conversationId,senderId,content,messageType]
    );
    await client.query("COMMIT");
    return res.status(200).json({
      success:true,
      message:"The message was sent",
      data:{
        conversationId:conversationId,
        data:messages.rows[0]
      }
    })
  }catch(err){
    await client.query("ROLLBACK")
    return res.status(500).json({
      success:false,
      message:"Failed to send the message",
      error:err instanceof Error ? err.message : "Unknown error"
    });
  }finally{
    client.release();
  }
}
