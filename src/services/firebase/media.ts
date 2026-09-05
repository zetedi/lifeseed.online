import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './core';
import { beginNetwork, endNetwork, setUploadProgress } from '../network';
import { IMAGE_MIME, imageKindOfMime, withImageExtension, type ImageKind } from '../../domain/imageBytes';
import { IMAGE_PRIMARY_MAX_EDGE, IMAGE_PRIMARY_QUALITY } from '../../domain/imageVariant';

// Resize (cap the longest edge) and re-encode — WebP where the browser can encode it, JPEG
// where it cannot (Safari and iOS answer a WebP request with PNG bytes, silently; those
// uploads then wore `image/webp` over a 3-4 MB PNG and no share-card crawler could decode
// the face — ring 2026-09-05). The blob's REAL kind rides with it, so the upload labels
// what it holds. Keeps uploads small either way.
// The edge and quality are the primary's one truth (domain/imageVariant), shared with the recode.
const encodePhoto = (file: Blob, quality = IMAGE_PRIMARY_QUALITY / 100, maxDim = IMAGE_PRIMARY_MAX_EDGE): Promise<{ blob: Blob; kind: ImageKind }> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const longest = Math.max(w, h);
            if (longest > maxDim) {
                const scale = maxDim / longest;
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            const settle = (blob: Blob | null, wanted: ImageKind) => {
                if (!blob) { reject(new Error('Image conversion failed')); return; }
                // The kind the canvas actually produced — a browser that cannot encode the
                // asked-for type answers with another (PNG), and the label must follow the bytes.
                const kind = imageKindOfMime(blob.type) || wanted;
                resolve({ blob, kind });
            };
            canvas.toBlob(blob => {
                if (blob && imageKindOfMime(blob.type) === 'webp') { settle(blob, 'webp'); return; }
                // No WebP encoder here: JPEG is encodable everywhere and small enough.
                canvas.toBlob(jpeg => settle(jpeg, 'jpeg'), 'image/jpeg', quality);
            }, 'image/webp', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
        img.src = url;
    });

// Every photo upload in the app rides through here, so ONE integration point gives the whole
// app live transfer status: the resumable task reports 0..100 to the network store, and the
// global NetworkStatus badge shows "Uploading: N%" under the loader wherever the user is.
export const uploadImage = async (file: Blob, path: string, onProgress?: (pct: number) => void): Promise<string> => {
    const { blob, kind } = await encodePhoto(file);
    // The stored name and label follow the bytes (a/b/1.webp or a/b/1.jpg), never a wish.
    const storageRef = ref(storage, withImageExtension(path, kind));
    beginNetwork();
    setUploadProgress(0);
    try {
        await new Promise<void>((resolve, reject) => {
            const task = uploadBytesResumable(storageRef, blob, { contentType: IMAGE_MIME[kind] });
            task.on('state_changed',
                snap => {
                    const pct = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
                    setUploadProgress(pct);
                    onProgress?.(pct);
                },
                reject,
                () => resolve());
        });
        return await getDownloadURL(storageRef);
    } finally {
        setUploadProgress(null);
        endNetwork();
    }
};

// An AI-made picture arrives as a data URL. It takes the same road as a picked photo — fitted
// and encoded like every primary — instead of landing raw (a 1280² PNG weighs 2–3 MB; ring
// 2026-09-06 found the AI road the one upload path the encoder never saw).
export const uploadBase64Image = async (dataUrl: string, path: string): Promise<string> => {
    const blob = await (await fetch(dataUrl)).blob();
    return uploadImage(blob, path);
};

// Re-encode a picked image as a small WebP and return its base64 payload (no data: prefix) —
// the compact form vision models want for analysis. Reuses the same resize/encode as uploads.
// A photo as base64 for the AI's eye (the watering witness) — WebP or JPEG, and the mimeType
// names what the bytes really are.
export const fileToWebpBase64 = async (file: File, maxDim = 1024): Promise<{ data: string; mimeType: string }> => {
    const { blob, kind } = await encodePhoto(file, 0.8, maxDim);
    const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('Could not read image.'));
        r.readAsDataURL(blob);
    });
    const comma = dataUrl.indexOf(',');
    return { data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, mimeType: IMAGE_MIME[kind] };
};

