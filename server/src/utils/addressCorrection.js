const Groq = require("groq-sdk");
const ApiError = require("./apiError");

let groq = null;
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 12000);

const getGroqClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new ApiError(500, "Groq API not configured");
  }

  if (!groq) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  return groq;
};

/**
 * Uses Groq AI to correct/normalize an address
 * Handles typos, incomplete addresses, and alternate names
 */
const correctAddress = async (address, city, state, area, pincode) => {
  if (!process.env.GROQ_API_KEY) {
    throw new ApiError(500, "Groq API not configured");
  }

  try {
    const completion = await Promise.race([
      getGroqClient().chat.completions.create({
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        max_tokens: 150,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "Return only a corrected Indian address or UNABLE_TO_CORRECT.",
          },
          {
            role: "user",
            content: `You are an address correction assistant. Given an incomplete, misspelled, or informal address, provide the corrected full address in India.

Input address: ${address}
Area/locality: ${area || ""}
City: ${city}
State: ${state || ""}
Pincode: ${pincode || ""}

Rules:
1. Correct common typos and spelling mistakes
2. Expand abbreviations and informal names
3. Include proper city and state names
4. Keep the result in India and include pincode if it was provided
5. Return ONLY the corrected address, nothing else
6. If you cannot determine a valid Indian location, respond with "UNABLE_TO_CORRECT"

Corrected address:`,
          },
        ],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Groq address correction timed out")), GROQ_TIMEOUT_MS)
      ),
    ]);

    const correctedAddress = completion.choices?.[0]?.message?.content?.trim() || "";

    if (correctedAddress === "UNABLE_TO_CORRECT" || !correctedAddress) {
      throw new ApiError(404, "Could not correct this address");
    }

    return correctedAddress;
  } catch (error) {
    if (error.status === 404) throw error;
    
    console.error("Groq address correction error:", error.message);
    throw new ApiError(500, "Address correction service unavailable");
  }
};

const parseGroqJson = (value = "") => {
  const cleaned = String(value)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
};

const estimateIndianCoordinates = async ({ address, area, city, state, pincode }) => {
  if (!process.env.GROQ_API_KEY) {
    throw new ApiError(500, "Groq API not configured");
  }

  try {
    const completion = await Promise.race([
      getGroqClient().chat.completions.create({
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        max_tokens: 220,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "Return only strict JSON for a real Indian geocoding fallback, or UNABLE_TO_GEOCODE.",
          },
          {
            role: "user",
            content: `Estimate coordinates for this Indian address only if you are confident it is in India.

Address: ${address || ""}
Area/locality: ${area || ""}
City: ${city || ""}
State: ${state || ""}
Pincode: ${pincode || ""}
Country: India

Rules:
1. Return UNABLE_TO_GEOCODE if the address is outside India or too ambiguous.
2. Do not return 0,0.
3. Return only JSON in this exact shape:
{"latitude": number, "longitude": number, "displayName": "corrected address", "confidence": "high|medium|low"}

JSON:`,
          },
        ],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Groq coordinate fallback timed out")), GROQ_TIMEOUT_MS)
      ),
    ]);

    const content = completion.choices?.[0]?.message?.content?.trim() || "";
    if (content === "UNABLE_TO_GEOCODE") {
      throw new ApiError(404, "Could not estimate coordinates for this address");
    }

    const parsed = parseGroqJson(content);
    if (!parsed) {
      throw new ApiError(404, "Could not estimate coordinates for this address");
    }

    return {
      latitude: Number(parsed.latitude),
      longitude: Number(parsed.longitude),
      displayName: parsed.displayName || "",
      confidence: parsed.confidence || "low",
    };
  } catch (error) {
    if (error.status === 404) throw error;

    console.error("Groq coordinate fallback error:", error.message);
    throw new ApiError(500, "Coordinate fallback service unavailable");
  }
};

module.exports = {
  correctAddress,
  estimateIndianCoordinates,
};
