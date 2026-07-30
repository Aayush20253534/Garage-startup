const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary");

const uploadToCloudinary = (
  fileSource,
  folder,
  resourceType = "image",
  uploadOptions = {},
) => {
  if (typeof fileSource === "string") {
    return cloudinary.uploader.upload(fileSource, {
      ...uploadOptions,
      folder,
      resource_type: resourceType,
    });
  }

  if (!Buffer.isBuffer(fileSource)) {
    return Promise.reject(
      new TypeError("Cloudinary upload requires a file path or buffer"),
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        ...uploadOptions,
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    streamifier.createReadStream(fileSource).pipe(stream);
  });
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};
