import { App as CapacitorApp } from "@capacitor/app";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

export interface CapturedPhoto {
  name: string;
  mimeType: string;
  dataUrl: string;
}

type PhotoListener = (photo: CapturedPhoto) => void;
const listeners = new Set<PhotoListener>();
let restorationRegistered = false;

export function isNativeCameraAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function captureNativePhoto(): Promise<CapturedPhoto | null> {
  if (!isNativeCameraAvailable()) return null;
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 85,
    correctOrientation: true,
  });
  return photo.dataUrl ? {
    name: `camera-${Date.now()}.${photo.format || "jpg"}`,
    mimeType: `image/${photo.format || "jpeg"}`,
    dataUrl: photo.dataUrl,
  } : null;
}

export async function listenForRestoredCameraPhoto(listener: PhotoListener): Promise<() => void> {
  listeners.add(listener);
  if (isNativeCameraAvailable() && !restorationRegistered) {
    restorationRegistered = true;
    await CapacitorApp.addListener("appRestoredResult", ({ pluginId, data }) => {
      if (pluginId !== "Camera" || !data) return;
      const result = data as { dataUrl?: string; base64String?: string; format?: string };
      const dataUrl = result.dataUrl ?? (result.base64String ? `data:image/${result.format || "jpeg"};base64,${result.base64String}` : undefined);
      if (!dataUrl) return;
      const photo = {
        name: `camera-${Date.now()}.${result.format || "jpg"}`,
        mimeType: `image/${result.format || "jpeg"}`,
        dataUrl,
      };
      listeners.forEach((current) => current(photo));
    });
  }
  return () => listeners.delete(listener);
}
