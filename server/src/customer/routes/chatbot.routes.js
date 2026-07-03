const express = require("express");
const { body } = require("express-validator");

const chatbotController = require("../controllers/chatbot.controller");
const { protect } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");

const router = express.Router();

const chatbotRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.CHATBOT_RATE_LIMIT_PER_MINUTE || 20),
  keyGenerator: (req) => `${req.user?.id || req.ip}:chatbot`,
});

const askChatbotValidation = [
  body("message")
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Message must be between 1 and 1000 characters"),
  body("history")
    .optional()
    .isArray({ max: 12 })
    .withMessage("History must be an array with at most 12 messages"),
  body("history.*.role")
    .optional()
    .isIn(["user", "assistant"])
    .withMessage("History role must be user or assistant"),
  body("history.*.content")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("History messages must be at most 1000 characters"),
];

router.use(protect);

router.get("/history", chatbotController.getChatHistory);
router.post("/ask", chatbotRateLimit, askChatbotValidation, validate, chatbotController.askChatbot);
router.delete("/history", chatbotController.clearChatHistory);

module.exports = router;
