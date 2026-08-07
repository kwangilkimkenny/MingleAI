/**
 * Profile-photo picking + upload. Wraps expo-image-picker and the client-core
 * uploadPhoto wrapper into one call that returns a discriminated result, so
 * callers branch on outcome (ok / cancelled / denied / error) without try/catch.
 */
import * as ImagePicker from "expo-image-picker";
import { uploadPhoto } from "@mingle/client-core";
import { nameFromUri, mimeFromName } from "./photo-util";

export type PickPhotoResult =
  | { status: "ok"; url: string }
  | { status: "cancelled" }
  | { status: "denied" }
  | { status: "error"; message: string };

/**
 * Prompt for a square image from the library, upload it, and return the hosted URL.
 * Permission denial and user cancellation are returned as non-error statuses.
 */
export async function pickAndUploadPhoto(
  options: { square?: boolean } = {},
): Promise<PickPhotoResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: "denied" };

  // 프로필 사진은 정사각으로 자르지만, 채팅 첨부는 원본 비율 그대로 보낸다.
  const square = options.square ?? true;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: square,
    ...(square ? { aspect: [1, 1] as [number, number] } : null),
    quality: 0.8,
  });
  if (result.canceled) return { status: "cancelled" };

  const asset = result.assets[0];
  if (!asset?.uri) return { status: "error", message: "사진을 불러오지 못했어요." };

  const name = asset.fileName ?? nameFromUri(asset.uri);
  const type = asset.mimeType ?? mimeFromName(name);

  try {
    const { url } = await uploadPhoto({ uri: asset.uri, name, type });
    return { status: "ok", url };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "업로드에 실패했어요." };
  }
}
