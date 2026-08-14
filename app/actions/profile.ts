"use server";

import { apiErrorMessage } from "@/lib/apiError";
import { authedFetch } from "@/lib/serverFetch";

export async function updateProfile(prevState: unknown, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const image = (formData.get("image") as string)?.trim();
  const handle = (formData.get("handle") as string)?.trim().replace(/^@/, "");

  if (!name || name.length < 1) {
    return { error: "Name is required." };
  }

  if (name.length > 50) {
    return { error: "Name must be 50 characters or less." };
  }

  let parsedImage = image;
  if (parsedImage && parsedImage.length > 0) {
    if (!parsedImage.startsWith("/uploads/")) {
      if (
        !parsedImage.startsWith("http://") &&
        !parsedImage.startsWith("https://")
      ) {
        parsedImage = "https://" + parsedImage;
      }
      try {
        new URL(parsedImage);
      } catch {
        return { error: "Please enter a valid image URL." };
      }
    }
  }

  try {
    const res = await authedFetch(`/auth/me`, {
      method: "PATCH",
      body: JSON.stringify({
        name,
        image: parsedImage || null,
        // Omitted entirely when blank: sending null would ask the backend to
        // clear a handle the user simply didn't retype, and PATCH treats an
        // absent key as "leave it alone".
        ...(handle ? { handle } : {}),
      }),
    });

    if (!res.ok) {
      // The handle rules and the taken-handle conflict both arrive here, and
      // both are things the user can act on — a flat "failed" would hide them.
      return { error: await apiErrorMessage(res, "Failed to update profile.") };
    }
  } catch {
    return { error: "Failed to update profile." };
  }

  return { success: true };
}

export async function uploadAvatar(formData: FormData) {
  try {
    const res = await authedFetch(`/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.detail || data.error || "Upload failed" };
    }

    return { success: true, imageUrl: data.imageUrl };
  } catch (error) {
    console.error("Upload avatar error:", error);
    return { error: "Upload failed. Please try again." };
  }
}
