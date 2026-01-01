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
  const rows=await pool.query(insertQuery,values)
  return res.status(200).json({
    success:true,
    message:"The message was sent to the user"
  })

}