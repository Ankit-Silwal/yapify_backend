import type { Request, Response } from "express";
import pool from "../../config/db.js";

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const { query } = req.query;
        if (!query || typeof query !== 'string') {
             res.status(400).json({ message: "Search query required" });
             return;
        }

        const currentUserId = req.userId; // Populated by checkSession

        console.log(`Searching for users with query: ${query}, requester: ${currentUserId}`);

        const searchTerm = `%${query}%`;
        // Search by email, exclude current user
        const result = await pool.query(
            "SELECT id, email, is_verified FROM users WHERE email ILIKE $1 AND id != $2 LIMIT 10",
            [searchTerm, currentUserId]
        );

        console.log(`Found ${result.rows.length} users`);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Search user error:", error);
        res.status(500).json({ message: "Server error" });
    }
}

export const findUserByUsername = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username } = req.query;
        if (!username || typeof username !== 'string') {
             res.status(400).json({ message: "Username query required" });
             return;
        }

        const currentUserId = req.userId; // Populated by checkSession

        // Search by username (exact or partial? "find user" implies exact usually, but let's do partial for ease of finding)
        // User said "find user by username to connect and chat".
        // I'll do partial match (ILIKE) for better UX. 
        const searchTerm = `%${username}%`;
        const result = await pool.query(
            "SELECT id, username, email, is_verified FROM users WHERE username ILIKE $1 AND id != $2 LIMIT 10",
            [searchTerm, currentUserId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Find user error:", error);
        res.status(500).json({ message: "Server error" });
    }
}
