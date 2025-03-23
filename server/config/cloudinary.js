const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Define folder paths for different types of uploads
const FOLDERS = {
  BLOGS: "8senses/blogs",
  PROFILES: "8senses/profiles",
  PRODUCTS: "8senses/products",
  CATEGORIES: "8senses/categories",
  COURSES_THUMBNAILS: "8senses/courses/thumbnails",
  COURSES_VIDEOS: "8senses/courses/videos",
  WEBINARS_THUMBNAILS: "8senses/webinars/thumbnails",
  TOYS: "8senses/toys",
  PATIENTS_PHOTOS: "8senses/patients/photos",
  PARENTS_PHOTOS: "8senses/patients/parent_photos",
  BIRTH_CERTIFICATES: "8senses/patients/birth_certificates",
  AADHAR_CARDS: "8senses/patients/aadhar_cards",
  MEDICAL_RECORDS: "8senses/patients/medical_records",
  APPOINTMENT_DOCUMENTS: "8senses/appointments/documents",
  THERAPIST_CERTIFICATES: "8senses/therapists/certificates",
  SERVICES: "8senses/services",
  USER_PROFILES: "8senses/users/profiles",
  RESUMES: "8senses/jobs/resumes",
  GALLERY: "8senses/gallery",
  DISEASES: "8senses/diseases",
};

// File upload options for different types
const UPLOAD_OPTIONS = {
  // Default image options
  image: {
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ quality: "auto:good", fetch_format: "auto" }],
    resource_type: "image",
  },
  // Document options
  document: {
    allowed_formats: ["jpg", "jpeg", "png", "pdf", "doc", "docx"],
    resource_type: "auto",
  },
  // Video options
  video: {
    allowed_formats: ["mp4", "mov", "avi", "wmv", "mkv"],
    resource_type: "video",
    chunk_size: 20000000, // 20MB chunks for large files
  },
};

// Configure cloudinary storage for each type of upload

// Blog Image Upload
const blogImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.BLOGS,
    resource_type: "image",
    allowed_formats: UPLOAD_OPTIONS.image.allowed_formats,
    transformation: UPLOAD_OPTIONS.image.transformation,
  },
});

// Product Image Upload
const productImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.PRODUCTS,
    resource_type: "image",
    allowed_formats: UPLOAD_OPTIONS.image.allowed_formats,
    transformation: UPLOAD_OPTIONS.image.transformation,
  },
});

// Category Image Upload
const categoryImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.CATEGORIES,
    resource_type: "image",
    allowed_formats: UPLOAD_OPTIONS.image.allowed_formats,
    transformation: UPLOAD_OPTIONS.image.transformation,
  },
});

// Course Thumbnail Upload
const courseThumbnailStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.COURSES_THUMBNAILS,
    resource_type: "image",
    allowed_formats: UPLOAD_OPTIONS.image.allowed_formats,
    transformation: UPLOAD_OPTIONS.image.transformation,
  },
});

// Course Video Upload
const courseVideoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.COURSES_VIDEOS,
    resource_type: "video",
    allowed_formats: UPLOAD_OPTIONS.video.allowed_formats,
  },
});

// Webinar Thumbnail Upload
const webinarThumbnailStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.WEBINARS_THUMBNAILS,
    resource_type: "image",
    allowed_formats: UPLOAD_OPTIONS.image.allowed_formats,
    transformation: UPLOAD_OPTIONS.image.transformation,
  },
});

// Toy Image Upload
const toyImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.TOYS,
    resource_type: "image",
    allowed_formats: UPLOAD_OPTIONS.image.allowed_formats,
    transformation: UPLOAD_OPTIONS.image.transformation,
  },
});

// Patient Photo Upload
const patientPhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.PATIENTS_PHOTOS,
    resource_type: "image",
    allowed_formats: UPLOAD_OPTIONS.image.allowed_formats,
    transformation: UPLOAD_OPTIONS.image.transformation,
  },
});

// Parent Photo Upload
const parentPhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.PARENTS_PHOTOS,
    resource_type: "image",
    allowed_formats: UPLOAD_OPTIONS.image.allowed_formats,
    transformation: UPLOAD_OPTIONS.image.transformation,
  },
});

