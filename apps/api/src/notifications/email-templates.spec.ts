import { notificationEmail } from './email-templates';

describe('notificationEmail', () => {
  const originalWebUrl = process.env.WEB_URL;

  beforeEach(() => {
    process.env.WEB_URL = 'https://app.bii.example';
  });

  afterEach(() => {
    process.env.WEB_URL = originalWebUrl;
  });

  it('uses the title as the subject and echoes the body in both parts', () => {
    const email = notificationEmail({
      to: 'client@example.com',
      title: 'Booking confirmed',
      body: 'Your booking with Acme Plumbing is confirmed.',
    });

    expect(email.to).toBe('client@example.com');
    expect(email.subject).toBe('Booking confirmed');
    expect(email.body).toContain('Your booking with Acme Plumbing is confirmed.');
    expect(email.html).toContain('Your booking with Acme Plumbing is confirmed.');
  });

  it('renders a CTA button when a link is provided', () => {
    const email = notificationEmail({
      to: 'client@example.com',
      title: 'Booking confirmed',
      body: 'All set.',
      link: { href: 'https://app.bii.example/bookings/b-9', label: 'View booking' },
    });

    expect(email.html).toContain('href="https://app.bii.example/bookings/b-9"');
    expect(email.html).toContain('View booking');
    expect(email.body).toContain('https://app.bii.example/bookings/b-9');
  });

  it('omits the button when there is no link', () => {
    const email = notificationEmail({ to: 'x@example.com', title: 'Heads up', body: 'Something.' });
    expect(email.html).not.toContain('<a href="https://app.bii.example/bookings');
  });

  it('greets the recipient by name when provided', () => {
    const email = notificationEmail({
      to: 'x@example.com',
      title: 'Booking confirmed',
      body: 'All set.',
      recipientName: 'Aline',
    });
    expect(email.html).toContain('Hi Aline,');
    expect(email.body).toContain('Hi Aline,');
  });

  it('escapes user-supplied values interpolated into the HTML', () => {
    const email = notificationEmail({
      to: 'x@example.com',
      title: 'New quote',
      body: '<script>alert(1)</script>',
      recipientName: 'A & B <b>',
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).toContain('A &amp; B &lt;b&gt;');
  });

  it('falls back to the title as the body when no body is given', () => {
    const email = notificationEmail({ to: 'x@example.com', title: 'Booking confirmed' });
    expect(email.body).toContain('Booking confirmed');
  });
});
