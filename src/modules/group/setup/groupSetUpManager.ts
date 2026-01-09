import pool from "../../../config/db.js"
import type { Request,Response } from "express"
export async function createGroup(
  req: Request,
  res: Response
): Promise<Response> {

  const { memberIds } = req.body; // array of userIds
  const creatorId = req.userId;

  if (!creatorId || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "memberIds array is required"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const convoResult = await client.query(
      `
      INSERT INTO conversations (is_group)
      VALUES (true)
      RETURNING id;
      `
    );

    const conversationId = convoResult.rows[0].id;
    // Prepare participants
    const uniqueUserIds = Array.from(
      new Set([creatorId, ...memberIds])
    );
    const values: any[] = [];
    let paramIndex = 1;
    const placeholders = uniqueUserIds
      .map((userId) => {
        const role = userId === creatorId ? "admin" : "member";
        values.push(conversationId, userId, role);
        const p = `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`;
        paramIndex += 3;
        return p;
      })
      .join(",");

    // Inserting thre participants with roles
    await client.query(
      `
      INSERT INTO conversation_participants
        (conversation_id, user_id, role)
      VALUES ${placeholders};
      `,
      values
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      conversationId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createGroup error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create group"
    });
  } finally {
    client.release();
  }
}