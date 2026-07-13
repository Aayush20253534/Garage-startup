const { createHash } = require("crypto");

const getCashfreeIdempotencyKey = (value) => {
  const hex = createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 32)
    .split("");

  // Format the deterministic digest as an RFC 4122 variant/version UUID.
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  return [
    hex.slice(0, 8).join(""),
    hex.slice(8, 12).join(""),
    hex.slice(12, 16).join(""),
    hex.slice(16, 20).join(""),
    hex.slice(20, 32).join(""),
  ].join("-");
};

module.exports = { getCashfreeIdempotencyKey };
