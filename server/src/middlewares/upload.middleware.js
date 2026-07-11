const multer = require("multer");
const ApiError = require("../utils/apiError");

const storage = multer.memoryStorage();

const IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];
const DEFAULT_MIME_TYPES = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES];

const createFileFilter = (allowedMimeTypes = DEFAULT_MIME_TYPES) => (
  req,
  file,
  cb,
) => {
  if (allowedMimeTypes.includes(file.mimetype)) return cb(null, true);

  return cb(new ApiError(400, "Invalid file type"), false);
};

const createUpload = ({
  fileSize = 10 * 1024 * 1024,
  files = 10,
  fields = 20,
  allowedMimeTypes = DEFAULT_MIME_TYPES,
} = {}) =>
  multer({
    storage,
    fileFilter: createFileFilter(allowedMimeTypes),
    limits: {
      fileSize,
      files,
      fields,
    },
  });

const hasPrefix = (buffer, signature) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => buffer[index] === byte);
};

const hasAscii = (buffer, offset, value) =>
  Buffer.isBuffer(buffer) &&
  buffer.length >= offset + value.length &&
  buffer.toString("ascii", offset, offset + value.length) === value;

const isValidImageSignature = (file) => {
  const buffer = file?.buffer;

  if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
    return hasPrefix(buffer, [0xff, 0xd8, 0xff]);
  }

  if (file.mimetype === "image/png") {
    return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  if (file.mimetype === "image/webp") {
    return hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "WEBP");
  }

  return false;
};

const isValidVideoSignature = (file) => {
  const buffer = file?.buffer;

  if (file.mimetype === "video/mp4" || file.mimetype === "video/quicktime") {
    return hasAscii(buffer, 4, "ftyp");
  }

  if (file.mimetype === "video/x-msvideo") {
    return hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "AVI ");
  }

  if (file.mimetype === "video/x-matroska") {
    return hasPrefix(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
  }

  return false;
};

const flattenFiles = (files) => {
  if (!files) return [];
  if (Array.isArray(files)) return files;

  return Object.values(files).flatMap((value) =>
    Array.isArray(value) ? value : [],
  );
};

const validateUploadedFiles = (req, res, next) => {
  const files = flattenFiles(req.files);
  if (req.file) files.push(req.file);

  for (const file of files) {
    const valid =
      IMAGE_MIME_TYPES.includes(file.mimetype)
        ? isValidImageSignature(file)
        : VIDEO_MIME_TYPES.includes(file.mimetype)
          ? isValidVideoSignature(file)
          : false;

    if (!valid) {
      return next(new ApiError(400, "Uploaded file content does not match its type"));
    }
  }

  return next();
};

const upload = createUpload({
  fileSize: 25 * 1024 * 1024,
  files: 10,
});

upload.createUpload = createUpload;
upload.validateUploadedFiles = validateUploadedFiles;
upload.IMAGE_MIME_TYPES = IMAGE_MIME_TYPES;
upload.VIDEO_MIME_TYPES = VIDEO_MIME_TYPES;
upload.DEFAULT_MIME_TYPES = DEFAULT_MIME_TYPES;

module.exports = upload;
