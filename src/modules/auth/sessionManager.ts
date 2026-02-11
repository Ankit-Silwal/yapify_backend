import { randomBytes } from "crypto";
import REDIS_CLIENT, { isRedisConnected } from "../../config/redis.js";
import type { Request, Response } from "express";
const SESSION_TTL = 24 * 60 * 60;

// In-memory fallback when Redis is not available
const inMemorySessions = new Map<string, any>();
const userSessions = new Map<string, Set<string>>();

// Export getters for the in-memory stores
export function getInMemorySession(sessionId: string): any {
  return inMemorySessions.get(sessionId);
}

export function hasInMemorySession(sessionId: string): boolean {
  return inMemorySessions.has(sessionId);
}

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
  
  if (isRedisConnected()) {
    const sessionKey=`session:${sessionId}`
    await REDIS_CLIENT.set(sessionKey,JSON.stringify(sessionData),{
      EX:SESSION_TTL
    })
    const userSessionKey=`user:sessions:${userId}`;
    await REDIS_CLIENT.sAdd(userSessionKey,sessionId);
    await REDIS_CLIENT.expire(userSessionKey,SESSION_TTL)
  } else {
    // Use in-memory fallback
    inMemorySessions.set(sessionId, sessionData);
    const userKey = userId.toString();
    if (!userSessions.has(userKey)) {
      userSessions.set(userKey, new Set());
    }
    userSessions.get(userKey)!.add(sessionId);
    
    // Auto-expire in-memory session
    setTimeout(() => {
      inMemorySessions.delete(sessionId);
      userSessions.get(userKey)?.delete(sessionId);
    }, SESSION_TTL * 1000);
  }
  
  console.log(`Session created successfully for ${userId}`)
  return sessionId
}
type json={
  success:boolean,
  message:string
}
type SessionInfo = {
  sessionId: string,
  userId: string,
  ip: string,
  userAgent: string,
  createdAt: string,
  expiresAt: string
}
export async function deleteSession(
  userId:string |number,
  req:Request,
  res:Response
):Promise<json>{
  const sessionId=req.cookies.sessionId;
  
  if (isRedisConnected()) {
    const key=`session:${sessionId}`
    const result=await REDIS_CLIENT.del(key);
    if(result>0){
      return({
        success:true,
        message: `Session for ${userId} was deleted successfully`
      })
    }
  } else if (inMemorySessions.has(sessionId)) {
    // Use in-memory fallback
    inMemorySessions.delete(sessionId);
    userSessions.get(userId.toString())?.delete(sessionId);
    return({
      success:true,
      message: `Session for ${userId} was deleted successfully`
    })
  }
  
  return({
      success:false,
      message:`Session doesn't exists `
  })
}  

export async function deleteAllSession(
  userId:string |number,
  req:Request
):Promise<json>{
  let deletedCount=0;
  
  if (isRedisConnected()) {
    const userSessionKey=`user:sessions:${userId}`
    const sessions=await REDIS_CLIENT.sMembers(userSessionKey)
    for(let session of sessions){
      const sessionKey=`session:${session}`
      const result=await REDIS_CLIENT.del(sessionKey);
      if(result>0){
        deletedCount++;
      }
    }
    await REDIS_CLIENT.del(userSessionKey)
  } else {
    // Use in-memory fallback
    const userKey = userId.toString();
    const sessions = userSessions.get(userKey);
    if (sessions) {
      sessions.forEach(sessionId => {
        if (inMemorySessions.delete(sessionId)) {
          deletedCount++;
        }
      });
      userSessions.delete(userKey);
    }
  }
  
  return({
    success: true,
    message: `Thus ${deletedCount} sessions were removed`
  })
}

export async function getAllSession(
  userId:string | number,
):Promise<SessionInfo[]>{
  const results: SessionInfo[] = []
  
  if (isRedisConnected()) {
    const userSessionKey=`user:sessions:${userId}`
    const sessionIds=await REDIS_CLIENT.sMembers(userSessionKey);
    if(!sessionIds || sessionIds.length===0){
      return [];
    }
    const rawSessions=await Promise.all(
      sessionIds.map((id)=>
        REDIS_CLIENT.get(`session:${id}`)
      )
    )
    for(let i=0;i<sessionIds.length;i++){
      const raw=rawSessions[i];
      if(!raw){
        await REDIS_CLIENT.sRem(userSessionKey,sessionIds[i]);
        continue;
      }
      const parsed=JSON.parse(raw);
      results.push({
        sessionId: sessionIds[i],
        userId: parsed.userId,
        ip: parsed.ip,
        userAgent: parsed.userAgent,
        createdAt: parsed.createdAt,
        expiresAt: parsed.expiresAt
      });
    }
  } else {
    // Use in-memory fallback
    const userKey = userId.toString();
    const sessions = userSessions.get(userKey);
    if (sessions) {
      sessions.forEach(sessionId => {
        const sessionData = inMemorySessions.get(sessionId);
        if (sessionData) {
          results.push({
            sessionId,
            userId: sessionData.userId,
            ip: sessionData.ip,
            userAgent: sessionData.userAgent,
            createdAt: sessionData.createdAt,
            expiresAt: sessionData.expiresAt
          });
        }
      });
    }
  }
  return results;
}

export async function removeSpecificSession(
  userId: string | number,
  sessionId: string
): Promise<json> {
  if (isRedisConnected()) {
    const sessionKey = `session:${sessionId}`;
    const userSessionKey = `user:sessions:${userId}`;

    const result = await REDIS_CLIENT.del(sessionKey);
    await REDIS_CLIENT.sRem(userSessionKey, sessionId);

    if (result > 0) {
      return {
        success: true,
        message: `Session ${sessionId} deleted for ${userId}`
      };
    }
  } else {
    // Use in-memory fallback
    const userKey = userId.toString();
    if (inMemorySessions.has(sessionId)) {
      inMemorySessions.delete(sessionId);
      userSessions.get(userKey)?.delete(sessionId);
      return {
        success: true,
        message: `Session ${sessionId} deleted for ${userId}`
      };
    }
  }

  return {
    success: false,
    message: `Session ${sessionId} not found`
  };
}