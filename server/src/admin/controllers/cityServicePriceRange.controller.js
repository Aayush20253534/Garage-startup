const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/cityServicePriceRange.service");
const cityPriceDiscountService = require("../services/cityPriceDiscount.service");

const listCityPriceDiscounts = asyncHandler(async (req, res) => {
  const discounts = await cityPriceDiscountService.listCityPriceDiscounts();
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "City price display rules fetched successfully",
        discounts,
      ),
    );
});

const upsertCityPriceDiscount = asyncHandler(async (req, res) => {
  const discount = await cityPriceDiscountService.upsertCityPriceDiscount(
    req.body,
    req.user,
  );
  return res
    .status(200)
    .json(
      new ApiResponse(200, "City price display rule saved successfully", discount),
    );
});

const listPriceRanges = asyncHandler(async (req, res) => {
  const ranges = await service.listPriceRanges(req.query);
  return res.status(200).json(new ApiResponse(200, "Price ranges fetched successfully", ranges));
});

const listPriceRangeFilterOptions = asyncHandler(async (req, res) => {
  const options = await service.listPriceRangeFilterOptions(req.query);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Price range filter options fetched successfully",
        options,
      ),
    );
});

const getPriceRange = asyncHandler(async (req, res) => {
  const range = await service.getPriceRange(req.params.id);
  return res.status(200).json(new ApiResponse(200, "Price range fetched successfully", range));
});

const listPriceRangeSubmissions = asyncHandler(async (req, res) => {
  const submissions = await service.listPriceRangeSubmissions(req.query, req.user);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Price range submissions fetched successfully",
        submissions,
      ),
    );
});

const createPriceRange = asyncHandler(async (req, res) => {
  if (req.user.role === "INTERN") {
    const submission = await service.createPriceRangeSubmission(req.body, req.user);
    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          "Price range submitted for admin approval",
          submission,
        ),
      );
  }

  const range = await service.createPriceRange(req.body);
  return res.status(201).json(new ApiResponse(201, "Price range created successfully", range));
});

const reviewPriceRangeSubmission = asyncHandler(async (req, res) => {
  const submission = await service.reviewPriceRangeSubmission(
    req.params.id,
    req.body,
    req.user,
  );
  const verb = submission.status === "APPROVED" ? "approved" : "rejected";
  return res
    .status(200)
    .json(new ApiResponse(200, `Price range submission ${verb}`, submission));
});

const approveAllPriceRangeSubmissions = asyncHandler(async (req, res) => {
  const result = await service.approveAllPriceRangeSubmissions(req.user);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "All reviewable price range submissions processed",
        result,
      ),
    );
});

const editPriceRangeSubmission = asyncHandler(async (req, res) => {
  const submission = await service.editPriceRangeSubmission(
    req.params.id,
    req.body,
    req.user,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, "Price range submission edited", submission));
});

const deletePriceRangeSubmission = asyncHandler(async (req, res) => {
  const submission = await service.deletePriceRangeSubmission(
    req.params.id,
    req.user,
  );
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Price range submission history deleted successfully",
        submission,
      ),
    );
});

const deletePriceRangeSubmissions = asyncHandler(async (req, res) => {
  const result = await service.deletePriceRangeSubmissions(req.body, req.user);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Price range submission records deleted successfully",
        result,
      ),
    );
});

const updatePriceRange = asyncHandler(async (req, res) => {
  const range = await service.updatePriceRange(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, "Price range updated successfully", range));
});

const deletePriceRange = asyncHandler(async (req, res) => {
  const range = await service.deletePriceRange(req.params.id);
  return res.status(200).json(new ApiResponse(200, "Price range deleted successfully", range));
});

const deletePriceRanges = asyncHandler(async (req, res) => {
  const result = await service.deletePriceRanges(req.body, req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, "Price ranges deleted successfully", result));
});

module.exports = {
  listCityPriceDiscounts,
  approveAllPriceRangeSubmissions,
  createPriceRange,
  deletePriceRange,
  deletePriceRanges,
  deletePriceRangeSubmission,
  deletePriceRangeSubmissions,
  editPriceRangeSubmission,
  getPriceRange,
  listPriceRangeFilterOptions,
  listPriceRangeSubmissions,
  listPriceRanges,
  reviewPriceRangeSubmission,
  updatePriceRange,
  upsertCityPriceDiscount,
};
