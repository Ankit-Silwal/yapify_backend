
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

export async function deleteForMe(req:Request,res:Response):Promise<Response>{
  const userId=req.userId;
  const {messageId}=req.body;
  if(!messageId){
    return res.status(400).json({
      success:false,
      message:"Please provide the messageId"
    })
  }
  const result=await pool.query(
    `
    update messages
    set deleted_for_sender=true
    where id=$1 and sender_id=$2`,
    [messageId,userId]
  )
  if(result.rowCount===0){
    return res.status(400).json({
      success:false,
      message:"Not authorized to delete this message"
    })
  }
  return res.status(200).json({
    success:true,
    message:"Hence the message was deleted for you"
  })
}

export async function deleteForEveryOne(req:Request,res:Response):Promise<Response>{
  const userId=req.userId;
  const {messageId}=req.body;
  if(!messageId){
    return res.status(400).json({
      success:false,
      message:"Please provide the message Id"
    })
  }
  const result=await pool.query(`
    update messages
    set deleted_for_everyone=true
    where id=$1 and sender_id=$2`,
  [messageId,userId])
  if(result.rowCount===0){
    return res.status(400).json({
      success:false,
      message:"You arent authorized for the given action"
    })
  }

  return res.status(200).json({
    success:true,
    message:"The message was succusfully deleted now"
  })
}

export async function loadChatList(req:Request,res:Response):Promise<Response>{
  const userId=req.userId;

  if(!userId){
    return res.status(400).json({
      success:false,
      message:"Unauthorized"
    })
  }
  try{
    const result=await pool.query(
      `
      select * from (
      select distinct on (m.conversation_id)
      m.conversation_id,
      m.id as message_id,
      m.content,
      m.sender_id,
      m.message_type,
      m.created_at
      from conversation participants cp
      join messages m
      on m.conversation_id=cp.cp.conversation_id
      where cp.user_id=$1
      and cp.deleted_at is null
      order by m.conversation_id,m.created_at desc)
      t 
      order by created_at desc;
      )`,
      [userId]
    )
    return res.status(200).json({
      success:true,
      message:"All the messages were retrived",
      data:result.rows
    })
  }catch(err){
    return res.status(400).json({
      success:false,
      message:"There was an error on that process",
      error:err instanceof Error ? err.message : "Unknown error"
    })
  }
}

export async function loadMessage(req:Request,res:Response):Promise<Response>{ 
  const userId=req.userId;
  const {conversationId}=req.body;
  if(!conversationId || !userId){
    return res.status(400).json({
      success:false,
      message:"ConversationId and userId are required"
    })
  }
  try{
    const results=await pool.query(
      `
      select 
      m.id,
      m.conversation_id,
      m.sender_id,
      m.message_type,
      m.created_at,
      case
        when m.deleted_for_everyone=true
        then "Message was deleted for everyone"
        else
          m.content
        end as content
        from messages m
        join conversation_participants cp
        on cp.conversation_id=m.conversation_id
        where m.conversation_id=$1
        and cp.user_id=$2
        and cp.is_deleted is null
        and m.deleted_for_sender =false
        order by m.created_at asc;
      `,
      [conversationId,userId]
    )
    return res.status(200).json({
      success:true,
      message:"Hence the messages were retrieved",
      data:results.rows
    })
  }catch(err){
    return res.status(400).json({
      success:true,
      message:"There was error retiriveing the data",
      error:err instanceof Error ? err.message : "Unknown error"
    })
  }
}