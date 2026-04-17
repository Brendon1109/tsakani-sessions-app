"use client";

import { useState } from "react";
import {
  Video,
  Play,
  Music,
  GripVertical,
  Plus,
  Trash2,
  Settings,
  ChevronDown,
  ChevronUp,
  Loader2,
  ListChecks,
} from "lucide-react";
import VideoJobsPanel from "@/components/VideoJobsPanel";

type SyncMode = "replace" | "align" | "offset";

interface ClipEntry {
  id: string;
  file: string;
  label: string;
  type: "intro" | "main" | "transition" | "outro";
  start: number;
  end: number;
  audioOffset: number | null;
  duration?: number;
}

interface AudioConfig {
  file: string;
  startOffset: number;
  fadeIn: number;
  fadeOut: number;
}

const defaultAudio: AudioConfig = {
  file: "",
  startOffset: 0,
  fadeIn: 2,
  fadeOut: 3,
};

const SYNC_MODE_INFO: Record<SyncMode, { label: string; desc: string }> = {
  replace: {
    label: "Replace",
    desc: "Strip all video audio, overlay VirtualDJ mix from start. Best when DJ mix was recorded during the same session as footage.",
  },
  align: {
    label: "Align + Crowd",
    desc: "Blend VirtualDJ mix with original crowd noise from the video. Adjust crowd volume to taste.",
  },
  offset: {
    label: "Per-Clip Offset",
    desc: "Each clip specifies where in the DJ mix its audio should start. For when clips were filmed at known points in the set.",
  },
};

