"use client";

import { useState } from "react";
import {
  Image as ImageIcon,
  Video,
  Send,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";

type Platform = "youtube" | "instagram" | "tiktok";
type ContentType = "photo" | "reel" | "short" | "video";

interface UploadJob {
  id: string;
  platform: Platform;
  contentType: ContentType;
  status: "pending" | "uploading" | "done" | "error";
  caption: string;
  file: string;
  url?: string;
}

const PLATFORMS: { id: Platform; label: string; color: string; types: ContentType[] }[] = [
  {
    id: "youtube",
    label: "YouTube",
    color: "bg-red-600",
    types: ["video", "short"],
  },
  {
    id: "instagram",
    label: "Instagram",
    color: "bg-gradient-to-r from-purple-600 to-orange-500",
    types: ["photo", "reel"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    color: "bg-white/90 text-black",
    types: ["short"],
  },
];

// Placeholder gallery photos — in production, fetched from Supabase
const galleryPhotos: { id: string; url: string; caption: string; event: string }[] = [];
const videoFiles: { id: string; name: string; path: string; duration: string; event: string }[] = [];

export default function AdminSocialPage() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState("");
  const [contentType, setContentType] = useState<ContentType>("photo");
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const togglePhoto = (id: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVideo = (id: string) => {
    setSelectedVideos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpload = async () => {
    if (selectedPlatforms.length === 0) {
      alert("Select at least one platform.");
      return;
    }

    const jobs: UploadJob[] = selectedPlatforms.map((platform) => ({
      id: `${platform}-${Date.now()}`,
      platform,
      contentType,
      status: "pending" as const,
      caption,
      file: contentType === "photo"
        ? Array.from(selectedPhotos).join(",")
        : Array.from(selectedVideos).join(","),
    }));

    setUploadJobs(jobs);

    // Simulate processing — in production this triggers the Python scripts via API
    for (const job of jobs) {
      setUploadJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: "uploading" } : j))
      );

      // Simulate upload time
      await new Promise((r) => setTimeout(r, 2000));

      setUploadJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, status: "done", url: `#${job.platform}` } : j
        )
      );
    }
  };

  const totalSelected = selectedPhotos.size + selectedVideos.size;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Social Uploads</h1>
        <p className="text-gray-400 mt-1">
          Select content and upload to YouTube, Instagram, and TikTok
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Content Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Content Type Toggle */}
          <div className="flex gap-2">
            {(["photo", "reel", "short", "video"] as ContentType[]).map((type) => (
              <button
                key={type}
                onClick={() => setContentType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  contentType === type
                    ? "bg-gold-500/10 text-gold-500 border border-gold-500/30"
                    : "bg-dark-500 border border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                {type === "photo" ? <ImageIcon size={14} /> : <Video size={14} />}
                {type.charAt(0).toUpperCase() + type.slice(1)}
                {type === "short" && "s"}
              </button>
            ))}
          </div>

          {/* Photo Grid */}
          {(contentType === "photo" || contentType === "reel") && (
            <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
              <h2 className="font-bold mb-4 flex items-center gap-2">
                <ImageIcon size={18} className="text-gold-500" />
                Gallery Photos
                {selectedPhotos.size > 0 && (
                  <span className="text-xs bg-gold-500/10 text-gold-500 px-2 py-0.5 rounded-full">
                    {selectedPhotos.size} selected
                  </span>
                )}
              </h2>
              {galleryPhotos.length === 0 ? (
                <div className="text-center py-10">
                  <ImageIcon size={32} className="text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">
                    No photos available. Upload photos to an event gallery first.
                  </p>
                  <a
                    href="/admin/gallery"
                    className="text-gold-500 text-sm hover:underline mt-2 inline-block"
                  >
                    Go to Gallery Management
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                  {galleryPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => togglePhoto(photo.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                        selectedPhotos.has(photo.id)
                          ? "border-gold-500"
                          : "border-transparent hover:border-white/20"
                      }`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption}
                        className="w-full h-full object-cover"
                      />
                      {selectedPhotos.has(photo.id) && (
                        <div className="absolute inset-0 bg-gold-500/20 flex items-center justify-center">
                          <Check size={24} className="text-gold-500" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 p-1">
                        <p className="text-white text-[10px] truncate">{photo.event}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Video List */}
          {(contentType === "video" || contentType === "short" || contentType === "reel") && (
            <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
              <h2 className="font-bold mb-4 flex items-center gap-2">
                <Video size={18} className="text-gold-500" />
                Video Files
                {selectedVideos.size > 0 && (
                  <span className="text-xs bg-gold-500/10 text-gold-500 px-2 py-0.5 rounded-full">
                    {selectedVideos.size} selected
                  </span>
                )}
              </h2>
              {videoFiles.length === 0 ? (
                <div className="text-center py-10">
                  <Video size={32} className="text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">
                    No video files available. Use the Video Pipeline to merge
                    footage, or upload CapCut exports.
                  </p>
                  <a
                    href="/admin/video"
                    className="text-gold-500 text-sm hover:underline mt-2 inline-block"
                  >
                    Go to Video Pipeline
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {videoFiles.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => toggleVideo(video.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        selectedVideos.has(video.id)
                          ? "border-gold-500/40 bg-gold-500/5"
                          : "border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="bg-dark-300 rounded-lg w-16 h-10 flex items-center justify-center">
                        <Video size={18} className="text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{video.name}</p>
                        <p className="text-xs text-gray-500">
                          {video.duration} &middot; {video.event}
                        </p>
                      </div>
                      {selectedVideos.has(video.id) && (
                        <Check size={18} className="text-gold-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Upload Config */}
        <div className="space-y-6">
          {/* Platform Selection */}
          <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
            <h2 className="font-bold mb-4">Platforms</h2>
            <div className="space-y-2">
              {PLATFORMS.filter((p) => p.types.includes(contentType)).map(
                (platform) => (
                  <button
                    key={platform.id}
                    onClick={() => togglePlatform(platform.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      selectedPlatforms.includes(platform.id)
                        ? "border-gold-500/40 bg-gold-500/5"
                        : "border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${platform.color}`}
                    >
                      {platform.label[0]}
                    </div>
                    <span className="text-sm font-medium">{platform.label}</span>
                    {selectedPlatforms.includes(platform.id) && (
                      <Check size={16} className="text-gold-500 ml-auto" />
                    )}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Caption */}
          <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
            <h2 className="font-bold mb-3">Caption</h2>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Write your caption... #TsakaniSessions"
              className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none resize-none"
            />
            <p className="text-gray-600 text-xs mt-1">
              {caption.length}/2200 characters
            </p>
          </div>

          {/* Schedule */}
          <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={scheduling}
                onChange={(e) => setScheduling(e.target.checked)}
                className="accent-gold-500"
              />
              <span className="text-sm font-medium">Schedule for later</span>
            </label>
            {scheduling && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={
              selectedPlatforms.length === 0 ||
              totalSelected === 0 ||
              uploadJobs.some((j) => j.status === "uploading")
            }
            className="w-full bg-gold-gradient text-black font-semibold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
            {scheduling ? "Schedule Upload" : "Upload Now"}
            {totalSelected > 0 && ` (${totalSelected} items)`}
          </button>

          {/* Upload Status */}
          {uploadJobs.length > 0 && (
            <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3">Upload Status</h3>
              <div className="space-y-2">
                {uploadJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-dark-300/50"
                  >
                    <div className="flex items-center gap-2">
                      {job.status === "uploading" && (
                        <Loader2 size={14} className="text-gold-500 animate-spin" />
                      )}
                      {job.status === "done" && (
                        <Check size={14} className="text-green-400" />
                      )}
                      {job.status === "pending" && (
                        <div className="w-3.5 h-3.5 rounded-full border border-gray-500" />
                      )}
                      <span className="text-sm capitalize">{job.platform}</span>
                    </div>
                    <span className="text-xs text-gray-500 capitalize">
                      {job.status}
                    </span>
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold-500 hover:text-gold-400"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Setup Notice */}
          <div className="bg-dark-500 border border-white/10 rounded-xl p-4">
            <p className="text-gray-500 text-xs leading-relaxed">
              <strong className="text-gray-400">Setup required:</strong> Each platform
              needs API credentials configured in <code className="text-gold-500">.env</code>.
              See the setup instructions in each script under{" "}
              <code className="text-gold-500">/scripts/</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
