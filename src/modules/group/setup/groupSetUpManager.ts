import pool from "../../../config/db.js"
import type { Request,Response } from "express"
export async function createGroup(
  req: Request,
  res: Response
): Promise<Response> {

  const { memberIds } = req.body; // array of userIds
  const creatorId = req.userId;

  if (!creatorId || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "memberIds array is required"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const convoResult = await client.query(
      `
      INSERT INTO conversations (is_group)
      VALUES (true)
      RETURNING id;
      `
    );

    const conversationId = convoResult.rows[0].id;
    // Prepare participants
    const uniqueUserIds = Array.from(
      new Set([creatorId, ...memberIds])
    );
    const values: any[] = [];
    let paramIndex = 1;
    const placeholders = uniqueUserIds
      .map((userId) => {
        const role = userId === creatorId ? "admin" : "member";
        values.push(conversationId, userId, role);
        const p = `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`;
        paramIndex += 3;
        return p;
      })
      .join(",");

    // Inserting thre participants with roles
    await client.query(
      `
      INSERT INTO conversation_participants
        (conversation_id, user_id, role)
      VALUES ${placeholders};
      `,
      values
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      conversationId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createGroup error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create group"
    });
  } finally {
    client.release();
  }
}

export async function removeFromGroup(req:Request,res:Response):Promise<Response>{
  const userId=req.userId;
  const {conversationId,userIdToRemove}=req.body;
  if(!userIdToRemove || !conversationId){
    return res.status(400).json({
      success:false,
      message:"Please provide conversationId and userIdToRemove"
    })
  }
  const adminCheck=await pool.query(
    `
    select role
    from conversation_participants
    where id=$1
    and user_id=$2;
    `,
    [conversationId,userId]
  )
  if(adminCheck.rowCount==0||adminCheck.rows[0].role!=="admin"){
    return res.status(400).json({
      success:false,
      message:"Only admin are authorized for this task"
    })
  }
  //delteing finnally
  const result=await pool.query(
    `
    delete from conversation_participants
    where conversation_id=$1
    and user_id=$2;
    `,
    [conversationId,userIdToRemove]
  )
  if(result.rowCount==0){
    return res.status(400).json({
      success:false,
      message:"User wasnt found in the group"
    })
  }
  return res.status(200).json({
    success:true,
    message:"The user was removed"
  })
}

export async function giveAdmin(req:Request,res:Response):Promise<Response>{
  const userId=req.userId;
  const {conversationId,otherUserId}=req.body;
  if(!conversationId|| !otherUserId){
    return res.status(400).json({
      success:false,
      message:"conversationId and otherUserId required"
    })
  }
  const checkAdmin=await pool.query(
    `
    select role from conversation_participants
    where conversation_id=$1
    and user_id=$2;
    `,
    [conversationId,userId]
  )
  if(checkAdmin.rowCount==0||checkAdmin.rows[0].role!=="admin"){
    return res.status(400).json({
      success:true,
      message:"Not authorized only for admin"
    })
  }
  const result=await pool.query(
    `
    update conversation_participants
    set role="admin"
    where conversation_id=$1
    and user_id=$2;
    `,
    [conversationId,otherUserId]
  )
  if(result.rowCount==0){
    return res.status(400).json({
      success:false,
      message:"User doesnt exist"
    })
  }
  return res.status(200).json({
    success:true,
    message:"Succefully made him admin"
  })
}

export async function leaveGroup(req:Request,res:Response):Promise<Response>{
  const userId=req.userId;
  const conversationId=req.body;
  //checking if the conversation have only a admin if let not process it
  if(!conversationId){
    return res.status(400).json({
      success:false,
      message:"Please provide the conversationId"
    })
  }
  const check=await pool.query(`
    select role from conversation_participants
    where role='admin'
    and conversation_id=$1
    and user_id!=$2;
    `,[conversationId,userId]);
  if(check.rowCount==0){
    return res.status(400).json({
      success:false,
      message:"Only one admin please pass a admin"
    })
  }
  const leaveResult=await pool.query(`
    delete from conversation_participants
    where conversation_id=$1,
    and user_id=$2;
    `,[conversationId,userId])
  if(leaveResult.rowCount==0){
    return res.status(400).json({
      success:false,
      message:"You arent the part of this group"
    })
  }
  return res.status(200).json({
    success:true,
    message:"Successfully left the group"
  })
}

export async function kickFromGroup(req:Request,res:Response):Promise<Response>{
  const userId=req.userId;
  const {conversationId,otherUserId}=req.body;
  if(!conversationId || !otherUserId){
    return res.status(400).json({
      success:false,
      message:"conversationId and otherUserId is required"
    })
  }
  if(userId===conversationId){
    return res.status(400).json({
      success:false,
      message:"You cannt kic yourself from the group common sir"
    })
  }
  const checkYourRole=await pool.query(
    `
    select role from conversation_participants
    where conversation_id=$1
    and user_id=$2
    and role='admin';
    `,[conversationId,userId]
  )
  if(checkYourRole.rowCount==0){
    return res.status(400).json({
      success:false,
      message:"You arent authorized for this task"
    })
  }
  const checkOtherUserRole=await pool.query(
    `
    select role from conversation_participants
    where conversation_id=$1
    and user_id=$2
    and role='admin';
    `,
  [conversationId,otherUserId]
  );
  if(checkOtherUserRole.rowCount!=0){
    return res.status(400).json({
      success:false,
      message:"You cannt kick admin from his own page"
    })
  }
  const result=await pool.query(
    `
    delete from conversation_participants
    where conversation_id=$1
    and user_id=$2
    and role='member';
    `,
    [conversationId,otherUserId]
  )
  if(result.rowCount==0){
    return res.status(400).json({
      success:false,
      message:"The user doesnt exist in the group"
    })
  }
  return res.status(200).json({
    success:true,
    message:"Successfully kicked the member from the group"
  })

}