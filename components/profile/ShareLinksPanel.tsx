"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ShareLinkForm from "@/components/profile/ShareLinkForm";
import {
  createShareLink,
  deleteShareLink,
  getShareLinks,
  updateShareLink,
  type ShareLinkInput,
} from "@/app/actions/share";
import type { ShareLink } from "@/lib/types";

function describe(link: ShareLink): string {
  const parts: string[] = [];
  if (link.statuses.length) parts.push(link.statuses.join(", "));
  if (link.mediaTypes.length) parts.push(link.mediaTypes.join(", "));
  if (link.favoritesOnly) parts.push("favorites only");
  return parts.length ? parts.join(" · ") : "everything";
}

export default function ShareLinksPanel() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLinks(await getShareLinks());
    setLoading(false);
  }, []);

  useEffect(() => {
    // Guarded rather than awaiting `refresh` directly: navigating away from
    // the profile mid-request would otherwise set state on an unmounted panel.
    let cancelled = false;
    getShareLinks().then((loaded) => {
      if (cancelled) return;
      setLinks(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only correct in the browser, which is where this component runs — the
  // deployed origin is not known to the server bundle.
  const urlFor = (slug: string) =>
    typeof window === "undefined"
      ? `/share/${slug}`
      : `${window.location.origin}/share/${slug}`;

  const handleCreate = async (input: ShareLinkInput) => {
    const res = await createShareLink(input);
    if (res.error) return res.error;
    setCreating(false);
    await refresh();
    toast.success("Share link created");
    return null;
  };

  const handleUpdate = async (id: string, input: ShareLinkInput) => {
    const res = await updateShareLink(id, input);
    if (res.error) return res.error;
    setEditingId(null);
    await refresh();
    toast.success("Share link updated");
    return null;
  };

  const handleRevoke = async (link: ShareLink) => {
    const res = await deleteShareLink(link.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    await refresh();
    toast.success(`/share/${link.slug} revoked`);
  };

  const handleCopy = async (link: ShareLink) => {
    try {
      await navigator.clipboard.writeText(urlFor(link.slug));
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard access can be denied outright; the URL is on screen anyway.
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  };

  return (
    // id + scroll-mt: the library's Share button links to /profile#share, and
    // scroll-mt keeps the heading clear of the sticky nav on arrival.
    <div
      id="share"
      className="relative mb-6 scroll-mt-24 border border-tui-border bg-tui-panel p-8"
    >
      <div className="absolute left-0 right-0 top-0 h-1 bg-tui-green" />

      <div className="mb-6 mt-2 flex items-start gap-3">
        <Link2 className="mt-0.5 h-4 w-4 text-tui-text-muted" />
        <div>
          <h3 className="font-bold uppercase text-tui-text">Public Links</h3>
          <p className="mt-1 text-[10px] uppercase text-tui-text-muted">
            [ ANYONE WITH THE LINK CAN VIEW — NO ACCOUNT REQUIRED ]
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-tui-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="uppercase">Loading links...</span>
        </div>
      ) : (
        <>
          {links.length === 0 && !creating && (
            <p className="mb-6 uppercase text-tui-text-muted/70">
              No public links yet. Your library is private.
            </p>
          )}

          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {links.map((link) => (
                <motion.li
                  key={link.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="border border-tui-border bg-tui-input/40 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-tui-text">
                        /share/{link.slug}
                      </div>
                      <div className="mt-1 truncate text-[10px] uppercase text-tui-text-muted">
                        {link.label ? `${link.label} — ` : ""}
                        shares {describe(link)}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <IconAction
                        onClick={() => handleCopy(link)}
                        label={copiedId === link.id ? "Copied" : "Copy"}
                        icon={
                          copiedId === link.id ? (
                            <Check className="h-3 w-3 text-tui-green" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )
                        }
                      />
                      <a
                        href={`/share/${link.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 border border-tui-border bg-tui-panel px-2.5 py-1.5 text-[10px] uppercase text-tui-text-muted transition-all hover:border-tui-text hover:text-tui-text"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                      <button
                        onClick={() =>
                          setEditingId(editingId === link.id ? null : link.id)
                        }
                        className="border border-tui-border bg-tui-panel px-2.5 py-1.5 text-[10px] uppercase text-tui-text-muted transition-all hover:border-tui-text hover:text-tui-text"
                      >
                        {editingId === link.id ? "Close" : "Edit"}
                      </button>
                      <button
                        onClick={() => handleRevoke(link)}
                        className="border border-tui-border bg-tui-panel px-2.5 py-1.5 text-[10px] uppercase text-tui-text-muted transition-all hover:border-tui-red/50 hover:text-tui-red"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>

                  {editingId === link.id && (
                    <div className="mt-5 border-t border-tui-border pt-5">
                      <ShareLinkForm
                        initial={link}
                        lockSlug
                        submitLabel="[ SAVE LINK ]"
                        onSubmit={(input) => handleUpdate(link.id, input)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <div className="mt-6">
            {creating ? (
              <div className="border border-tui-border bg-tui-input/40 p-4">
                <ShareLinkForm
                  submitLabel="[ CREATE LINK ]"
                  onSubmit={handleCreate}
                  onCancel={() => setCreating(false)}
                />
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="border border-tui-border bg-tui-panel px-6 py-2.5 font-bold uppercase text-tui-text transition-all hover:border-tui-text hover:bg-tui-input hover:text-tui-amber"
              >
                [ NEW SHARE LINK ]
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function IconAction({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 border border-tui-border bg-tui-panel px-2.5 py-1.5 text-[10px] uppercase text-tui-text-muted transition-all hover:border-tui-text hover:text-tui-text"
    >
      {icon}
      {label}
    </button>
  );
}
