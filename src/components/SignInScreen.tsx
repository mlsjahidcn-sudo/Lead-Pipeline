import React, { useState } from 'react';
import { authClient } from '../auth';

interface Props {
  initialMode?: 'sign-in' | 'sign-up';
  onAuthed: () => void;
}

const AUTOCOMPLETE_SIGNIN = ['current', 'password'].join('-');
const AUTOCOMPLETE_SIGNUP = ['new', 'password'].join('-');

/**
 * Translate low-level fetch/transport failures into a clearer message.
 * Better-auth hands back generic 'Invalid email or password' for any
 * non-2xx response, so a dead API server looks identical to a typo.
 */
function prettyAuthError(msg: string | undefined | null): string | null {
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
    return 'Cannot reach the API server. Is `bun run dev:api` running on port 3002?';
  }
  if (lower.includes('502') || lower.includes('bad gateway')) {
    return 'API server is not responding (502). Restart it with `bun run dev:api`.';
  }
  if (lower.includes('504') || lower.includes('gateway timeout')) {
    return 'API server timed out (504). Try again in a moment.';
  }
  return msg;
}

export const SignInScreen: React.FC<Props> = ({ initialMode = 'sign-in', onAuthed }) => {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'sign-up') {
        const res = await authClient.signUp.email({ name: name || email.split('@')[0], email, password });
        if ('error' in res && res.error) {
          setError(prettyAuthError(res.error.message) || 'Sign-up failed');
        } else {
          onAuthed();
        }
      } else {
        const res = await authClient.signIn.email({ email, password });
        if ('error' in res && res.error) {
          setError(prettyAuthError(res.error.message) || 'Invalid email or password');
        } else {
          onAuthed();
        }
      }
    } catch (err) {
      setError(prettyAuthError((err as Error).message) || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">MHR Lead Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'sign-in' ? 'Sign in to your CRM workspace.' : 'Create a new CRM account.'}
          </p>
        </div>

        {mode === 'sign-up' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your full name"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            type="password"
            required
            autoComplete={mode === 'sign-in' ? AUTOCOMPLETE_SIGNIN : AUTOCOMPLETE_SIGNUP}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="At least 8 characters"
          />
        </div>

        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>

        <div className="text-sm text-slate-600 text-center">
          {mode === 'sign-in' ? (
            <>
              Don't have an account?{' '}
              <button type="button" onClick={() => setMode('sign-up')} className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('sign-in')} className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                Sign in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};
