// Identifies a file by its leading bytes instead of trusting the client's
// Content-Type header. Verification documents are sensitive and reviewed by
// staff, so a renamed .exe/.html must not get in.
export type SniffedMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf'
  | 'video/mp4'
  | 'video/webm'
  | 'video/quicktime'
  | 'audio/webm'
  | 'audio/mp4'
  | 'audio/mpeg'
  | 'audio/ogg'
  | 'audio/wav';

/**
 * `declaredMime` is only used to disambiguate containers that share the same
 * signature (WebM audio vs video, MP4 audio vs video). The bytes still have to
 * match the container — the header can never smuggle in an unrelated file.
 */
export function sniffMime(buf: Buffer, declaredMime?: string): SniffedMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF') {
    const riffType = buf.subarray(8, 12).toString('ascii');
    if (riffType === 'WEBP') return 'image/webp';
    if (riffType === 'WAVE') return 'audio/wav';
  }
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  // ID3-tagged MP3, or a raw MPEG audio frame header.
  if (buf.length >= 3 && buf.subarray(0, 3).toString('ascii') === 'ID3') return 'audio/mpeg';
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  // Ogg container (Opus/Vorbis voice notes).
  if (buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  // ISO Base Media files (MP4/MOV/M4A) start with a box size then the `ftyp`
  // marker. The major brand at bytes 8-12 distinguishes QuickTime and audio.
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (declaredMime?.startsWith('audio/') || brand === 'M4A ' || brand === 'M4B ') return 'audio/mp4';
    return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  }
  // WebM/Matroska EBML header — the same container carries both audio and
  // video, so the declared type picks which one to record.
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return declaredMime?.startsWith('audio/') ? 'audio/webm' : 'video/webm';
  }
  return null;
}
