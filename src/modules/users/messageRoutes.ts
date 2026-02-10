import { Router } from "express";
import { checkSession } from "../../middleware/checkSession.js";
import { sendMessage,
  deleteForEveryOne,
  deleteForMe,
  loadChatList,
  loadMessage,
  getUnreadCounts,
  markAsRead } from "./messageManager.js";
const router=Router()

router.post('/send-message',checkSession,sendMessage);
router.post('/delete-for-everyone',checkSession,deleteForEveryOne)
router.post('/delete-for-me',checkSession,deleteForMe)
router.post('/load-chat-list',checkSession,loadChatList)
router.post('/load-message',checkSession,loadMessage);
router.post('/get-unread-count',checkSession,getUnreadCounts);
router.post('/mark-as-read',checkSession,markAsRead);

export default router;