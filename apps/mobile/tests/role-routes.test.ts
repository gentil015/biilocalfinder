import { homeForRole, postAuthRouteForRole } from '@/src/navigation/role-routes';

describe('postAuthRouteForRole', () => {
  it('sends providers to the provider workspace after sign-in', () => {
    expect(postAuthRouteForRole('PROVIDER')).toBe('/provider');
  });

  it('sends clients to the customer home after sign-in', () => {
    expect(postAuthRouteForRole('CLIENT')).toBe('/home');
  });
});

describe('homeForRole', () => {
  it('sends clients to the customer home', () => {
    expect(homeForRole('CLIENT')).toBe('/home');
  });

  it('sends providers to the provider home by default', () => {
    expect(homeForRole('PROVIDER')).toBe('/provider');
  });

  it('respects an explicit customer preference for dual-role providers', () => {
    expect(homeForRole('PROVIDER', 'customer')).toBe('/home');
  });

  it('does not send a client to the provider home', () => {
    expect(homeForRole('CLIENT', 'provider')).toBe('/home');
  });
});
