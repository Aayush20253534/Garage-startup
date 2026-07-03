const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");

const KNOWLEDGE_DIR = path.join(__dirname, "..", "knowledge");
const GROQ_TIMEOUT_MS = Number(process.env.CHATBOT_GROQ_TIMEOUT_MS || process.env.GROQ_TIMEOUT_MS || 12000);
const MAX_HISTORY_MESSAGES = 8;
const MAX_CONTEXT_SECTIONS = 5;
const MAX_VISIBLE_HISTORY_MESSAGES = 80;

let groq = null;
let knowledgeCache = null;

const getGroqClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new ApiError(500, "Groq API not configured");
  }

  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  return groq;
};

const cleanText = (value = "") =>
  String(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

const tokenize = (value = "") => {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "that",
    "this",
    "with",
    "you",
    "your",
    "are",
    "can",
    "how",
    "what",
    "when",
    "where",
    "why",
    "does",
    "have",
    "from",
    "about",
    "into",
    "will",
    "should",
    "please",
  ]);

  return cleanText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length > 2 && !stopWords.has(word));
};

const splitMarkdownSections = (fileName, content) => {
  const lines = content.split("\n");
  const sections = [];
  let currentTitle = path.basename(fileName, ".md");
  let currentLines = [];

  const pushSection = () => {
    const body = cleanText(currentLines.join("\n"));
    if (!body) return;

    sections.push({
      id: `${fileName}:${sections.length + 1}`,
      source: fileName,
      title: cleanText(currentTitle.replace(/^#+\s*/, "")),
      content: body.slice(0, 1800),
      tokens: tokenize(`${currentTitle} ${body}`),
    });
  };

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      pushSection();
      currentTitle = line;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  pushSection();
  return sections;
};

const loadKnowledge = () => {
  const files = fs.existsSync(KNOWLEDGE_DIR)
    ? fs
        .readdirSync(KNOWLEDGE_DIR)
        .filter((file) => file.endsWith(".md"))
        .sort()
    : [];

  const signature = files
    .map((file) => {
      const stat = fs.statSync(path.join(KNOWLEDGE_DIR, file));
      return `${file}:${stat.mtimeMs}:${stat.size}`;
    })
    .join("|");

  if (knowledgeCache?.signature === signature) {
    return knowledgeCache.sections;
  }

  const sections = files.flatMap((file) => {
    const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf8");
    return splitMarkdownSections(file, content);
  });

  knowledgeCache = { signature, sections };
  return sections;
};

const retrieveSections = (question, history = []) => {
  const queryText = [
    question,
    ...history.slice(-3).map((item) => `${item.role || ""} ${item.content || ""}`),
  ].join(" ");
  const queryTokens = tokenize(queryText);
  const querySet = new Set(queryTokens);

  return loadKnowledge()
    .map((section) => {
      let score = 0;
      for (const token of section.tokens) {
        if (querySet.has(token)) score += 2;
        if (queryTokens.some((queryToken) => token.includes(queryToken) || queryToken.includes(token))) {
          score += 0.35;
        }
      }

      if (section.title && question.toLowerCase().includes(section.title.toLowerCase())) {
        score += 4;
      }

      return { ...section, score };
    })
    .filter((section) => section.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_SECTIONS);
};

const getCustomerContext = async (userId) => {
  const [user, activeBookingsCount, latestBooking] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        isOnboarded: true,
        vehicles: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            brand: true,
            model: true,
            year: true,
            fuelType: true,
            isDefault: true,
          },
        },
        locations: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            source: true,
            isDefault: true,
          },
        },
      },
    }),
    prisma.booking.count({
      where: {
        userId,
        status: {
          in: ["PENDING_PAYMENT", "SEARCHING_GARAGE", "GARAGE_ASSIGNED", "CONFIRMED", "IN_PROGRESS"],
        },
      },
    }),
    prisma.booking.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        requestType: true,
        createdAt: true,
        garage: {
          select: {
            city: true,
          },
        },
        vehicle: {
          select: {
            brand: true,
            model: true,
          },
        },
      },
    }),
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const vehicle = user.vehicles[0] || null;
  const location = user.locations[0] || null;

  return {
    role: user.role,
    isOnboarded: user.isOnboarded,
    defaultVehicle: vehicle
      ? `${vehicle.year} ${vehicle.brand} ${vehicle.model} (${vehicle.fuelType})`
      : "not added",
    hasSavedLocation: Boolean(location),
    savedLocationSource: location?.source || "none",
    activeBookingsCount,
    latestBooking: latestBooking
      ? {
          status: latestBooking.status,
          requestType: latestBooking.requestType,
          vehicle: latestBooking.vehicle
            ? `${latestBooking.vehicle.brand} ${latestBooking.vehicle.model}`
            : null,
          hasAssignedGarage: Boolean(latestBooking.garage),
          garageCity: latestBooking.garage?.city || null,
        }
      : null,
  };
};