// Birth Certificate Upload
const birthCertificateStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.BIRTH_CERTIFICATES,
    resource_type: "auto",
    allowed_formats: UPLOAD_OPTIONS.document.allowed_formats,
  },
});

// Aadhar Card Upload
const aadharCardStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.AADHAR_CARDS,
    resource_type: "auto",
    allowed_formats: UPLOAD_OPTIONS.document.allowed_formats,
  },
});

// Medical Records Upload
const medicalRecordsStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.MEDICAL_RECORDS,
    resource_type: "auto",
    allowed_formats: UPLOAD_OPTIONS.document.allowed_formats,
  },
});

// Resume Upload Storage
const resumeStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.RESUMES,
    resource_type: "auto",
    allowed_formats: ["pdf", "doc", "docx", "jpg", "jpeg", "png"],
  },
});

// Gallery Image Upload
const galleryImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.GALLERY,
    resource_type: "image",
    allowed_formats: UPLOAD_OPTIONS.image.allowed_formats,
    transformation: UPLOAD_OPTIONS.image.transformation,
  },
});

// Disease Image Upload
const diseaseImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.DISEASES,
    resource_type: "image",
    allowed_formats: UPLOAD_OPTIONS.image.allowed_formats,
    transformation: UPLOAD_OPTIONS.image.transformation,
  },
});

// Create multer upload middleware for each type
const blogImageUpload = multer({
  storage: blogImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for images
});

const productImageUpload = multer({
  storage: productImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const categoryImageUpload = multer({
  storage: categoryImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const courseThumbnailUpload = multer({
  storage: courseThumbnailStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const courseVideoUpload = multer({
  storage: courseVideoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
});

const webinarThumbnailUpload = multer({
  storage: webinarThumbnailStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const toyImageUpload = multer({
  storage: toyImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const patientPhotoUpload = multer({
  storage: patientPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const parentPhotoUpload = multer({
  storage: parentPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const birthCertificateUpload = multer({
  storage: birthCertificateStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for documents
});

const aadharCardUpload = multer({
  storage: aadharCardStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const medicalRecordsUpload = multer({
  storage: medicalRecordsStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Create multer upload middleware for resumes
const resumeUpload = multer({
  storage: resumeStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB file size limit
    fieldSize: 25 * 1024 * 1024, // 25MB field size limit for larger form data
  },
  fileFilter: (req, file, cb) => {
    // Log the file information for debugging
    // console.log("Resume upload - file information:", {
    //   fieldname: file.fieldname,
    //   originalname: file.originalname,
    //   encoding: file.encoding,
    //   mimetype: file.mimetype,
    //   size: file.size,
    // });

    // Accept documents and images
    if (
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/msword" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/png"
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed."
        ),
        false
      );
    }
  },
});

const galleryImageUpload = multer({
  storage: galleryImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for gallery images
});

const diseaseImageUpload = multer({
  storage: diseaseImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for disease images
});

/**
 * Upload a file directly to Cloudinary
 * @param {Object} file - The file to upload (base64 or URL)
 * @param {String} folder - The folder to upload to
 * @param {Object} options - Upload options
 * @returns {Promise} - Cloudinary upload result
 */
const uploadToCloudinary = async (
  file,
  folder,
  options = UPLOAD_OPTIONS.image
) => {
  try {
    // Combine folder and options
    const uploadOptions = {
      folder,
      ...options,
    };

    // Upload the file to Cloudinary
    const result = await cloudinary.uploader.upload(file, uploadOptions);

    return {
      public_id: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      resource_type: result.resource_type,
      created_at: result.created_at,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Delete a file from Cloudinary
 * @param {String} publicId - The public ID of the file to delete
 * @param {String} resourceType - The resource type (image, video, raw)
 * @returns {Promise} - Cloudinary deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

module.exports = {
  cloudinary,
  FOLDERS,
  UPLOAD_OPTIONS,
  uploadToCloudinary,
  deleteFromCloudinary,
  resumeUpload,
  blogImageUpload,
  productImageUpload,
  categoryImageUpload,
  courseThumbnailUpload,
  courseVideoUpload,
  webinarThumbnailUpload,
  toyImageUpload,
  patientPhotoUpload,
  parentPhotoUpload,
  birthCertificateUpload,
  aadharCardUpload,
  medicalRecordsUpload,
  galleryImageUpload,
  diseaseImageUpload,
};
