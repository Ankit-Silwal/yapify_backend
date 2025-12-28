import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import pool from "../../config/db.js";
import { checkStrongPassword } from "../../utils/strongpassword.js";
import { createSession } from "./sessionManager.js";
import { sendRegisterMail } from "./sendingOtp.js";
import { generateAndStoreOtp, verifyAndConsumeOtp } from "./otpManager.js";
type checkPasswordResult = {
  isStrong: boolean;
  errors: string[];
};
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
      message: "Please provide email, password, and conformPassword",
    });
    return;
  }

  if (password !== conformPassword) {
    res.status(400).json({
      success: false,
      message: "Passwords do not match",
    });
    return;
  }

  const passwordCheck = checkStrongPassword(password);

  if (!passwordCheck.isStrong) {
    res.status(400).json({
      success: false,
      message: passwordCheck.errors.join(", "),
    });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
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
      data: result.rows[0],
    });
    const otp = await generateAndStoreOtp(result.rows[0].id);
    await sendRegisterMail({ to: result.rows[0].email, otp });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Registration failed",
      });
    }
  }
};

export const loginUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide both the email and the password",
    });
  }
  const result = await pool.query(
    `SELECT id,email,password_hash,is_verified
    FROM users
    WHERE email=$1`,
    [email]
  );
  if (result.rows.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid email or password ",
    });
  }
  const user = result.rows[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: "The password didn't match",
    });
  }
  if (!user.is_verified) {
    return res.status(400).json({
      success: false,
      message: "This email isnt verified please verify this email",
    });
  }
  const sessionId = await createSession(String(user.id), req);
  res.cookie("sessionId", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  });
  return res.status(200).json({
    success: true,
    message: "Successfully logged in:)",
    user: {
      id: user.id,
      email: user.email,
    },
  });
};

export async function verifyUser(
  req: Request,
  res: Response
): Promise<Response> {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Please provide both email and the otp",
    });
  }
  const user = await pool.query(
    `SELECT id,email FROM users
    WHERE email=$1`,
    [email]
  );
  const response = await verifyAndConsumeOtp(user.rows[0].id, otp);
  if (response.success) {
    return res.status(200).json({
      success: true,
      message: "The Otp was verified",
    });
  }
  if (!response.success) {
    return res.status(400).json({
      success: false,
      message: response.message,
    });
  }
  return res.status(400).json({
    success: false,
    message: "Unknown error",
  });
}

export async function changePassword(
  req: Request,
  res: Response
): Promise<Response> {
  const { currentPassword, password, conformPassword } = req.body;
  if (!currentPassword || !password || !conformPassword) {
    return res.status(400).json({
      success: false,
      message: "Please provide currentPassword,password and conformPassword",
    });
  }
  const userId = req.userId;
  const result = await pool.query(
    `SELECT id, email, hash_password
   FROM users
   WHERE id = $1`,
    [userId]
  );
  const user = result.rows[0];
  if(!user){
    return res.status(400).json({
      success:false,
      message:"The user wasnt found in the database"
    })
  }
  if(password!=conformPassword){
    return res.status(400).json({
      success:false,
      message:"The new passwords didnt match"
    })
  }
  const isMatch=await bcrypt.compare(password,user.password_hash)
  if(!isMatch){
    return res.status(400).json({
      success:false,
      message:"Current password didn't match"
    })
  }
  await pool.query(
    `UPDATE users
    SET hash_password=$1,
    updated_at=NOW()
    WHERE id=$2`,
    [password,userId]
  )
  return res.status(200).json({
    success: true,
    message: "The Password was changed successfully",
  });
}
