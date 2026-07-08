const { Prisma } = require("@prisma/client");

const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const calculateDistanceKm = require("../utils/distance");
const { getCache, setCache } = require("../utils/cache");
const { addGarageWhatsappLink } = require("../utils/whatsapp");
const { addServicePriceRange } = require("../utils/pricing");
const googleMapsService = require("../maps/services/googleMaps.service");

const GARAGE_LIST_TTL = 5 * 60;
const GARAGE_DETAIL_TTL = 5 * 60;
const PUBLIC_GARAGE_RADIUS_KM = Math.max(1, Number(process.env.PUBLIC_GARAGE_RADIUS_KM || 10));
const GARAGE_GEO_LOOKUP_RADIUS_KM = Math.max(1, Number(process.env.GARAGE_GEO_LOOKUP_RADIUS_KM || 50));

const garageIncludeForList = {
  images: {
    orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
  },
  videos: {
    orderBy: { order: "asc" },
  },
  services: {
    where: { isActive: true },
    include: {
      service: {
        include: {
          category: true,
          media: {
            orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
          },
        },
      },
    },
  },
};

const garageIncludeForDetails = {
  images: {
    orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
  },
  videos: {
    orderBy: { order: "asc" },
  },
  services: {
    where: { isActive: true },
    include: {
      service: {
        include: {
          category: true,
          media: {
            orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
          },
        },
      },
    },
  },
  reviews: {
    take: 10,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  wallet: true,
};

const isGarageOpenNow = (garage) => {
  if (!garage.openingTime || !garage.closingTime) return true;

  const currentTime = new Date().toTimeString().slice(0, 5);

  return garage.openingTime <= currentTime && garage.closingTime >= currentTime;
};

const normalizeServiceIds = (serviceIds) => {
  if (!serviceIds) return [];

  if (Array.isArray(serviceIds)) {
    return [...new Set(serviceIds.filter(Boolean))];
  }

  return String(serviceIds)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parsePositiveNumber = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const hasUsableCoordinates = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180 &&
  !(latitude === 0 && longitude === 0);

const getGeoSearchContext = (query = {}, fallbackRadiusKm = PUBLIC_GARAGE_RADIUS_KM) => {
  const latitude = parseFiniteNumber(query.latitude ?? query.lat);
  const longitude = parseFiniteNumber(query.longitude ?? query.lng ?? query.lon);

  if (!hasUsableCoordinates(latitude, longitude)) return null;

  const radiusKm = parsePositiveNumber(
    query.radiusKm ?? query.maxDistance,
    fallbackRadiusKm,
  );

  return {
    latitude,
    longitude,
    radiusKm: Math.max(1, Math.min(radiusKm, 100)),
  };
};

const getGaragePointSql = () =>
  Prisma.sql`ST_SetSRID(ST_MakePoint(g."longitude", g."latitude"), 4326)::geography`;

const getOriginPointSql = ({ latitude, longitude }) =>
  Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;

const buildRawGarageConditions = ({
  search,
  city,
  area,
  verified,
  minRating,
  serviceIds = [],
  vehicle = null,
  requireWalletBalance = false,
  minGarageWalletBalance = 0,
  onlyVerified = false,
}) => {
  const conditions = [
    Prisma.sql`g."isActive" = true`,
    Prisma.sql`g."latitude" IS NOT NULL`,
    Prisma.sql`g."longitude" IS NOT NULL`,
  ];

  if (verified === "true" || onlyVerified) {
    conditions.push(Prisma.sql`g."isVerified" = true`);
  }

  if (city) {
    conditions.push(Prisma.sql`g."city" ILIKE ${`%${city}%`}`);
  }

  if (area) {
    conditions.push(Prisma.sql`g."area" ILIKE ${`%${area}%`}`);
  }

  const numericMinRating = parseFiniteNumber(minRating);
  if (numericMinRating !== null) {
    conditions.push(Prisma.sql`g."ratingAvg" >= ${numericMinRating}`);
  }

  if (search) {
    const like = `%${search}%`;
    conditions.push(Prisma.sql`(
      g."name" ILIKE ${like}
      OR g."area" ILIKE ${like}
      OR g."city" ILIKE ${like}
      OR g."address" ILIKE ${like}
    )`);
  }

  const vehicleBrand = String(vehicle?.brand || "").trim();
  serviceIds.forEach((serviceId) => {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM "GarageService" gs
      WHERE gs."garageId" = g."id"
        AND gs."serviceId" = ${serviceId}
        AND gs."isActive" = true
        ${vehicleBrand ? Prisma.sql`AND (gs."vehicleBrand" = 'ALL' OR gs."vehicleBrand" = ${vehicleBrand})` : Prisma.empty}
    )`);
  });

  if (requireWalletBalance) {
    const minBalance = Math.max(0, Number(minGarageWalletBalance) || 0);
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM "GarageWallet" gw
      WHERE gw."garageId" = g."id"
        AND gw."balance" >= ${minBalance}
    )`);
  }

  return Prisma.join(conditions, Prisma.raw(" AND "));
};

const queryGarageDistanceRows = async ({
  latitude,
  longitude,
  radiusKm,
  limit = 200,
  ...filters
}) => {
  const numericLatitude = parseFiniteNumber(latitude);
  const numericLongitude = parseFiniteNumber(longitude);
  const numericRadiusKm = parsePositiveNumber(radiusKm, null);

  if (!hasUsableCoordinates(numericLatitude, numericLongitude) || !numericRadiusKm) {
    return null;
  }

  const originPoint = getOriginPointSql({
    latitude: numericLatitude,
    longitude: numericLongitude,
  });
  const garagePoint = getGaragePointSql();
  const conditions = buildRawGarageConditions(filters);
  const radiusMeters = Math.round(numericRadiusKm * 1000);
  const take = Math.max(1, Math.min(Number(limit) || 200, 500));

  try {
    return await prisma.$queryRaw`
      SELECT
        g."id",
        ST_Distance(${garagePoint}, ${originPoint}) / 1000.0 AS "distanceKm"
      FROM "Garage" g
      WHERE ${conditions}
        AND ST_DWithin(${garagePoint}, ${originPoint}, ${radiusMeters})
      ORDER BY "distanceKm" ASC, g."isVerified" DESC, g."ratingAvg" DESC
      LIMIT ${take}
    `;
  } catch (error) {
    console.warn("[garage-search] PostGIS distance query fallback:", error.message);
    return null;
  }
};

const attachDistanceAndOrder = (garages = [], distanceRows = []) => {
  const distanceById = new Map(
    distanceRows.map((row) => [row.id, Number(row.distanceKm)]),
  );
  const orderById = new Map(distanceRows.map((row, index) => [row.id, index]));

  return garages
    .map((garage) => ({
      ...garage,
      distanceKm: distanceById.has(garage.id)
        ? Number(distanceById.get(garage.id).toFixed(2))
        : garage.distanceKm,
    }))
    .sort((left, right) => {
      const leftOrder = orderById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = orderById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
};

const fetchGaragesByDistanceRows = async (distanceRows = [], include = garageIncludeForList) => {
  const ids = distanceRows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return [];

  const garages = await prisma.garage.findMany({
    where: { id: { in: ids } },
    include,
  });

  return attachDistanceAndOrder(garages.map(serializeGarage), distanceRows);
};

const buildGarageServiceFilter = (serviceIds = [], vehicle = null) => {
  const uniqueServiceIds = normalizeServiceIds(serviceIds);

  if (uniqueServiceIds.length === 0) return {};

  const vehicleBrand = String(vehicle?.brand || "").trim();

  return {
    AND: uniqueServiceIds.map((serviceId) => ({
      services: {
        some: {
          serviceId,
          isActive: true,
          ...(vehicleBrand && {
            OR: [
              { vehicleBrand: "ALL" },
              { vehicleBrand },
            ],
          }),
        },
      },
    })),
  };
};

const serializeGarageQuery = (query = {}) => {
  return JSON.stringify(
    Object.keys(query)
      .sort()
      .reduce((acc, key) => {
        const value = query[key];

        if (Array.isArray(value)) {
          acc[key] = [...value].sort();
        } else {
          acc[key] = value ?? "";
        }

        return acc;
      }, {})
  );
};

const addThumbnail = (garage) => ({
  ...garage,
  thumbnail: garage.images.find((image) => image.isThumbnail === true) || null,
});

const serializeGarageService = (garageService) => {
  const { price, ...rest } = garageService;
  return {
    ...rest,
    service: garageService.service ? addServicePriceRange(garageService.service) : garageService.service,
  };
};

const serializeGarage = (garage) =>
  addGarageWhatsappLink({
    ...addThumbnail(garage),
    services: garage.services ? garage.services.map(serializeGarageService) : garage.services,
  });


const addDrivingMetrics = async ({ latitude, longitude, garages = [] }) => {
  if (!garages.length || process.env.GOOGLE_ROUTE_MATRIX_ENABLED === "false") {
    return garages;
  }

  const limit = Math.max(1, Math.min(
    Number(process.env.GOOGLE_ROUTE_MATRIX_GARAGE_LIMIT || 10),
    25,
  ));
  const candidates = garages.slice(0, limit);

  try {
    const ranked = await googleMapsService.rankDestinations({
      origin: { latitude, longitude },
      destinations: candidates.map((garage) => ({
        latitude: garage.latitude,
        longitude: garage.longitude,
      })),
      trafficAware: process.env.GOOGLE_TRAFFIC_AWARE !== "false",
    });

    const metricsByIndex = new Map(
      ranked.map((item) => [item.destinationIndex, item]),
    );

    const enriched = candidates.map((garage, index) => {
      const metric = metricsByIndex.get(index);
      return {
        ...garage,
        roadDistanceKm: metric?.distanceKm ?? null,
        routeDistanceMeters: metric?.distanceMeters ?? null,
        etaSeconds: metric?.durationSeconds ?? null,
        etaMinutes: metric?.durationSeconds
          ? Math.max(1, Math.ceil(metric.durationSeconds / 60))
          : null,
      };
    });

    return [
      ...enriched.sort((left, right) => {
        const leftEta = left.etaSeconds ?? Number.MAX_SAFE_INTEGER;
        const rightEta = right.etaSeconds ?? Number.MAX_SAFE_INTEGER;
        return leftEta - rightEta;
      }),
      ...garages.slice(limit),
    ];
  } catch (error) {
    console.warn("[garage-search] route matrix fallback:", error.message);
    return garages;
  }
};

const getGarages = async (query = {}) => {
  const {
    search,
    city,
    area,
    verified,
    serviceId,
    serviceIds,
    minRating,
    openNow,
  } = query;

  const finalServiceIds = normalizeServiceIds(
    serviceIds || (serviceId ? [serviceId] : [])
  );
  const geoSearch = getGeoSearchContext(query, PUBLIC_GARAGE_RADIUS_KM);

  const where = {
    isActive: true,

    ...buildGarageServiceFilter(finalServiceIds),

    ...(city && {
      city: {
        contains: city,
        mode: "insensitive",
      },
    }),

    ...(area && {
      area: {
        contains: area,
        mode: "insensitive",
      },
    }),

    ...(verified === "true" && {
      isVerified: true,
    }),

    ...(minRating && {
      ratingAvg: {
        gte: Number(minRating),
      },
    }),

    ...(search && {
      OR: [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          area: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          city: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          address: {
            contains: search,
            mode: "insensitive",
          },
        },
      ],
    }),
  };

  if (geoSearch) {
    const distanceRows = await queryGarageDistanceRows({
      ...geoSearch,
      search,
      city,
      area,
      verified,
      minRating,
      serviceIds: finalServiceIds,
      limit: 100,
    });

    if (distanceRows) {
      let rankedGarages = await fetchGaragesByDistanceRows(distanceRows);

      if (openNow === "true") {
        rankedGarages = rankedGarages.filter(isGarageOpenNow);
      }

      return rankedGarages;
    }
  }

  const cacheKey = geoSearch
    ? null
    : `garages:list:${serializeGarageQuery({
        search,
        city,
        area,
        verified,
        serviceIds: finalServiceIds,
        minRating,
        openNow,
      })}`;

  const cached = cacheKey ? await getCache(cacheKey) : null;
  if (cached) return cached;

  let garages = await prisma.garage.findMany({
    where,
    include: garageIncludeForList,
    orderBy: [{ isVerified: "desc" }, { ratingAvg: "desc" }],
  });

  if (openNow === "true") {
    garages = garages.filter(isGarageOpenNow);
  }

  let result = garages.map(serializeGarage);

  if (geoSearch) {
    result = result
      .map((garage) => ({
        ...garage,
        distanceKm: calculateDistanceKm(
          geoSearch.latitude,
          geoSearch.longitude,
          garage.latitude,
          garage.longitude,
        ),
      }))
      .filter((garage) => garage.distanceKm <= geoSearch.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  if (cacheKey) {
    await setCache(cacheKey, result, GARAGE_LIST_TTL);
  }

  return result;
};

const getNearbyGarages = async (userId, query = {}) => {
  const {
    maxDistance = null,
    serviceId,
    serviceIds,
    verified,
    minRating,
    openNow,
  } = query;

  const defaultLocation = await prisma.customerLocation.findFirst({
    where: {
      userId,
      isDefault: true,
    },
  });

  if (!defaultLocation) {
    throw new ApiError(404, "Default location not found");
  }

  const finalServiceIds = normalizeServiceIds(
    serviceIds || (serviceId ? [serviceId] : [])
  );

  const configuredLimit = parsePositiveNumber(maxDistance, null);
  const lookupRadiusKm = configuredLimit || GARAGE_GEO_LOOKUP_RADIUS_KM;
  const distanceRows = await queryGarageDistanceRows({
    latitude: defaultLocation.latitude,
    longitude: defaultLocation.longitude,
    radiusKm: lookupRadiusKm,
    serviceIds: finalServiceIds,
    verified,
    minRating,
    limit: 100,
  });

  let garages = distanceRows
    ? await fetchGaragesByDistanceRows(distanceRows)
    : await getGarages({
        serviceIds: finalServiceIds,
        verified,
        minRating,
        openNow,
      });

  if (openNow === "true") {
    garages = garages.filter(isGarageOpenNow);
  }

  const nearby = garages
    .map((garage) => ({
      ...garage,
      distanceKm:
        Number.isFinite(Number(garage.distanceKm))
          ? Number(garage.distanceKm)
          : calculateDistanceKm(
              defaultLocation.latitude,
              defaultLocation.longitude,
              garage.latitude,
              garage.longitude,
            ),
    }))
    .filter((garage) => {
      const garageRadius = Number(garage.workingRadiusKm) || 15;
      const effectiveRadius = configuredLimit
        ? Math.min(garageRadius, configuredLimit)
        : garageRadius;

      return garage.distanceKm <= effectiveRadius;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return addDrivingMetrics({
    latitude: defaultLocation.latitude,
    longitude: defaultLocation.longitude,
    garages: nearby,
  });
};

const findNearbyEligibleGarages = async ({
  latitude,
  longitude,
  serviceIds = [],
  maxDistance = null,
  onlyVerified = true,
  requireOpenNow = true,
  requireWalletBalance = false,
  minGarageWalletBalance = 0,
  vehicle = null,
}) => {
  const numericLatitude = parseFiniteNumber(latitude);
  const numericLongitude = parseFiniteNumber(longitude);

  if (!hasUsableCoordinates(numericLatitude, numericLongitude)) {
    throw new ApiError(400, "Customer location is required");
  }

  const finalServiceIds = normalizeServiceIds(serviceIds);

  if (finalServiceIds.length === 0) {
    throw new ApiError(400, "At least one service is required");
  }

  const configuredLimit = parsePositiveNumber(maxDistance, null);
  const lookupRadiusKm = configuredLimit || GARAGE_GEO_LOOKUP_RADIUS_KM;
  const distanceRows = await queryGarageDistanceRows({
    latitude: numericLatitude,
    longitude: numericLongitude,
    radiusKm: lookupRadiusKm,
    serviceIds: finalServiceIds,
    onlyVerified,
    requireWalletBalance,
    minGarageWalletBalance,
    vehicle,
    limit: 150,
  });

  let garages = distanceRows
    ? await fetchGaragesByDistanceRows(distanceRows, {
        ...garageIncludeForList,
        wallet: true,
      })
    : await prisma.garage.findMany({
        where: {
          isActive: true,

          ...(onlyVerified && {
            isVerified: true,
          }),

          ...buildGarageServiceFilter(finalServiceIds, vehicle),

          ...(requireWalletBalance && {
            wallet: {
              balance: {
                gte: minGarageWalletBalance,
              },
            },
          }),
        },
        include: {
          ...garageIncludeForList,
          wallet: true,
        },
        orderBy: [{ isVerified: "desc" }, { ratingAvg: "desc" }],
      });

  if (requireOpenNow) {
    garages = garages.filter(isGarageOpenNow);
  }

  const nearby = garages
    .map((garage) => {
      const serializedGarage = garage.thumbnail || garage.whatsappLink
        ? garage
        : serializeGarage(garage);

      return {
        ...serializedGarage,
        distanceKm:
          Number.isFinite(Number(garage.distanceKm))
            ? Number(garage.distanceKm)
            : calculateDistanceKm(
                numericLatitude,
                numericLongitude,
                garage.latitude,
                garage.longitude,
              ),
      };
    })
    .filter((garage) => {
      const garageRadius = Number(garage.workingRadiusKm) || 15;
      const effectiveRadius = configuredLimit
        ? Math.min(garageRadius, configuredLimit)
        : garageRadius;

      return garage.distanceKm <= effectiveRadius;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return addDrivingMetrics({
    latitude: numericLatitude,
    longitude: numericLongitude,
    garages: nearby,
  });
};

const getGarageById = async (garageId) => {
  const cacheKey = `garages:detail:${garageId}`;

  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const garage = await prisma.garage.findFirst({
    where: {
      id: garageId,
      isActive: true,
    },
    include: garageIncludeForDetails,
  });

  if (!garage) {
    throw new ApiError(404, "Garage not found");
  }

  const result = serializeGarage(garage);

  await setCache(cacheKey, result, GARAGE_DETAIL_TTL);

  return result;
};

const getGarageServices = async (garageId) => {
  const cacheKey = `garages:${garageId}:services`;

  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const garage = await prisma.garage.findFirst({
    where: {
      id: garageId,
      isActive: true,
    },
  });

  if (!garage) {
    throw new ApiError(404, "Garage not found");
  }

  const services = await prisma.garageService.findMany({
    where: {
      garageId,
      isActive: true,
    },
    include: {
      service: {
        include: {
          category: true,
          media: {
            orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
          },
        },
      },
    },
    orderBy: {
      price: "asc",
    },
  });

  const result = services.map(serializeGarageService);

  await setCache(cacheKey, result, GARAGE_DETAIL_TTL);

  return result;
};

module.exports = {
  getGarages,
  getNearbyGarages,
  findNearbyEligibleGarages,
  getGarageById,
  getGarageServices,
};
