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
