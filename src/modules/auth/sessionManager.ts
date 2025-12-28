import { randomBytes } from "crypto";
import REDIS_CLIENT from "../../config/redis.js";
import type { Request } from "express";
const SESSION_TTL = 24 * 60 * 60;
export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}
export async function createSession(
  userId: string | number,
  req: Request
): Promise<string> {
  const sessionId=generateSessionId();
  const sessionData = {
    userId: userId.toString(),
    createdAt:new Date().toISOString(),
    expiresAt:new Date(Date.now()+SESSION_TTL*1000).toISOString(),
    ip:req.ip ?? "unknown",
    userAgent:req.get("user-agent") ?? "unknown"
  }
  const sessionKey=`session:${sessionId}`
  await REDIS_CLIENT.set(sessionKey,JSON.stringify(sessionData),{
    EX:SESSION_TTL
  })
  const userSessionKey=`user:sessions:${userId}`;
  await REDIS_CLIENT.sAdd(userSessionKey,sessionId);
  await REDIS_CLIENT.expire(userSessionKey,SESSION_TTL)
  console.log(`Session created successfully for ${userId}`)
  return sessionId
}