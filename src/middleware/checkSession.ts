import type { Request, Response, NextFunction } from "express";
import REDIS_CLIENT from "../config/redis.js";
import pool from "../config/db.js";

export const checkSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const sessionId = req.cookies?.sessionId;

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }
    const sessionKey = `session:${sessionId}`;
    const session = await REDIS_CLIENT.get(sessionKey);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Session expired"
      });
    }
    let sessionData;
    try {
      sessionData = JSON.parse(session);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid session data"
      });
    }

    // Verify user exists in DB
    const userCheck = await pool.query("SELECT 1 FROM users WHERE id = $1", [sessionData.userId]);
    if (userCheck.rowCount === 0) {
        // User deleted but session exists - invalidate session
        await REDIS_CLIENT.del(sessionKey);
        await REDIS_CLIENT.sRem(`user:sessions:${sessionData.userId}`, sessionId);
        
        return res.status(401).json({
            success: false,
            message: "User no longer exists"
        });
    }

    req.userId = sessionData.userId;
    next();
  } catch (err) {
    console.error("checkSession middleware error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
