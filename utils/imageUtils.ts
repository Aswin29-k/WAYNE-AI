/**
 * Converts a File object to a base64 string, its mime type, and a data URL.
 * @param file The File object to convert.
 * @returns A promise that resolves with the base64 string, mime type, and data URL.
 */
export const fileToBase64 = (
    file: File,
  ): Promise<{ base64: string; mimeType: string; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // remove the prefix `data:mime/type;base64,`
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: file.type, dataUrl });
      };
      reader.onerror = (error) => reject(error);
    });
  };
  