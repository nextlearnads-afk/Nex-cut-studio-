/**
 * Extracts a high quality frame from a video file in the browser without server CPU load.
 */
export async function extractVideoThumbnail(
  file: File
): Promise<{ thumbnailBase64: string | null; duration: number }> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      let resolved = false;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        video.remove();
      };

      const fallbackTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ thumbnailBase64: null, duration: 0 });
        }
      }, 5000);

      video.onloadedmetadata = () => {
        const duration = video.duration || 0;
        // Seek to 1s or 15% into the video
        video.currentTime = Math.min(1.0, duration * 0.15);
      };

      video.onseeked = () => {
        if (resolved) return;
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 720;
          let width = video.videoWidth || 640;
          let height = video.videoHeight || 360;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            resolved = true;
            clearTimeout(fallbackTimer);
            cleanup();
            resolve({ thumbnailBase64: dataUrl, duration: video.duration || 0 });
            return;
          }
        } catch (e) {
          console.warn('Thumbnail canvas extraction skipped:', e);
        }

        resolved = true;
        clearTimeout(fallbackTimer);
        cleanup();
        resolve({ thumbnailBase64: null, duration: video.duration || 0 });
      };

      video.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(fallbackTimer);
          cleanup();
          resolve({ thumbnailBase64: null, duration: 0 });
        }
      };
    } catch {
      resolve({ thumbnailBase64: null, duration: 0 });
    }
  });
}
