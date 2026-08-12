import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { Share } from "@capacitor/share";

export function isNativeTransferAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function shareNativeFile(
  bytes: Uint8Array,
  name: string,
  title: string,
): Promise<void> {
  const path = `exports/${name}`;
  await Filesystem.writeFile({ path, directory: Directory.Cache, data: bytesToBase64(bytes) });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  await Share.share({ files: [uri], title, dialogTitle: title });
}

export async function pickNativeArchive(): Promise<Uint8Array | null> {
  const result = await FilePicker.pickFiles({
    types: ["application/zip", "application/octet-stream"],
    limit: 1,
    readData: true,
  });
  const data = result.files[0]?.data;
  return data ? base64ToBytes(data) : null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replace(/^data:[^,]+,/, "")), (character) => character.charCodeAt(0));
}
