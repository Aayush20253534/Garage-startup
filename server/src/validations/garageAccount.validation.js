const { body } = require("express-validator");

const deleteGarageAccountValidation = [
  body().custom((value) => {
    const currentPassword = String(value?.currentPassword || "").trim();
    const otp = String(value?.otp || "").trim();

    if (!currentPassword && !otp) {
      throw new Error("Enter your current password or email OTP");
    }

    if (otp && !/^\d{6}$/.test(otp)) {
      throw new Error("OTP must be 6 digits");
    }

    return true;
  }),
];

module.exports = {
  deleteGarageAccountValidation,
};
