import React from 'react';
import {
  CheckCircle2,
  Calendar,
  HardDrive,
  Users,
  FolderKanban,
  Zap,
  ShieldCheck,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface AuthScreenProps {
  onSignIn: () => void;
  isLoading: boolean;
  error?: string | null;
  onOpenInstallModal?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onSignIn,
  isLoading,
  error,
  onOpenInstallModal,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40 flex flex-col justify-between text-slate-800">
      {/* Top Banner / Navbar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold text-xl">
            GQ
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              GQueues <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Workspace Cloud</span>
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">Full-Featured Task & Project Queues for Google Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenInstallModal && (
            <button
              onClick={onOpenInstallModal}
              className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Install App (APK/iOS/Win)</span>
            </button>
          )}

          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Google Cloud Native</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium mb-6">
          <Zap className="w-3.5 h-3.5 text-blue-600" />
          Seamless Replacement for GQueues with Real Cloud Sync
        </div>

        <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl leading-tight">
          Supercharge your <span className="text-blue-600">Google Workspace</span> with intuitive project queues
        </h2>

        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl">
          Create organized queues, breakdown subtasks, schedule directly to Google Calendar, attach Google Drive files, and delegate to teammates with zero mock data.
        </p>

        {/* Sign In Card */}
        <div className="mt-8 p-8 bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 max-w-md w-full flex flex-col items-center">
          <p className="text-sm text-slate-600 mb-6 font-medium">
            Sign in with your Google Workspace or Gmail account to connect your live queues
          </p>

          {/* Official Google Sign-In Button */}
          <button
            onClick={onSignIn}
            disabled={isLoading}
            className="gsi-material-button w-full cursor-pointer hover:shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper flex items-center justify-center gap-3">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block', width: '20px', height: '20px' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  ></path>
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  ></path>
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  ></path>
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  ></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents font-medium text-slate-800 text-sm">
                {isLoading ? 'Connecting to Google Workspace...' : 'Sign in with Google'}
              </span>
            </div>
          </button>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs text-left w-full space-y-2">
              <p>{error}</p>
              <div className="pt-1 border-t border-red-100">
                <a
                  href={typeof window !== 'undefined' ? window.location.origin : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                >
                  <span>Open in Direct Window to Sign In</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          <div className="mt-3 text-[11px] text-slate-400">
            Having trouble with browser popups?{' '}
            <a
              href={typeof window !== 'undefined' ? window.location.origin : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium inline-flex items-center gap-0.5"
            >
              Open in Direct Tab <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Google Tasks API
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Google Calendar
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" /> Google Drive
            </span>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-12 w-full text-left">
          <div className="p-4 bg-white/70 border border-slate-200/80 rounded-xl shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
              <FolderKanban className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Queues & Categories</h3>
            <p className="mt-1 text-xs text-slate-600">
              Organize projects into custom categories with color codes and nested subtask checklists.
            </p>
          </div>

          <div className="p-4 bg-white/70 border border-slate-200/80 rounded-xl shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Google Calendar Sync</h3>
            <p className="mt-1 text-xs text-slate-600">
              Schedule deadlines and tasks directly onto your primary Google Calendar in real time.
            </p>
          </div>

          <div className="p-4 bg-white/70 border border-slate-200/80 rounded-xl shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <HardDrive className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Drive File Linking</h3>
            <p className="mt-1 text-xs text-slate-600">
              Attach Google Docs, Sheets, and Drive files directly to tasks for quick team context.
            </p>
          </div>

          <div className="p-4 bg-white/70 border border-slate-200/80 rounded-xl shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Contact Delegation</h3>
            <p className="mt-1 text-xs text-slate-600">
              Delegate tasks to team members by searching your real Google Workspace company contacts.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/60 py-4 px-6 text-center text-xs text-slate-500">
        Google Workspace Companion • Connected with permission to Google Tasks, Calendar, Drive & Contacts.
      </footer>
    </div>
  );
};
