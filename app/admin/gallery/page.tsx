"use client";

import { useState, useRef } from "react";
import { Upload, Image as ImageIcon, X, Loader2 } from "lucide-react";

export default function AdminGalleryPage() {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles).filter((f) =>
      f.type.startsWith("image/")
    );
    setFiles((prev) => [...prev, ...fileArray]);

    // Generate previews
    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!selectedEvent || files.length === 0) return;
    setUploading(true);

    // TODO: Upload to Supabase Storage and create gallery_photos records
    // For now, simulate upload
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setUploading(false);
    setFiles([]);
    setPreviews([]);
    alert("Upload complete! (Connect Supabase to enable real uploads)");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Gallery Management</h1>
        <p className="text-gray-400 mt-1">
          Upload and manage event photos
        </p>
      </div>

      {/* Event Selector */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">
          Select Event
        </label>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="w-full sm:w-80 bg-dark-500 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none transition-colors"
        >
          <option value="">Choose an event...</option>
          <option value="sunset-cruise-2026">
            Sunset Boat Cruise 2026
          </option>
          <option value="tsakani-vol-5">Tsakani Sessions Vol. 5</option>
        </select>
      </div>

      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="bg-dark-500 border-2 border-dashed border-white/10 hover:border-gold-500/30 rounded-2xl p-8 sm:p-12 text-center transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="bg-gold-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload size={28} className="text-gold-500" />
        </div>
        <h3 className="text-lg font-bold mb-2">
          Drop photos here or click to browse
        </h3>
        <p className="text-gray-400 text-sm">
          Accepts JPG, PNG, WebP. Drag and drop multiple files.
        </p>
      </div>

      {/* Preview Grid */}
      {previews.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">
              {files.length} photo{files.length !== 1 ? "s" : ""} ready
            </h3>
            <button
              onClick={handleUpload}
              disabled={!selectedEvent || uploading}
              className="bg-gold-gradient text-black font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload All
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {previews.map((preview, index) => (
              <div
                key={index}
                className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group"
              >
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Galleries */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">Existing Galleries</h2>
        <div className="bg-dark-500 border border-white/10 rounded-xl p-8 text-center">
          <ImageIcon size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            No galleries yet. Upload photos to an event to create a gallery.
          </p>
        </div>
      </div>
    </div>
  );
}
