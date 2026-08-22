import React, { useRef, useState } from 'react';
import { Video, Loader2, X, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const MAX_SIZE_MB = 50;

// VideoComposer — uploads a short pack-opening reveal video via UploadFile
// and returns the embed_video object to attach to a pack-opening post.
// External videos cannot be PDS blobs, so the URL is bridged as an embed.
export default function VideoComposer({ value, onChange }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: `Video too large (max ${MAX_SIZE_MB}MB)`, variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange?.({
        url: file_url,
        platform: 'other',
        alt_text: '',
        thumbnail: '',
      });
      toast({ title: 'Video uploaded' });
    } catch (err) {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    onChange?.(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      {value?.url ? (
        <div className="flex items-center gap-3">
          <video src={value.url} className="h-16 w-24 rounded-lg bg-black object-cover" muted />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Video attached</p>
            <input
              value={value.alt_text || ''}
              onChange={(e) => onChange({ ...value, alt_text: e.target.value })}
              placeholder="Alt text (accessibility)"
              maxLength={500}
              className="mt-1 w-full rounded-lg border border-input bg-card px-2 py-1 text-xs"
            />
          </div>
          <button onClick={clear} aria-label="Remove video" className="rounded-full p-1.5 hover:bg-destructive/10 hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Upload pack-opening video'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}