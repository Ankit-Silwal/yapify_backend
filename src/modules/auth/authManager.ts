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
): Promise<void> => {
  const { email, password, conformPassword } = req.body as {
    email?: string;
    password?: string;
    conformPassword?: string;
  };

  if (!email || !password || !conformPassword) {
    res.status(400).json({
      success: false,
      message: "Please provide email, password, and conformPassword"
    });
    return;
  }

  if (password !== conformPassword) {
    res.status(400).json({
      success: false,
      message: "Passwords do not match"
    });
    return;
  }

  const passwordCheck = checkStrongPassword(password);

  if (!passwordCheck.isStrong) {
    res.status(400).json({
      success: false,
      message: passwordCheck.errors.join(", ")
    });
    return;
  }
  const existingUserResult = await pool.query(
    `
    SELECT id, is_verified
    FROM users
    WHERE email = $1
    `,
    [email]
  );

  if (existingUserResult.rows.length > 0) {
    const existingUser = existingUserResult.rows[0];
    if (existingUser.is_verified) {
      res.status(409).json({
        success: false,
        message: "User already exists"
      });
      return;
    }

    res.status(403).json({
      success: false,
      message: "Please verify your email before logging in"
    });
    return;
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `
    INSERT INTO users (email, password_hash, is_verified)
    VALUES ($1, $2, false)
    RETURNING id, email
    `,
    [email, hashedPassword]
  );

  res.status(201).json({
    success: true,
    message: "Registration successful. Please verify your email.",
    data: result.rows[0]
  });
};


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
    `SELECT id,email,password_hash,is_verified
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
  if(!user.is_verified){
    return res.status(400).json({
      success:false,
      message:"This email isnt verified please verify this email"
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