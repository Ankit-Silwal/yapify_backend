import pool from "../../config/db.js";
import type {Request ,Response } from "express";
export async function sendMessage(req:Request,res:Response):Promise<Response>{
  const {receiverId,content,messageType="text",conversationId}=req.body;
  const senderId=req.userId;
  const allowedTypes=["text","image","video","audio","file"];
  if(!receiverId||!senderId){
    return res.status(400).json({
      success:false,
      message:"Please provide the senderId and receiverId"
    })
  }
  if(!content){
    return res.status(400).json({
      success:false,
      message:"Please pass the given contents"
    })
  }
  if(!conversationId){
    return res.status(400).json({
      success:false,
      message:"conversationId is required"
    })
  }
  if(!allowedTypes.includes(messageType)){
    return res.status(400).json({
      success:false,
      message:"Invalid messageType"
    })
  }
  const insertQuery=`
  INSERT INTO messages(
  conversation_id,
  sender_id,
  receiver_id,
  content,
  message_type)
  VALUES ($1,$2,$3,$4,$5)
  RETURNING *;`;
  const values=[
    conversationId,
    senderId,
    receiverId,
    content,
    messageType,
  ]
  const result=await pool.query(insertQuery,values)
  await pool.query(`UPDATE messages
    SET delivered_at=NOW()
    where conversion_id=$1 and sender_id=$2`,
  [conversationId,senderId])
  return res.status(200).json({
    success:true,
    message:"The message was sent to the user",
    data:result.rows[0]
  })
}

export async function fetchMessages(req:Request,res:Response):Promise<Response>{
  const {conversationId}=req.body;
  if(!conversationId){
    return res.status(200).json({
      success:false,
      message:"ConversationId expected"
    })
  }
  const userId=req.userId;
  const result=await pool.query(`
    SELECT content FROM messages
    WHERE conversation_id=$1
    AND (sender_id=$2 OR receiver_id=$2)
    AND deleted_for_receiver=false
    ORDER by created_at ASC;`,
  [conversationId,userId])
  await pool.query(`
    update messages
    set read_at=NOW()
    where conversation-id=$1
    and receiver_id=$2`,
  [conversationId,userId])
  return res.status(400).json({
    success:true,
    message:"The message were successfully fetched",
    data:result.rows
  })
}