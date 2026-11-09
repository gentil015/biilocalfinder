import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'BII Localfinder — trusted local service providers in Rwanda';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #07130E 0%, #0B1712 48%, #123B28 100%)',
          color: '#F7FAF8',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            background:
              'linear-gradient(160deg, rgba(90, 214, 158, 0.22) 0%, rgba(11, 23, 18, 0) 52%, rgba(46, 165, 111, 0.18) 100%)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: '#2EA56F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            B
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>BII Localfinder</span>
            <span style={{ fontSize: 19, color: 'rgba(247,250,248,0.62)' }}>Rwanda&apos;s local services marketplace</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.03,
              letterSpacing: -2.5,
              maxWidth: 980,
            }}
          >
            <span>Find the right professional.</span>
            <span style={{ color: '#6FE0A8' }}>Right around you.</span>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 24, color: 'rgba(247,250,248,0.72)' }}>
            <span>Verified providers</span>
            <span style={{ color: '#6FE0A8' }}>·</span>
            <span>Clear quotes</span>
            <span style={{ color: '#6FE0A8' }}>·</span>
            <span>Book directly</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 21, color: 'rgba(247,250,248,0.5)', position: 'relative' }}>
          <span>Kigali · Rubavu · Musanze · Huye</span>
          <span>biilocalfinder.com</span>
        </div>
      </div>
    ),
    size,
  );
}
