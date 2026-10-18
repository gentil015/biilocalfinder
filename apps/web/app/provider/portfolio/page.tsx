'use client';

import { useEffect, useState } from 'react';
import { Film, ImagePlus, Images, Plus, Trash2, Wand2 } from 'lucide-react';
import { ApiError, offeringsApi, portfolioApi } from '@/lib/api';
import { PageHeader, Panel, EmptyState, LoadingBlock } from '@/components/ui/page';

interface PortfolioImageItem {
  id: string;
  url: string;
  mediaType: 'IMAGE' | 'VIDEO';
  beforeAfterRole: 'BEFORE' | 'AFTER' | null;
  beforeAfterGroup: string | null;
}

interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  projectDate: string | null;
  service: { id: string; name: string } | null;
  images: PortfolioImageItem[];
}

export default function ProviderPortfolioPage() {
  const [projects, setProjects] = useState<PortfolioItem[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', serviceId: '', projectDate: '' });

  const load = () => portfolioApi.mine().then(setProjects).catch(() => setProjects([]));

  useEffect(() => {
    Promise.all([portfolioApi.mine(), offeringsApi.mine()])
      .then(([p, o]) => {
        setProjects(p);
        setOfferings(o);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await portfolioApi.create({
        title: form.title,
        description: form.description || undefined,
        serviceId: form.serviceId || undefined,
        projectDate: form.projectDate || undefined,
      });
      setForm({ title: '', description: '', serviceId: '', projectDate: '' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create project');
    } finally {
      setCreating(false);
    }
  }

  async function removeProject(id: string) {
    await portfolioApi.remove(id);
    await load();
  }

  return (
    <main className="page-narrow py-6 pb-24 md:py-8">
      <PageHeader
        eyebrow="Provider"
        title="Portfolio"
        description="Show off past work with photos, videos, and before/after pairs — clients trust a portfolio far more than a plain description."
      />

      <Panel title="Add a project" className="mb-8">
        <form onSubmit={createProject} className="space-y-4">
          <div className="field">
            <label htmlFor="project-title" className="label">
              Project title
            </label>
            <input
              id="project-title"
              placeholder="e.g. Kimisagara wedding shoot"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="project-description" className="label">
              Description <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <textarea
              id="project-description"
              rows={2}
              placeholder="What did the job involve?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="project-service" className="label">
                Service <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <select
                id="project-service"
                value={form.serviceId}
                onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
              >
                <option value="">No category</option>
                {offerings.map((o) => (
                  <option key={o.service.id} value={o.service.id}>
                    {o.title || o.service.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="project-date" className="label">
                Project date <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <input
                id="project-date"
                type="date"
                value={form.projectDate}
                onChange={(e) => setForm({ ...form, projectDate: e.target.value })}
              />
            </div>
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button
            disabled={creating}
            className="btn-primary btn-lg w-full"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {creating ? 'Adding…' : 'Add project'}
          </button>
        </form>
      </Panel>

      {loading && <LoadingBlock label="Loading your portfolio…" />}

      {!loading && projects.length === 0 && (
        <EmptyState
          icon={Images}
          title="No portfolio projects yet"
          body="Add your first project above — then attach photos and videos to it."
        />
      )}

      <div className="flex flex-col gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onChanged={load} onRemove={() => removeProject(project.id)} />
        ))}
      </div>
    </main>
  );
}

function ProjectCard({
  project,
  onChanged,
  onRemove,
}: {
  project: PortfolioItem;
  onChanged: () => void;
  onRemove: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingBeforeAfter, setPendingBeforeAfter] = useState(false);

  async function handleImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const group = pendingBeforeAfter ? crypto.randomUUID() : undefined;
      for (const [i, file] of Array.from(files).entries()) {
        const uploaded = await portfolioApi.uploadImage(file);
        await portfolioApi.addImage(project.id, {
          url: uploaded.url,
          storageKey: uploaded.key,
          mediaType: 'IMAGE',
          beforeAfterRole: group ? (i === 0 ? 'BEFORE' : 'AFTER') : undefined,
          beforeAfterGroup: group,
        });
      }
      setPendingBeforeAfter(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload photo');
    } finally {
      setUploading(false);
    }
  }

  async function handleVideoFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await portfolioApi.uploadVideo(files[0]);
      await portfolioApi.addImage(project.id, { url: uploaded.url, storageKey: uploaded.key, mediaType: 'VIDEO' });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload video');
    } finally {
      setUploading(false);
    }
  }

  async function removeMedia(imageId: string) {
    await portfolioApi.removeImage(imageId);
    onChanged();
  }

  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink-950">{project.title}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {project.service?.name}
            {project.service && project.projectDate ? ' · ' : ''}
            {project.projectDate ? new Date(project.projectDate).toLocaleDateString() : ''}
          </p>
        </div>
        <button
          onClick={onRemove}
          className="icon-btn shrink-0"
          aria-label={`Delete project ${project.title}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {project.description && <p className="prose-copy mt-2">{project.description}</p>}

      {project.images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {project.images.map((img) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg bg-ink-100">
              {img.mediaType === 'VIDEO' ? (
                <video src={img.url} className="h-full w-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              )}
              {img.beforeAfterRole && (
                <span className="absolute left-1 top-1 rounded bg-home-night/70 px-1.5 py-0.5 text-2xs font-bold text-white">
                  {img.beforeAfterRole}
                </span>
              )}
              {img.mediaType === 'VIDEO' && (
                <span className="absolute right-1 top-1 rounded bg-home-night/70 p-1 text-white" aria-hidden="true">
                  <Film className="h-3 w-3" />
                </span>
              )}
              <button
                onClick={() => removeMedia(img.id)}
                aria-label={`Remove ${img.mediaType === 'VIDEO' ? 'video' : 'photo'} from ${project.title}`}
                className="absolute inset-0 flex items-center justify-center bg-home-night/40 text-white opacity-0 transition focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="error-text mt-2" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="btn-secondary btn-sm cursor-pointer">
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" /> Add photos
          <input type="file" accept="image/*" multiple hidden onChange={(e) => handleImageFiles(e.target.files)} disabled={uploading} />
        </label>
        <label className="btn-secondary btn-sm cursor-pointer">
          <Film className="h-3.5 w-3.5" aria-hidden="true" /> Add video
          <input type="file" accept="video/*" hidden onChange={(e) => handleVideoFile(e.target.files)} disabled={uploading} />
        </label>
        <label className="btn-secondary btn-sm cursor-pointer text-ink-700">
          <input
            type="checkbox"
            className="h-3.5 w-3.5"
            checked={pendingBeforeAfter}
            onChange={(e) => setPendingBeforeAfter(e.target.checked)}
          />
          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" /> Next 2 photos are a before/after pair
        </label>
        {uploading && <span className="text-xs font-medium text-ink-400">Uploading…</span>}
      </div>
    </div>
  );
}