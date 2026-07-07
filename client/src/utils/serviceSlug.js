export const toServiceSlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getServiceCategoryPath = (category) => {
  const slug = toServiceSlug(category?.slug || category?.name);
  const identifier = slug || category?.id;

  return identifier ? `/services/${identifier}` : "/services";
};

export const matchesServiceCategoryRoute = (category, routeValue) => {
  const value = String(routeValue || "").toLowerCase();

  return (
    String(category?.id || "").toLowerCase() === value ||
    toServiceSlug(category?.slug || category?.name) === value
  );
};
