import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import pool from "../../config/db.js";
import { checkStrongPassword } from "../../utils/strongpassword.js";
import { createSession } from "./sessionManager.js";

type checkPasswordResult={
  isStrong:boolean,
  errors:string[]
}
export const registerUsers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, password, conformPassword } = req.body as {
    email?: string;
    password?: string;
    conformPassword?: string;
  };
  if(!email || !password || !conformPassword ){
    return res.status(400).json({
      success:false,
      message:"Please provide the all the required credentials as email,password and conformPassword"
    })
  }
  if(password!==conformPassword){
    return res.status(400).json({
      success:false,
      message:"The passwords didn't match with each other"
    })
  }
  const checkPassword = checkStrongPassword(password);
  if (!checkPassword.isStrong) {
    return res.status(400).json({
      success:false,
      message: checkPassword.errors.join(",")
    })
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
  const result = await pool.query(
    `
    INSERT INTO users (email, password_hash)
    VALUES ($1, $2)
    RETURNING id, email
    `,
    [email, hashedPassword]
  );
  return res.status(201).json({
    success: true,
    data: result.rows[0]
  });

} catch (err:any) {
  if (err)
    return res.status(409).json({
      success: false,
      message: "Email already exists"
    });
  }
  return res.status(400).json({
    success:false,
    message:"Unexpected Error sire"
  })
}

export const loginUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if(!email || !password){
    return res.status(400).json({
      success:false,
      message:"Please provide both the email and the password"
    })
  }
  const result=await pool.query(
    `SELECT id,email,password_hash
    FROM users
    WHERE email=$1`,
    [email]
  )
  if(result.rows.length===0){
    return res.status(400).json({
      success:false,
      message:"Invalid email or password "
    })
  }
  const user=result.rows[0];
  const isMatch=await bcrypt.compare(password,user.password_hash);
  if(!isMatch){
    return res.status(400).json({
      success:false,
      message:"The password didn't match"
    })
  }
  const sessionId = await createSession(String(user.id), req);
  res.cookie('sessionId',sessionId,{
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"strict",
    maxAge:24*60*60*1000
  })
  return res.status(200).json({
    success:true,
    message:"Successfully logged in:)",
    user:{
      id:user.id,
      email:user.email
    }
  })
}