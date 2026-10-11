'use client';

import { useId, useState } from 'react';
import { AlertCircle, Camera, Star, X } from 'lucide-react';
import { reviewsApi, ApiError } from '@/lib/api';

const DIMENSIONS: { key: 'qualityRating' | 'communicationRating' | 'professionalismRating' | 'valueRating'; label: string }[] = [
  { key: 'qualityRating', label: 'Service quality' },
  { key: 'communicationRating', label: 'Communication' },
  { key: 'professionalismRating', label: 'Professionalism' },
  { key: 'valueRating', label: 'Value for money' },
];

function StarPicker({ value, onChange, size = 'h-6 w-6' }: { value: number; onChange: (n: number) => void; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className="rounded p-0.5 transition hover:scale-110"
        >
          <Star className={`${size} ${n <= value ? 'fill-rating-400 text-rating-400' : 'text-ink-200'}`} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({ bookingId, onSubmitted }: { bookingId: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [dims, setDims] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<{ storageKey: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commentId = useId();
  const fileId = useId();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const remaining = 5 - photos.length;
      const toUpload = Array.from(files).slice(0, remaining);
      const uploaded = await Promise.all(toUpload.map((f) => reviewsApi.uploadPhoto(f)));
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload photo');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (rating === 0) {
      setError('Please choose an overall rating');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reviewsApi.create(bookingId, {
        rating,
        ...dims,
        comment: comment.trim() || undefined,
        photoKeys: photos.map((p) => p.storageKey),
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="mb-5">
        <p className="eyebrow-muted">Your experience</p>
        <h3 className="card-title mt-1">Leave a review</h3>
      </div>

      <div className="field-card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p id="review-overall-label" className="label mb-0">
              Overall rating
            </p>
            <p className="hint mt-0.5">How would you rate this job overall?</p>
          </div>
          <div role="group" aria-labelledby="review-overall-label" className="flex items-center gap-3">
            <span className="sr-only">{rating > 0 ? `${rating} out of 5 stars selected` : 'No rating selected'}</span>
            <StarPicker value={rating} onChange={setRating} />
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DIMENSIONS.map((d) => (
          <div key={d.key} className="rounded-xl border border-ink-200 bg-white p-3 shadow-xs">
            <p id={`review-dim-${d.key}`} className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-ink-700">
              {d.label}
              <span className="tabular text-ink-400">{dims[d.key] ? `${dims[d.key]}/5` : '—'}</span>
            </p>
            <div role="group" aria-labelledby={`review-dim-${d.key}`}>
              <StarPicker
                size="h-4 w-4"
                value={dims[d.key] ?? 0}
                onChange={(n) => setDims((prev) => ({ ...prev, [d.key]: n }))}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="field mb-5">
        <label htmlFor={commentId} className="label">
          Your review <span className="font-normal text-ink-400">(optional)</span>
        </label>
        <textarea
          id={commentId}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="How did it go? What should the next client know?"
        />
        <p className="hint">{comment.length} / 2000 characters</p>
      </div>

      <div className="field mb-5">
        <p className="label">Photos <span className="font-normal text-ink-400">(optional)</span></p>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.storageKey} className="relative h-16 w-16 overflow-hidden rounded-lg bg-ink-100 ring-1 ring-inset ring-ink-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Review photo you added" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((x) => x.storageKey !== p.storageKey))}
                aria-label="Remove photo"
                className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-950/70 text-white backdrop-blur transition hover:bg-ink-950 focus-visible:ring-white"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
          {photos.length < 5 && (
            <label
              htmlFor={fileId}
              className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-300 bg-ink-50/60 text-ink-400 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10"
            >
              {uploading ? (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600"
                />
              ) : (
                <Camera className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="text-2xs font-semibold">{uploading ? '…' : 'Add'}</span>
              <input
                id={fileId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          )}
        </div>
        <p className="hint">Up to 5 photos. JPEG, PNG or WebP.</p>
      </div>

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <button onClick={submit} disabled={submitting || uploading} aria-busy={submitting} className="btn-primary btn-lg w-full">
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  );
}
