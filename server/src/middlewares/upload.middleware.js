const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const ApiError = require("../utils/apiError");

const storage = multer.memoryStorage();
const TEMP_UPLOAD_DIR =
  process.env.UPLOAD_TEMP_DIR || path.join(os.tmpdir(), "rovauto-uploads");

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(TEMP_UPLOAD_DIR, { recursive: true, mode: 0o700 }, (error) => {
      cb(error, TEMP_UPLOAD_DIR);
    });
  },
  filename: (req, file, cb) => cb(null, crypto.randomUUID()),
});

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
  storageEngine = storage,
} = {}) =>
  multer({
    storage: storageEngine,
    fileFilter: createFileFilter(allowedMimeTypes),
    limits: {
      fileSize,
      files,
      fields,
    },
  });

const createDiskUpload = (options = {}) =>
  createUpload({ ...options, storageEngine: diskStorage });

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

const isValidImageSignature = (file, buffer) => {
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

const isValidVideoSignature = (file, buffer) => {
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

const readFileSignature = async (file) => {
  if (Buffer.isBuffer(file?.buffer)) {
    return file.buffer.subarray(0, 16);
  }

  if (!file?.path) return null;

  const handle = await fs.promises.open(file.path, "r");

  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

const flattenFiles = (files) => {
  if (!files) return [];
  if (Array.isArray(files)) return files;

  return Object.values(files).flatMap((value) =>
    Array.isArray(value) ? value : [],
  );
};

const validateUploadedFiles = async (req, res, next) => {
  try {
    const files = flattenFiles(req.files);
    if (req.file) files.push(req.file);

    for (const file of files) {
      const signature = await readFileSignature(file);
      const valid =
        IMAGE_MIME_TYPES.includes(file.mimetype)
          ? isValidImageSignature(file, signature)
          : VIDEO_MIME_TYPES.includes(file.mimetype)
            ? isValidVideoSignature(file, signature)
            : false;

      if (!valid) {
        return next(
          new ApiError(400, "Uploaded file content does not match its type"),
        );
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

const cleanupUploadedTempFiles = async (req) => {
  const files = flattenFiles(req.files);
  if (req.file) files.push(req.file);

  const paths = [
    ...new Set(files.map((file) => file?.path).filter(Boolean)),
  ];

  await Promise.all(
    paths.map(async (filePath) => {
      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }),
  );
};

const registerUploadCleanup = (req, res, next) => {
  let cleanupChain = Promise.resolve();

  const cleanup = () => {
    // Cleanup is intentionally repeatable. An `aborted` event can arrive while
    // Multer is still unwinding and attaching file metadata, so the later
    // response `close` pass gets another chance to remove anything that was
    // not visible during the first pass.
    cleanupChain = cleanupChain
      .then(() => cleanupUploadedTempFiles(req))
      .catch((error) => {
        console.error("Failed to clean up temporary upload files:", error.message);
      });
  };

  // Register before Multer starts consuming the body so partial disk files are
  // also removed when a mobile browser aborts a slow upload.
  req.once("aborted", cleanup);
  res.once("finish", cleanup);
  res.once("close", cleanup);
  return next();
};

const upload = createUpload({
  fileSize: 25 * 1024 * 1024,
  files: 10,
});

upload.createUpload = createUpload;
upload.createDiskUpload = createDiskUpload;
upload.validateUploadedFiles = validateUploadedFiles;
upload.cleanupUploadedTempFiles = cleanupUploadedTempFiles;
upload.registerUploadCleanup = registerUploadCleanup;
upload.IMAGE_MIME_TYPES = IMAGE_MIME_TYPES;
upload.VIDEO_MIME_TYPES = VIDEO_MIME_TYPES;
upload.DEFAULT_MIME_TYPES = DEFAULT_MIME_TYPES;

module.exports = upload;
