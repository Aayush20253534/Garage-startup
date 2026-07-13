const getCustomerMapButtonParameter = (booking = {}) => {
  const hasLatitude =
    booking.customerLatitude !== null &&
    booking.customerLatitude !== undefined &&
    String(booking.customerLatitude).trim() !== "";
  const hasLongitude =
    booking.customerLongitude !== null &&
    booking.customerLongitude !== undefined &&
    String(booking.customerLongitude).trim() !== "";
  const latitude = Number(booking.customerLatitude);
  const longitude = Number(booking.customerLongitude);

  if (
    hasLatitude &&
    hasLongitude &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return encodeURIComponent(`${latitude},${longitude}`);
  }

  const address = String(booking.customerAddress || "").trim();
  return encodeURIComponent(address || "India");
};

module.exports = {
  getCustomerMapButtonParameter,
};
