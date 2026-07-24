const { recordAuditLog } = require("../services/adminAudit.service");

const adminAuditMiddleware = (req, res, next) => {
  res.on("finish", () => {
    recordAuditLog({ req, statusCode: res.statusCode }).catch((error) => {
      console.warn("[admin-audit] unable to record action", error?.message || error);
    });
  });
  next();
};

module.exports = adminAuditMiddleware;
