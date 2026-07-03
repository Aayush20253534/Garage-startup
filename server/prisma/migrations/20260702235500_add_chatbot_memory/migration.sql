CREATE TYPE "ChatbotMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "chatbot_conversations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chatbot_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chatbot_messages" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ChatbotMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "provider" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chatbot_conversations_userId_idx" ON "chatbot_conversations"("userId");
CREATE INDEX "chatbot_conversations_userId_updatedAt_idx" ON "chatbot_conversations"("userId", "updatedAt");
CREATE INDEX "chatbot_messages_conversationId_createdAt_idx" ON "chatbot_messages"("conversationId", "createdAt");
CREATE INDEX "chatbot_messages_userId_createdAt_idx" ON "chatbot_messages"("userId", "createdAt");

ALTER TABLE "chatbot_conversations"
  ADD CONSTRAINT "chatbot_conversations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chatbot_messages"
  ADD CONSTRAINT "chatbot_messages_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "chatbot_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chatbot_messages"
  ADD CONSTRAINT "chatbot_messages_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
