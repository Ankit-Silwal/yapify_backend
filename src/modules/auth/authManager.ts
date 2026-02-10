import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import pool from "../../config/db.js";
import { checkStrongPassword } from "../../utils/strongpassword.js";
import { createSession, getAllSession as fetchAllSessions, removeSpecificSession as removeSessionById } from "./sessionManager.js";
import { sendRegisterMail, forgotPasswordMail } from "./sendingOtp.js";
import {
  generateAndStoreForgotPasswordOtp,
  generateAndStoreOtp,
  verifyAndConsumeForgotPasswordOtp,
  verifyAndConsumeOtp,
  resendOtp as refreshOtp,
  verifyResentOtp as verifyResentOtpCode,
  resendForgotPasswordOtp as refreshForgotPasswordOtp,
  verifyResentForgotPasswordOtp as verifyResentForgotPasswordOtpCode,
} from "./otpManager.js";
import REDIS_CLIENT from "../../config/redis.js";

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const result = await pool.query(
        "SELECT id, email, username, is_verified FROM users WHERE id = $1",
        [userId]
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
        success: true,
        user: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export const registerUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, username, password, conformPassword } = req.body as {
    email?: string;
    username?: string;
    password?: string;
    conformPassword?: string;
  };

  if (!email || !username || !password || !conformPassword) {
    res.status(400).json({
      success: false,
      message: "Please provide email, username, password, and conformPassword",
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
      INSERT INTO users (email, username, password_hash, is_verified)
      VALUES ($1, $2, $3, false)
      RETURNING id, email, username
      `,
      [email, username, hashedPassword]
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
      const detail = err.detail || "";
      let message = "Email or Username already exists";
      if (detail.includes("email")) {
        message = "Email already exists";
      } else if (detail.includes("username")) {
        message = "Username already exists";
      }
      res.status(409).json({
        success: false,
        message: message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Registration failed",
      });
    }
  }
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

export async function verifyResentOtp(
  req: Request,
  res: Response
): Promise<Response> {
  const { email, otp } = req.body as { email?: string; otp?: string };
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
  if (user.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  const response = await verifyResentOtpCode(user.rows[0].id, otp);
  if (response.success) {
    return res.status(200).json({
      success: true,
      message: "The Otp was verified",
    });
  }
  return res.status(400).json({
    success: false,
    message: response.message,
  });
}

export async function resendOtp(req:Request,res:Response):Promise<Response>{
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Please provide the required email",
    });
  }
  const user = await pool.query(
    `SELECT id,email,is_verified FROM users
    WHERE email=$1`,
    [email]
  );
  if (user.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  if (user.rows[0].is_verified) {
    return res.status(400).json({
      success: false,
      message: "Email already verified",
    });
  }
  const otp = await refreshOtp(user.rows[0].id);
  await sendRegisterMail({ to: email, otp });
  return res.status(200).json({
    success: true,
    message: "The Resend Otp was sent",
  });
}

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
    `SELECT id,email,username,password_hash,is_verified
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
    secure: false, // Set to false for HTTP localhost
    sameSite: "lax", // Lax is better for localhost dev than strict usually
    maxAge: 24 * 60 * 60 * 1000,
  });
  return res.status(200).json({
    success: true,
    message: "Successfully logged in:)",
    user: {
      id: user.id,
      email: user.email,
      username: user.username
    },
  });
};

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
    `SELECT id, email, password_hash
   FROM users
   WHERE id = $1`,
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    return res.status(400).json({
      success: false,
      message: "The user wasnt found in the database",
    });
  }
  if (password != conformPassword) {
    return res.status(400).json({
      success: false,
      message: "The new passwords didnt match",
    });
  }
  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: "Current password didn't match",
    });
  }
  const check = checkStrongPassword(password);
  if (!check.isStrong) {
    return res.status(400).json({
      success: false,
      message: "Please put a stronger password sir",
    });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.query(
    `UPDATE users
    SET password_hash=$1,
    updated_at=NOW()
    WHERE id=$2`,
    [hashedPassword, userId]
  );
  return res.status(200).json({
    success: true,
    message: "The Password was changed successfully",
  });
}

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Please provide the required email",
    });
  }
  const user = await pool.query(
    `SELECT email,id FROM users
    WHERE email=$1
    RETURNING id`,
    [email]
  );
  const otp = await generateAndStoreForgotPasswordOtp(user.rows[0].id);
  await forgotPasswordMail({ to: email, otp });
  return res.status(200).json({
    success: true,
    message: "The OTP was sent succesfully",
  });
};

