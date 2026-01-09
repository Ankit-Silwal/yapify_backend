CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id UUID
    REFERENCES conversations(id) ON DELETE CASCADE,

  user_id UUID
    REFERENCES users(id) ON DELETE CASCADE,

  deleted_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID
    REFERENCES conversations(id) ON DELETE CASCADE,

  sender_id UUID
    REFERENCES users(id),

  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text',

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE message_status (
  message_id UUID
    REFERENCES messages(id) ON DELETE CASCADE,

  user_id UUID
    REFERENCES users(id) ON DELETE CASCADE,

  status VARCHAR(10), -- sent, delivered, read
  updated_at TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (message_id, user_id)
);
