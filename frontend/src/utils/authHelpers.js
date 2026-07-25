/** Gmail addresses only for email/password signup */
export function isGmailAddress(email) {
  const e = (email || '').trim().toLowerCase();
  if (!e.includes('@')) return false;
  const domain = e.split('@')[1];
  return domain === 'gmail.com' || domain === 'googlemail.com';
}

export function isOAuthSession(session) {
  if (!session?.user) return false;
  const provider = session.user.app_metadata?.provider;
  if (provider && provider !== 'email') return true;
  const identities = session.user.identities || [];
  return identities.some((i) => i.provider && i.provider !== 'email');
}

export function isEmailVerified(session) {
  if (!session?.user) return false;
  return Boolean(session.user.email_confirmed_at);
}

export function getPostLoginPath(session, emailForVerify = '') {
  if (!session) return '/login';
  if (!isOAuthSession(session) && !isEmailVerified(session)) {
    return emailForVerify ? '/verify-email' : '/login';
  }
  return '/home';
}

export function mapAuthError(message) {
  const m = (message || '').toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'An account already exists for this Gmail address. One account per Gmail — try signing in instead.';
  }
  if (m.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (m.includes('email not confirmed')) {
    return 'Please verify your Gmail with the code we sent before signing in.';
  }
  return message || 'Something went wrong. Please try again.';
}