export const resendForgotPasswordOtp = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Please provide the required email",
    });
  }
  const user = await pool.query(
    `SELECT email,id FROM users
    WHERE email=$1
    RETURNING id`,
    [email]
  );
  if (user.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  const otp = await refreshForgotPasswordOtp(user.rows[0].id);
  await forgotPasswordMail({ to: email, otp });
  return res.status(200).json({
    success: true,
    message: "The OTP was sent succesfully",
  });
};

export const verifyForgotPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, otp } = req.body;
  if (!otp) {
    return res.status(400).json({
      success: false,
      message: "Please provide the required otp",
    });
  }
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Please provide the required email",
    });
  }
  const user = await pool.query(
    `SELECT email,id FROM users
    WHERE email=$1
    RETURNING id`,
    [email]
  );
  const response = await verifyAndConsumeForgotPasswordOtp(user.rows[0].id, otp);
  if (!response.success) {
    return res.status(400).json({
      success: false,
      message: response.message,
    });
  }
  const key = `security:changePassword:${user.rows[0].id}`;
  const value = "true";
  await REDIS_CLIENT.set(key, value, { EX: 300 });
  return res.status(200).json({
    success: true,
    message:
      "The OTP was verified you can now change password within 5 minutes",
  });
};

export const verifyResentForgotPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, otp } = req.body as { email?: string; otp?: string };
  if (!otp) {
    return res.status(400).json({
      success: false,
      message: "Please provide the required otp",
    });
  }
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Please provide the required email",
    });
  }
  const user = await pool.query(
    `SELECT email,id FROM users
    WHERE email=$1
    RETURNING id`,
    [email]
  );
  if (user.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  const response = await verifyResentForgotPasswordOtpCode(user.rows[0].id, otp);
  if (!response.success) {
    return res.status(400).json({
      success: false,
      message: response.message,
    });
  }
  const key = `security:changePassword:${user.rows[0].id}`;
  const value = "true";
  await REDIS_CLIENT.set(key, value, { EX: 300 });
  return res.status(200).json({
    success: true,
    message:
      "The OTP was verified you can now change password within 5 minutes",
  });
};

export const changeForgotPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, password, conformPassword } = req.body;
  if (!email || !password || !conformPassword) {
    return res.status(400).json({
      success: false,
      message: "Please provide email,password and the conformPassword all",
    });
  }
  const user = await pool.query(
    `SELECT email,id FROM users
    WHERE email=$1
    RETURNING id`,
    [email]
  );
  const key = `security:changePassword:${user.rows[0].id}`;
  const value = await REDIS_CLIENT.get(key);
  if (!value) {
    return res.status(400).json({
      success: false,
      message: "Request timeout please try again later",
    });
  }
  if (password != conformPassword) {
    return res.status(400).json({
      success: false,
      message: "The passwords didnt match",
    });
  }
  const check = checkStrongPassword(password);
  if (!check.isStrong) {
    return res.status(400).json({
      success: false,
      message: "Please put a stronger password",
    });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.query(
    `UPDATE users
    SET password_hash=$1
    WHERE email=$2`,
    [hashedPassword, email]
  );
  return res.status(400).json({
    success: true,
    message: "The password was changed successfully",
  });
};

export async function getAllSession(
  req: Request,
  res: Response
): Promise<Response> {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const sessions = await fetchAllSessions(userId);
  return res.status(200).json({ success: true, sessions });
}

export async function removeSpecificSession(
  req: Request,
  res: Response
): Promise<Response> {
  const userId = req.userId;
  const { sessionId } = req.params as { sessionId?: string };
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!sessionId) {
    return res
      .status(400)
      .json({ success: false, message: "sessionId param is required" });
  }
  const result = await removeSessionById(userId, sessionId);
  const status = result.success ? 200 : 404;
  return res.status(status).json(result);
}
