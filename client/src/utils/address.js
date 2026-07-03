const compactParts = (parts = []) =>
  parts.map((part) => String(part || '').trim()).filter(Boolean);

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const uniqueParts = (parts = []) => {
  const seen = new Set();
  return compactParts(parts).filter((part) => {
    const key = normalizeKey(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const INDIA_COORDINATE_BOUNDS = {
  minLatitude: 6,
  maxLatitude: 38,
  minLongitude: 68,
  maxLongitude: 98,
};

export const hasUsableIndiaCoordinates = (location = {}) => {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;

  return (
    latitude >= INDIA_COORDINATE_BOUNDS.minLatitude &&
    latitude <= INDIA_COORDINATE_BOUNDS.maxLatitude &&
    longitude >= INDIA_COORDINATE_BOUNDS.minLongitude &&
    longitude <= INDIA_COORDINATE_BOUNDS.maxLongitude
  );
};

const withoutLocationParts = (parts = [], locationParts = []) => {
  const blocked = new Set(locationParts.map(normalizeKey).filter(Boolean));
  return uniqueParts(parts).filter((part) => !blocked.has(normalizeKey(part)));
};

export const buildFullAddress = (parts = {}) =>
  compactParts([parts.address, parts.area, parts.city, parts.pincode]).join(', ');

export const parseAddressParts = (fullAddress = '') => {
  const value = String(fullAddress || '').trim();
  if (!value) return { address: '', area: '', city: '', pincode: '' };

  const parts = compactParts(value.split(','));
  const lastPart = parts[parts.length - 1] || '';
  const pincodeMatch = value.match(/\b\d{5,6}\b/);
  const pincode = pincodeMatch?.[0] || '';
  const withoutPincode = pincode
    ? parts.map((part) => part.replace(pincode, '').trim()).filter(Boolean)
    : parts;

  const city = withoutPincode[withoutPincode.length - 1] || '';
  const area = withoutPincode.length > 1 ? withoutPincode[withoutPincode.length - 2] : '';
  const addressParts = withoutPincode.length > 2 ? withoutPincode.slice(0, -2) : withoutPincode.slice(0, 1);

  return {
    address: addressParts.join(', ') || value,
    area,
    city,
    pincode,
  };
};

export const getAddressPartsFromNominatim = (data = {}) => {
  const address = data.address || {};
  const pincode = address.postcode || '';
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.state_district ||
    '';
  const area =
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.city_district ||
    address.hamlet ||
    address.road ||
    '';
  const namedetails = data.namedetails || {};
  const name = data.name || namedetails.name || namedetails['name:en'] || '';
  const landmark = compactParts([
    address.landmark,
    address.amenity,
    address.shop,
    address.tourism,
    address.office,
    address.leisure,
    address.historic,
    address.railway,
    address.aeroway,
    address.highway,
    address.public_building,
    data.category && data.type ? name : '',
    address.building,
  ])[0];
  const streetParts = withoutLocationParts([
    address.house_number,
    address.building,
    address.road,
    address.pedestrian,
    address.footway,
  ], [area, city, pincode]);
  const landmarkPart = landmark && !streetParts.some((part) => normalizeKey(part) === normalizeKey(landmark))
    ? `Near ${landmark}`
    : '';
  const street = uniqueParts([...streetParts, landmarkPart]).join(', ');
  const parsedFallback = parseAddressParts(data.display_name || '');
  const fallbackAddress = withoutLocationParts(
    [parsedFallback.address],
    [area || parsedFallback.area, city || parsedFallback.city, pincode || parsedFallback.pincode]
  ).join(', ');

  return {
    address: street || fallbackAddress || parsedFallback.address || data.display_name || '',
    area: area || parsedFallback.area,
    city: city || parsedFallback.city,
    pincode: pincode || parsedFallback.pincode,
    fullAddress: data.display_name || buildFullAddress(parsedFallback),
  };
};

export const reverseGeocodeCoordinates = async ({ latitude, longitude }) => {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('zoom', '18');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-IN,en',
    },
  });

  if (!response.ok) {
    throw new Error('Could not resolve address for current location.');
  }

  return getAddressPartsFromNominatim(await response.json());
};

export const getDefaultUserLocation = (user) => {
  const locations = Array.isArray(user?.locations) ? user.locations : [];
  const validLocations = locations.filter(
    (item) => hasUsableIndiaCoordinates(item) && Boolean(item.address)
  );
  return validLocations.find((item) => item.isDefault) || validLocations[0] || null;
};

export const getProfileAddress = (user) =>
  user?.customerProfile?.address || user?.address || '';

export const getLocationAddress = (location) => {
  if (!location) return '';
  return location.fullAddress || buildFullAddress(location) || location.address || '';
};

export const getLocationStateFromAddress = (fullAddress = '', base = {}) => {
  const parsed = parseAddressParts(fullAddress);
  const addressText = fullAddress || buildFullAddress(parsed);

  return {
    ...parsed,
    fullAddress: addressText,
    latitude: base?.latitude ?? null,
    longitude: base?.longitude ?? null,
  };
};

export const getLocationStateFromUser = (user, fallbackLocation = null) => {
  const defaultLocation = getDefaultUserLocation(user);
  const addressText =
    defaultLocation?.address ||
    getProfileAddress(user) ||
    getLocationAddress(fallbackLocation);

  if (!addressText) return fallbackLocation || null;

  return getLocationStateFromAddress(addressText, {
    latitude: defaultLocation?.latitude ?? fallbackLocation?.latitude,
    longitude: defaultLocation?.longitude ?? fallbackLocation?.longitude,
  });
};
