import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import prisma from "../../libs/prisma.js";
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
    const user=await prisma.users.create({
      data:{
        email,
        password_hash:hashedPassword,
        is_verified:false,
        is_deactivated:false
      },select:{
        id:true,
        email:true
      }
    })

    res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email.",
      data: user,
    });
    const otp = await generateAndStoreOtp(user.id);
    await sendRegisterMail({ to: user.email, otp });
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
  const user=await prisma.users.findUnique({
    where:{email},
    select:{
      id:true,
      email:true
    }
  })
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  const response = await verifyAndConsumeOtp(user.id, otp);
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
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  const response = await verifyResentOtpCode(user.id, otp);
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
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true, email: true, is_verified: true },
  });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  if (user.is_verified) {
    return res.status(400).json({
      success: false,
      message: "Email already verified",
    });
  }
  const otp = await refreshOtp(user.id);
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
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true, email: true, password_hash: true, is_verified: true },
  });
  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Invalid email or password ",
    });
  }
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
  const user = userId
    ? await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, email: true, password_hash: true },
      })
    : null;
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
  await prisma.users.update({
    where: { id: userId },
    data: { password_hash: hashedPassword },
  });
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
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  const otp = await generateAndStoreForgotPasswordOtp(user.id);
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
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  const otp = await refreshForgotPasswordOtp(user.id);
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
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  const response = await verifyAndConsumeForgotPasswordOtp(user.id, otp);
  if (!response.success) {
    return res.status(400).json({
      success: false,
      message: response.message,
    });
  }
  const key = `security:changePassword:${user.id}`;
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
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  const response = await verifyResentForgotPasswordOtpCode(user.id, otp);
  if (!response.success) {
    return res.status(400).json({
      success: false,
      message: response.message,
    });
  }
  const key = `security:changePassword:${user.id}`;
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
  const { email, password, conformPassword } = req.body as {
    email?: string;
    password?: string;
    conformPassword?: string;
  };
  if (!email || !password || !conformPassword) {
    return res.status(400).json({
      success: false,
      message: "Please provide email,password and the conformPassword all",
    });
  }
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  const key = `security:changePassword:${user.id}`;
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
  await prisma.users.update({
    where: { email },
    data: { password_hash: hashedPassword },
  });
  return res.status(200).json({
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
