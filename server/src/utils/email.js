const normalizeEmail = (value) => {
  const email = String(value || "").trim().toLowerCase();
  const atIndex = email.lastIndexOf("@");

  if (atIndex <= 0) return email;

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (domain !== "gmail.com" && domain !== "googlemail.com") {
    return email;
  }

  const canonicalLocalPart = localPart.split("+", 1)[0].replace(/\./g, "");
  return `${canonicalLocalPart}@gmail.com`;
};

module.exports = {
  normalizeEmail,
};
