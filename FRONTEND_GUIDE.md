# Frontend Development Guide for Yapify

This guide provides all the necessary backend information and a step-by-step plan to build the frontend for **Yapify** (A WhatsApp Clone).

## 1. Recommended Tech Stack
*   **Framework**: React.js (Vite) or Next.js
*   **State Management**: Zustand or Redux Toolkit (for Auth & Chat state)
*   **UI Library**: TailwindCSS + Shadcn/UI (clean, modern look)
*   **Routing**: React Router DOM (if using Vite)
*   **Http Client**: Axios (configured with `withCredentials: true`)
*   **Realtime**: `socket.io-client`

## 2. Backend Connection Info
*   **Base URL**: `http://localhost:5000/api`
*   **Socket URL**: `http://localhost:5000`
*   **Authentication**: The backend uses **HTTP-Only Cookies** (`sessionId`).
*   **Important**: You generally do not need to manually handle tokens. Just ensure your requests include credentials.

```javascript
// Axios setup example
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true, // Crucial for cookies
});

export default api;
```

## 3. Data Types & Structures
Based on the backend schema, these are the key TypeScript interfaces you'll need:

```typescript
interface User {
  id: string;
  email: string;
  username: string;
  is_verified: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string; // or "Message was deleted..."
  message_type: 'text' | 'image' | 'video';
  created_at: string;
}

interface ConversationItem {
  conversation_id: string;
  message_id: string;
  content: string;
  sender_id: string;
  message_type: string;
  created_at: string;
  unread_count?: number; // Fetched separately or merged
}

interface SocketMessagePayload {
  tempId: string;    // Front-end generated ID to track pending status
  conversationId: string;
  content: string;
  messageType: string;
}
```

## 4. Step-by-Step Implementation Plan

### Phase 1: Authentication & Setup
1.  **Setup Router**:
    *   `/login`
    *   `/register`
    *   `/verify-otp` (Used after register or forgot password)
    *   `/` (Protected Dashboard)
2.  **Registration Flow**:
    *   User fills Email/Username/Pass -> Call `/auth/register`.
    *   Redirect to OTP page.
    *   User enters OTP -> Call `/auth/verify`.
    *   Redirect to Login.
3.  **Login Flow**:
    *   User inputs creds -> Call `/auth/login`.
    *   On 200 OK, redirect to `/` (Dashboard).
    *   *Tip: Add a `/auth/sessions` check on app load to determine if user is already logged in.*

### Phase 2: Chat Layout & List
1.  **Sidebar (Left Panel)**:
    *   Call `/message/load-chat-list` to get conversations.
    *   Call `/message/get-unread-count` and merge with chat list to show badges (🔴).
    *   Display list sorted by `created_at` (latest top).
2.  **Socket Connection**:
    *   Connect to `http://localhost:5000` **only after** login.
    *   The backend automatically reads the cookie to authenticate the socket.

### Phase 4: Search & New Chat
1.  **Find User**:
    *   Create a "New Chat" modal or page.
    *   Input: `username`.
    *   Call `/users/find-user?username=...` to search for users.
    *   Display results.
2.  **Start Chat**:
    *   Clicking a user from results should open the chat window with empty history (or existing history if available).

2.  **Sending Messages**:
    *   User types -> Press Send.
    *   **Optimistic UI**: Append message immediately to list with `status: 'pending'`.
    *   Emit `message:send` via Socket.IO.
    *   Listen for `message:ack` -> update status to `sent`.
3.  **Realtime Updates**:
    *   Listen for `message:new`:
        *   If `conversationId` matches active chat -> Append to view.
        *   If not match -> Increment unread count in Sidebar.

### Phase 4: Read Receipts
1.  **Mark as Read**:
    *   When opening a chat OR receiving a new message while chat is open:
    *   Emit `conversation:markRead` or call API `/message/mark-as-read`.
2.  **Update UI**:
    *   Listen for `conversation:read` event -> Update double ticks (✓✓) to blue.

### Phase 5: Group Features
1.  **Create Group Modal**:
    *   Select multiple users -> Call `/group/create-group`.
2.  **Group Management**:
    *   Right sidebar in valid conversation for "Group Info".
    *   Endpoints: `/group/addMember`, `/group/kick-from-group`, `/group/leave-group`.

## 5. Socket Events Reference

### Client Emits (What you send)
| Event | Payload | Purpose |
|Ref|---|---|
| `message:send` | `{ conversationId, content, messageType, tempId }` | Send Msg |
| `conversation:markRead` | `{ conversationId }` | Mark Read |

### Client Listens (What you receive)
| Event | Payload | Purpose |
|Ref|---|---|
| `message:new` | `Message` Object | New incoming msg |
| `message:ack` | `{ tempId, messageId }` | Server recieved your msg |
| `message:error` | `{ tempId, message }` | Sending failed |
| `conversation:read` | `{ conversationId, userId, readAt }` | Someone read the chat |

## 6. API Cheat Sheet
*(Full detals in `DOCUMENTATION.md`)*

*   **Auth**: `POST /auth/register`, `POST /auth/login`, `POST /auth/verify`
*   **Msgs**: `POST /message/load-chat-list`, `POST /message/load-message`, `POST /message/send-message`
*   **Groups**: `POST /group/create-group`, `POST /group/addMember`
