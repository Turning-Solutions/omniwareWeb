import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import sharp from 'sharp';

// Configure Cloudinary from env (client/.env when run via Next.js API)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Image optimization: max dimension and quality
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const WEBP_QUALITY = 85;

// Multer memory storage for multipart file (allow 15MB input; we optimize before upload)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB input
    fileFilter: (_req, file, cb) => {
        const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i;
        if (allowed.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only images (JPEG, PNG, GIF, WebP) are allowed'));
    },
});

export const uploadImageMiddleware = upload.single('image');

/** Extract Cloudinary public_id from a Cloudinary URL (for delete) */
function getPublicIdFromUrl(url: string): string | null {
    // Format: https://res.cloudinary.com/<cloud>/image/upload/v1234567890/<public_id>.<ext>
    const match = url.match(/\/upload\/v\d+\/(.+)\.\w+$/);
    return match ? match[1] : null;
}

export async function handleUploadImage(req: Request, res: Response): Promise<void> {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        res.status(503).json({ message: 'Image upload is not configured (Cloudinary env missing)' });
        return;
    }

    const file = (req as any).file;
    if (!file || !file.buffer) {
        res.status(400).json({ message: 'No image file provided. Use field name "image".' });
        return;
    }

    try {
        // Optimize: resize (fit within MAX_WIDTH x MAX_HEIGHT), convert to WebP, compress
        const optimized = await sharp(file.buffer)
            .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer();

        const dataUri = `data:image/webp;base64,${optimized.toString('base64')}`;
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'omniware/products',
            resource_type: 'image',
        });
        res.status(200).json({
            url: result.secure_url,
            publicId: result.public_id,
        });
    } catch (err) {
        console.error('Image optimize/upload error:', err);
        res.status(500).json({ message: (err as Error).message || 'Upload failed' });
    }
}

export async function handleDeleteImage(req: Request, res: Response): Promise<void> {
    if (!process.env.CLOUDINARY_API_SECRET) {
        res.status(503).json({ message: 'Image delete is not configured' });
        return;
    }

    const { url, publicId: rawPublicId } = req.body || {};
    const publicId = rawPublicId || (url && getPublicIdFromUrl(url));
    if (!publicId) {
        res.status(400).json({ message: 'Provide "url" (Cloudinary URL) or "publicId" to delete' });
        return;
    }

    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Cloudinary delete error:', err);
        res.status(500).json({ message: (err as Error).message || 'Delete failed' });
    }
}
