import type { Request, Response, NextFunction } from "express";
import REDIS_CLIENT from "../config/redis.js";

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