export default function AdminVideoPage() {
  const [clips, setClips] = useState<ClipEntry[]>([]);
  const [audio, setAudio] = useState<AudioConfig>(defaultAudio);
  const [syncMode, setSyncMode] = useState<SyncMode>("replace");
  const [crowdMix, setCrowdMix] = useState(0.15);
  const [resolution, setResolution] = useState("1920x1080");
  const [fps, setFps] = useState(30);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    output_file: string;
    duration_seconds: number;
    size_mb: number;
  } | null>(null);

  const addClip = (type: ClipEntry["type"]) => {
    const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setClips((prev) => [
      ...prev,
      { id, file: "", label: type, type, start: 0, end: 0, audioOffset: null },
    ]);
  };

  const updateClip = (id: string, field: keyof ClipEntry, value: string | number | null) => {
    setClips((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const removeClip = (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
  };

  const moveClip = (index: number, direction: -1 | 1) => {
    const newClips = [...clips];
    const target = index + direction;
    if (target < 0 || target >= newClips.length) return;
    [newClips[index], newClips[target]] = [newClips[target], newClips[index]];
    setClips(newClips);
  };

  const buildConfig = () => {
    const introClips = clips.filter((c) => c.type === "intro");
    const mainClips = clips.filter((c) => c.type === "main");
    const transitionClips = clips.filter((c) => c.type === "transition");
    const outroClips = clips.filter((c) => c.type === "outro");

    return {
      output: { resolution, fps, codec: "libx264", preset: "medium", crf: 23, audio_codec: "aac", audio_bitrate: "192k" },
      sync_mode: syncMode,
      crowd_mix: crowdMix,
      clips: {
        intro: introClips[0] ? { file: introClips[0].file, duration: introClips[0].end || 5 } : {},
        main_footage: mainClips.map((c) => ({
          file: c.file, start: c.start, end: c.end,
          ...(syncMode === "offset" ? { audio_offset: c.audioOffset } : {}),
        })),
        transitions: transitionClips.map((c) => ({
          file: c.file,
          ...(syncMode === "offset" ? { audio_offset: c.audioOffset } : {}),
        })),
        more_footage: [],
        outro: outroClips[0] ? { file: outroClips[0].file, duration: outroClips[0].end || 5 } : {},
      },
      audio: {
        file: audio.file,
        start_offset: audio.startOffset,
        fade_in: audio.fadeIn,
        fade_out: audio.fadeOut,
      },
    };
  };

  const handleProcess = async () => {
    if (!audio.file || clips.length === 0) {
      alert("Add at least one clip and a VirtualDJ audio file.");
      return;
    }
    setProcessing(true);
    setResult(null);

    const config = buildConfig();

    try {
      const response = await fetch("/api/admin/video-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });

      if (response.ok) {
        setResult({
          status: "queued",
          output_file:
            "Job queued. Run scripts/video_worker.py on a machine with your footage and FFmpeg.",
          duration_seconds: 0,
          size_mb: 0,
        });
      } else {
        const data = await response.json();
        alert(data.error || "Failed to queue job");
      }
    } catch {
      alert("Failed to queue job. Check your connection.");
    } finally {
      setProcessing(false);
    }
  };

  const clipTypeColors: Record<string, string> = {
    intro: "border-l-green-500",
    main: "border-l-gold-500",
    transition: "border-l-blue-500",
    outro: "border-l-purple-500",
  };

  const clipTypeLabels: Record<string, string> = {
    intro: "Intro",
    main: "DJ Footage",
    transition: "Transition",
    outro: "Outro",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Video Pipeline</h1>
        <p className="text-gray-400 mt-1">
          Build the clip sequence, configure audio sync, and trigger the merge
        </p>
      </div>

      {/* Live Job Queue */}
      <div className="mb-8">
        <h2 className="font-bold mb-3 flex items-center gap-2">
          <ListChecks size={18} className="text-gold-500" />
          Job Queue
        </h2>
        <VideoJobsPanel />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Clip Sequence */}
        <div className="lg:col-span-2 space-y-6">
          {/* Clip List */}
          <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2">
                <Video size={18} className="text-gold-500" />
                Clip Sequence
              </h2>
              <div className="flex gap-2">
                {(["intro", "main", "transition", "outro"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => addClip(type)}
                    className="text-xs bg-dark-300 hover:bg-dark-200 border border-white/10 text-gray-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} />
                    {clipTypeLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            {clips.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                Add clips using the buttons above. Drag to reorder.
                <br />
                Template: Intro → DJ Footage → Transition → DJ Footage → Outro
              </div>
            ) : (
              <div className="space-y-2">
                {clips.map((clip, index) => (
                  <div
                    key={clip.id}
                    className={`bg-dark-300/50 border-l-4 ${clipTypeColors[clip.type]} rounded-lg p-4`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5 pt-1">
                        <button
                          onClick={() => moveClip(index, -1)}
                          className="text-gray-500 hover:text-white transition-colors"
                          disabled={index === 0}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <GripVertical size={14} className="text-gray-600" />
                        <button
                          onClick={() => moveClip(index, 1)}
                          className="text-gray-500 hover:text-white transition-colors"
                          disabled={index === clips.length - 1}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>

                      {/* Clip config */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                            {clipTypeLabels[clip.type]}
                          </span>
                          <span className="text-xs text-gray-600">#{index + 1}</span>
                        </div>
                        <input
                          type="text"
                          value={clip.file}
                          onChange={(e) => updateClip(clip.id, "file", e.target.value)}
                          placeholder="Filename (e.g. dji_clip_01.mp4)"
                          className="w-full bg-dark-400 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">Trim start (s)</label>
                            <input
                              type="number"
                              min={0}
                              value={clip.start}
                              onChange={(e) => updateClip(clip.id, "start", parseFloat(e.target.value) || 0)}
                              className="w-full bg-dark-400 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-gold-500 focus:outline-none"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">Trim end (s, 0=full)</label>
                            <input
                              type="number"
                              min={0}
                              value={clip.end}
                              onChange={(e) => updateClip(clip.id, "end", parseFloat(e.target.value) || 0)}
                              className="w-full bg-dark-400 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-gold-500 focus:outline-none"
                            />
                          </div>
                          {syncMode === "offset" && (
                            <div className="flex-1">
                              <label className="text-xs text-gray-500">Audio offset (s)</label>
                              <input
                                type="number"
                                min={0}
                                value={clip.audioOffset ?? ""}
                                onChange={(e) => updateClip(clip.id, "audioOffset", e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="auto"
                                className="w-full bg-dark-400 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-gold-500 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => removeClip(clip.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generated Config Preview */}
          {clips.length > 0 && (
            <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Settings size={14} className="text-gold-500" />
                Generated Config (for CLI)
              </h3>
              <pre className="bg-dark-700 rounded-lg p-4 text-xs text-gray-400 overflow-x-auto max-h-48">
                {JSON.stringify(buildConfig(), null, 2)}
              </pre>
              <p className="text-gray-600 text-xs mt-2">
                Copy this JSON and pass to: <code className="text-gold-500">python video_merge.py --json-config &apos;...&apos;</code>
              </p>
            </div>
          )}
        </div>

        {/* Right: Audio & Settings */}
        <div className="space-y-6">
          {/* Audio Config */}
          <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Music size={18} className="text-gold-500" />
              VirtualDJ Audio
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Audio File</label>
                <input
                  type="text"
                  value={audio.file}
                  onChange={(e) => setAudio((a) => ({ ...a, file: e.target.value }))}
                  placeholder="virtualdj_mix.mp3"
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Start offset (skip first N seconds of the mix)
                </label>
                <input
                  type="number"
                  min={0}
                  value={audio.startOffset}
                  onChange={(e) => setAudio((a) => ({ ...a, startOffset: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Fade in (s)</label>
                  <input
                    type="number"
                    min={0}
                    value={audio.fadeIn}
                    onChange={(e) => setAudio((a) => ({ ...a, fadeIn: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Fade out (s)</label>
                  <input
                    type="number"
                    min={0}
                    value={audio.fadeOut}
                    onChange={(e) => setAudio((a) => ({ ...a, fadeOut: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sync Mode */}
          <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
            <h2 className="font-bold mb-4">Audio Sync Mode</h2>
            <div className="space-y-2">
              {(Object.keys(SYNC_MODE_INFO) as SyncMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSyncMode(mode)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    syncMode === mode
                      ? "border-gold-500/40 bg-gold-500/5"
                      : "border-white/5 hover:border-white/15"
                  }`}
                >
                  <p className={`text-sm font-medium ${syncMode === mode ? "text-gold-500" : "text-white"}`}>
                    {SYNC_MODE_INFO[mode].label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {SYNC_MODE_INFO[mode].desc}
                  </p>
                </button>
              ))}
            </div>

            {syncMode === "align" && (
              <div className="mt-4">
                <label className="text-xs text-gray-400 block mb-1">
                  Crowd noise volume: {Math.round(crowdMix * 100)}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={crowdMix}
                  onChange={(e) => setCrowdMix(parseFloat(e.target.value))}
                  className="w-full accent-gold-500"
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Silent</span>
                  <span>Full</span>
                </div>
              </div>
            )}
          </div>

          {/* Output Settings */}
          <div className="bg-dark-500 border border-white/10 rounded-xl p-5">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full"
            >
              <h2 className="font-bold flex items-center gap-2">
                <Settings size={18} className="text-gray-400" />
                Output Settings
              </h2>
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Resolution</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                  >
                    <option value="1920x1080">1080p (1920x1080)</option>
                    <option value="1280x720">720p (1280x720)</option>
                    <option value="3840x2160">4K (3840x2160)</option>
                    <option value="1080x1920">1080p Portrait (9:16)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">FPS</label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value))}
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
                  >
                    <option value={24}>24 fps</option>
                    <option value={30}>30 fps</option>
                    <option value={60}>60 fps</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Process Button */}
          <button
            onClick={handleProcess}
            disabled={processing || clips.length === 0 || !audio.file}
            className="w-full bg-gold-gradient text-black font-semibold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Queueing Job...
              </>
            ) : (
              <>
                <Play size={18} />
                Queue for Worker
              </>
            )}
          </button>

          {result && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm">
              <p className="text-green-400 font-medium">Project saved!</p>
              <p className="text-gray-400 text-xs mt-1">
                Run the merge from terminal:<br />
                <code className="text-gold-500">python scripts/video_merge.py --json-config &apos;...&apos;</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
