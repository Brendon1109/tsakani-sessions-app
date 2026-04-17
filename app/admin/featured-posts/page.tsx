"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ExternalLink, Loader2, Pin, EyeOff, Eye } from "lucide-react";
import type { FeaturedPost } from "@/lib/social";

export default function AdminFeaturedPostsPage() {
  const [posts, setPosts] = useState<FeaturedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newCaption, setNewCaption] = useState("");
  const [newThumbnail, setNewThumbnail] = useState("");

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    setLoading(true);
    const res = await fetch("/api/admin/featured-posts");
    if (res.ok) {
      setPosts(await res.json());
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl) return;
    setAdding(true);

    const res = await fetch("/api/admin/featured-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_url: newUrl,
        caption: newCaption || null,
        thumbnail_url: newThumbnail || null,
        sort_order: posts.length,
      }),
    });

    if (res.ok) {
      setNewUrl("");
      setNewCaption("");
      setNewThumbnail("");
      await loadPosts();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to add post");
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this pinned post?")) return;
    const res = await fetch("/api/admin/featured-posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) await loadPosts();
  }

  async function toggleActive(post: FeaturedPost) {
    await fetch("/api/admin/featured-posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: post.id, is_active: !post.is_active }),
    });
    await loadPosts();
  }

  const platformColors: Record<string, string> = {
    tiktok: "bg-black border-white/20",
    instagram: "bg-gradient-to-br from-purple-600 to-orange-500",
    youtube: "bg-red-600",
    custom: "bg-gold-gradient",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Pin size={24} className="text-gold-500" />
          Featured Posts
        </h1>
        <p className="text-gray-400 mt-1">
          Pin TikTok, Instagram, and YouTube posts to the homepage
        </p>
      </div>

      {/* Add form */}
      <div className="bg-dark-500 border border-white/10 rounded-xl p-5 mb-8">
        <h2 className="font-semibold mb-4">Pin a new post</h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Post URL (TikTok, Instagram, YouTube)
            </label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@tsakani_sessions/video/..."
              className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Caption (optional)
              </label>
              <input
                type="text"
                value={newCaption}
                onChange={(e) => setNewCaption(e.target.value)}
                placeholder="Short caption for the post"
                className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Thumbnail URL (optional — auto-fetched for TikTok)
              </label>
              <input
                type="url"
                value={newThumbnail}
                onChange={(e) => setNewThumbnail(e.target.value)}
                placeholder="https://..."
                className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={adding || !newUrl}
            className="bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
          >
            {adding ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus size={16} />
                Pin Post
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500 space-y-1">
          <p>
            <strong className="text-gray-400">TikTok:</strong> Paste the video URL
            (thumbnail auto-fetched via free oEmbed)
          </p>
          <p>
            <strong className="text-gray-400">Instagram:</strong> Paste post URL +
            manual thumbnail URL (right-click image on Instagram → Copy image
            address)
          </p>
          <p>
            <strong className="text-gray-400">YouTube:</strong> Paste video URL
            (thumbnail is automatic)
          </p>
        </div>
      </div>

      {/* Pinned posts list */}
      <div>
        <h2 className="font-semibold mb-4">Pinned Posts ({posts.length})</h2>
        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="bg-dark-500 border border-white/10 rounded-xl p-10 text-center text-gray-400">
            No posts pinned yet. Add one above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className={`bg-dark-500 border rounded-xl overflow-hidden ${
                  post.is_active
                    ? "border-white/10"
                    : "border-white/5 opacity-50"
                }`}
              >
                {post.thumbnail_url ? (
                  <div className="aspect-square bg-dark-300 overflow-hidden">
                    <img
                      src={post.thumbnail_url}
                      alt={post.caption || post.platform}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className={`aspect-square ${
                      platformColors[post.platform] || "bg-dark-300"
                    } flex items-center justify-center`}
                  >
                    <span className="text-white font-bold text-2xl capitalize">
                      {post.platform}
                    </span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded capitalize font-medium ${
                        platformColors[post.platform]
                      } text-white`}
                    >
                      {post.platform}
                    </span>
                    {!post.is_active && (
                      <span className="text-xs text-gray-500">Hidden</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mb-3 line-clamp-2">
                    {post.caption || "No caption"}
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gold-500 hover:text-gold-400 flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      View
                    </a>
                    <button
                      onClick={() => toggleActive(post)}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1 ml-auto"
                    >
                      {post.is_active ? <EyeOff size={12} /> : <Eye size={12} />}
                      {post.is_active ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