const buildFallbackAnswer = (question, sections) => {
  if (!sections.length) {
    return "I can help with Rovauto customer-side questions like booking a service, setting location, adding vehicles, payments, SOS, complaints, reviews, and tracking. Could you ask about one of those areas?";
  }

  const lead = sections[0].content
    .split(/(?<=[.!?])\s+/)
    .slice(0, 3)
    .join(" ");

  return `${lead}\n\nFor anything urgent on the road, use SOS or Roadside Assistance inside Rovauto.`;
};

const normalizeHistory = (history = []) =>
  history
    .filter((item) => ["user", "assistant"].includes(item.role) && item.content)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: cleanText(item.content).slice(0, 700),
    }));

const toApiMessage = (message) => ({
  id: message.id,
  role: message.role === "ASSISTANT" ? "assistant" : "user",
  from: message.role === "ASSISTANT" ? "bot" : "user",
  text: message.content,
  createdAt: message.createdAt,
});

const buildConversationTitle = (message) => {
  const title = cleanText(message).slice(0, 60);
  return title || "Rovauto chat";
};

const findActiveConversation = (userId) =>
  prisma.chatbotConversation.findFirst({
    where: { userId, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

const getOrCreateConversation = async (userId, titleSeed) => {
  const existing = await findActiveConversation(userId);
  if (existing) return existing;

  return prisma.chatbotConversation.create({
    data: {
      userId,
      title: buildConversationTitle(titleSeed),
    },
  });
};

const getStoredMemory = async (conversationId) => {
  const messages = await prisma.chatbotMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY_MESSAGES,
  });

  return messages
    .reverse()
    .map((message) => ({
      role: message.role === "ASSISTANT" ? "assistant" : "user",
      content: cleanText(message.content).slice(0, 700),
    }));
};

const getChatHistory = async (userId) => {
  const conversation = await findActiveConversation(userId);

  if (!conversation) {
    return {
      conversationId: null,
      messages: [],
    };
  }

  const messages = await prisma.chatbotMessage.findMany({
    where: {
      conversationId: conversation.id,
      userId,
    },
    orderBy: { createdAt: "desc" },
    take: MAX_VISIBLE_HISTORY_MESSAGES,
  });

  return {
    conversationId: conversation.id,
    messages: messages.reverse().map(toApiMessage),
  };
};

const clearChatHistory = async (userId) => {
  await prisma.chatbotConversation.deleteMany({
    where: { userId },
  });

  return { cleared: true };
};

const storeConversationTurn = async ({
  userId,
  conversationId,
  question,
  answer,
  provider,
  sources,
}) => {
  const [userMessage, assistantMessage] = await prisma.$transaction([
    prisma.chatbotMessage.create({
      data: {
        conversationId,
        userId,
        role: "USER",
        content: question,
      },
    }),
    prisma.chatbotMessage.create({
      data: {
        conversationId,
        userId,
        role: "ASSISTANT",
        content: answer,
        provider,
        metadata: {
          sources,
        },
      },
    }),
    prisma.chatbotConversation.update({
      where: { id: conversationId },
      data: {
        title: buildConversationTitle(question),
      },
    }),
  ]);

  return [toApiMessage(userMessage), toApiMessage(assistantMessage)];
};

const askChatbot = async ({ userId, message, history = [] }) => {
  const question = cleanText(message);
  if (!question) {
    throw new ApiError(400, "Message is required");
  }

  const conversation = await getOrCreateConversation(userId, question);
  const storedHistory = await getStoredMemory(conversation.id);
  const browserHistory = normalizeHistory(history);
  const normalizedHistory = storedHistory.length ? storedHistory : browserHistory;
  const [customerContext, sections] = await Promise.all([
    getCustomerContext(userId),
    Promise.resolve(retrieveSections(question, normalizedHistory)),
  ]);

  if (!process.env.GROQ_API_KEY) {
    const sources = sections.map(({ source, title }) => ({ source, title }));
    const answer = buildFallbackAnswer(question, sections);
    const savedMessages = await storeConversationTurn({
      userId,
      conversationId: conversation.id,
      question,
      answer,
      provider: "local-rag",
      sources,
    });

    return {
      answer,
      sources,
      provider: "local-rag",
      conversationId: conversation.id,
      savedMessages,
    };
  }

  const knowledgeContext = sections
    .map(
      (section, index) =>
        `[${index + 1}] ${section.title} (${section.source})\n${section.content}`
    )
    .join("\n\n");

  try {
    const completion = await Promise.race([
      getGroqClient().chat.completions.create({
        model: process.env.CHATBOT_GROQ_MODEL || process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        temperature: 0.2,
        max_tokens: 520,
        messages: [
          {
            role: "system",
            content:
              "You are Rovauto Assistant for customers in India. Answer only user-side Rovauto questions using the provided knowledge and safe customer context. Be concise, practical, and friendly. Do not reveal private chat memory or personal account details. Do not invent policies, prices, garage availability, refunds, or emergency dispatch. If the answer is not in context, say what you can help with and suggest the closest app action.",
          },
          {
            role: "user",
            content: `Customer context:
${JSON.stringify(customerContext, null, 2)}

Knowledge base:
${knowledgeContext || "No matching knowledge section found."}

Answer the next customer question. Use short paragraphs or bullets only when helpful.`,
          },
          ...normalizedHistory,
          {
            role: "user",
            content: question,
          },
        ],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Chatbot response timed out")), GROQ_TIMEOUT_MS)
      ),
    ]);

    const answer = completion.choices?.[0]?.message?.content?.trim();

    const sources = sections.map(({ source, title }) => ({ source, title }));
    const finalAnswer = answer || buildFallbackAnswer(question, sections);
    const savedMessages = await storeConversationTurn({
      userId,
      conversationId: conversation.id,
      question,
      answer: finalAnswer,
      provider: "groq-rag",
      sources,
    });

    return {
      answer: finalAnswer,
      sources,
      provider: "groq-rag",
      conversationId: conversation.id,
      savedMessages,
    };
  } catch (error) {
    console.error("Groq chatbot error:", error.message);
    const sources = sections.map(({ source, title }) => ({ source, title }));
    const answer = buildFallbackAnswer(question, sections);
    const savedMessages = await storeConversationTurn({
      userId,
      conversationId: conversation.id,
      question,
      answer,
      provider: "local-rag-fallback",
      sources,
    });

    return {
      answer,
      sources,
      provider: "local-rag-fallback",
      conversationId: conversation.id,
      savedMessages,
    };
  }
};

module.exports = {
  askChatbot,
  getChatHistory,
  clearChatHistory,
  loadKnowledge,
  retrieveSections,
};
