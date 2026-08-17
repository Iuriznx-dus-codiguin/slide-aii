import { supabase } from "@/integrations/supabase/client";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 4 * 1024 * 1024;
const TEN_YEARS = 60 * 60 * 24 * 3650;

export type AvatarUploadResult = { url: string } | { error: string };

/**
 * Envia a foto de perfil para o bucket privado `avatars` e devolve uma URL assinada
 * de longa duração, utilizável tanto no app quanto no portfólio público.
 */
export async function uploadAvatar(userId: string, file: File): Promise<AvatarUploadResult> {
  if (!ALLOWED.includes(file.type)) return { error: "Formato inválido. Use PNG, JPG, WEBP ou GIF." };
  if (file.size > MAX_BYTES) return { error: "A imagem precisa ter no máximo 4 MB." };

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (uploadError) return { error: uploadError.message };

  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, TEN_YEARS);
  if (error || !data?.signedUrl) return { error: error?.message ?? "Não foi possível gerar o link da imagem." };
  return { url: data.signedUrl };
}
