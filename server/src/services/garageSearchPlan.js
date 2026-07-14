const SEARCH_RADII_KM = Object.freeze([5, 10, 20]);

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getNextGarageSearchStage = (booking = {}) => {
  const currentRound = Math.min(
    SEARCH_RADII_KM.length,
    Math.max(0, Number(booking.garageSearchRound) || 0),
  );
  const currentCycle = toPositiveInteger(booking.garageSearchCycle, 1);
  const restarting = currentRound >= SEARCH_RADII_KM.length;
  const round = restarting ? 1 : currentRound + 1;
  const cycle = restarting ? currentCycle + 1 : currentCycle;

  return {
    round,
    cycle,
    radiusKm: SEARCH_RADII_KM[round - 1],
    restarting,
  };
};

const selectGaragesForSearchStage = ({
  eligibleGarages = [],
  previousRequests = [],
  searchCycle,
}) => {
  const attemptedInCurrentCycle = new Set(
    previousRequests
      .filter(
        (request) =>
          toPositiveInteger(request.searchCycle, 1) === searchCycle,
      )
      .map((request) => request.garageId),
  );

  return eligibleGarages.filter(
    (garage) => !attemptedInCurrentCycle.has(garage.id),
  );
};

module.exports = {
  SEARCH_RADII_KM,
  getNextGarageSearchStage,
  selectGaragesForSearchStage,
};
