import React, { useState, useEffect, useTransition } from 'react';
import type { DriveAttachment, GoogleDriveFile } from '../types/gqueues';
import {
  fetchDriveFiles,
  openNativeGooglePicker,
  type DriveFilterType,
} from '../services/driveApi';
import {
  Search,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  X,
  Loader2,
  ExternalLink,
  Plus,
  Link as LinkIcon,
  RefreshCw,
  FolderOpen,
  Image,
  Users,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface DrivePickerModalProps {
  isOpen: boolean;
  accessToken: string;
  onClose: () => void;
  onSelectFile: (attachment: DriveAttachment) => void;
  onReauth?: () => void;
}

export const DrivePickerModal: React.FC<DrivePickerModalProps> = ({
  isOpen,
  accessToken,
  onClose,
  onSelectFile,
  onReauth,
}) => {
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<DriveFilterType>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Native Picker state
  const [isLaunchingNative, setIsLaunchingNative] = useState(false);
  const [attachedIds, setAttachedIds] = useState<Set<string>>(new Set());

  // Direct link input state
  const [customLink, setCustomLink] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [activeTab, setActiveTab] = useState<'browse' | 'directLink'>('browse');

  const loadFiles = async (query: string, filter: DriveFilterType) => {
    if (!accessToken) {
      setError('Please sign in with Google to access your Google Drive.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const driveFiles = await fetchDriveFiles(accessToken, {
        searchQuery: query,
        filterType: filter,
        pageSize: 50,
      });
      setFiles(driveFiles);
    } catch (err: any) {
      console.error('Drive fetch error:', err);
      const msg = err.message || '';
      if (msg.includes('401') || msg.includes('expired')) {
        setError('Your Google session has expired. Please re-authenticate to view your Drive files.');
      } else if (msg.includes('403') || msg.includes('scope')) {
        setError('Google Drive access scope is required. Click "Grant Drive Access" below.');
      } else {
        setError('Could not connect to Google Drive. Please check your network connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      loadFiles(searchQuery, activeFilter);
    }, searchQuery ? 300 : 0);

    return () => clearTimeout(timer);
  }, [isOpen, accessToken, searchQuery, activeFilter]);

  if (!isOpen) return null;

  const handleLaunchNativePicker = async () => {
    setIsLaunchingNative(true);
    try {
      const opened = await openNativeGooglePicker(accessToken, (att) => {
        onSelectFile(att);
        setAttachedIds((prev) => new Set(prev).add(att.id));
      });
      if (!opened) {
        // Fallback or alert if blocked
        console.info('Native picker dialog was opened or using embedded drive browser');
      }
    } catch (err) {
      console.warn('Native picker launch error:', err);
    } finally {
      setIsLaunchingNative(false);
    }
  };

  const getMimeIcon = (mimeType: string) => {
    if (mimeType.includes('document') || mimeType.includes('word')) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      return <Presentation className="w-5 h-5 text-amber-500" />;
    }
    if (mimeType.includes('pdf')) {
      return <File className="w-5 h-5 text-red-600" />;
    }
    if (mimeType.includes('image/')) {
      return <Image className="w-5 h-5 text-purple-600" />;
    }
    if (mimeType.includes('folder')) {
      return <FolderOpen className="w-5 h-5 text-yellow-500" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return null;
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return null;
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSelect = (f: GoogleDriveFile) => {
    onSelectFile({
      id: f.id,
      name: f.name,
      url: f.webViewLink,
      mimeType: f.mimeType,
    });
    setAttachedIds((prev) => new Set(prev).add(f.id));
  };

  const handleAddCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLink.trim()) return;

    let derivedName = customTitle.trim();
    if (!derivedName) {
      try {
        const urlObj = new URL(customLink.trim());
        derivedName = urlObj.hostname + urlObj.pathname.slice(0, 24);
      } catch {
        derivedName = 'Google Workspace Link';
      }
    }

    onSelectFile({
      id: 'custom-' + Date.now(),
      name: derivedName,
      url: customLink.trim(),
      mimeType: 'application/vnd.google-apps.custom-link',
    });
    setCustomLink('');
    setCustomTitle('');
    onClose();
  };

  const filterTabs: { id: DriveFilterType; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: 'All Files' },
    { id: 'docs', label: 'Docs', icon: <FileText className="w-3.5 h-3.5 text-blue-600" /> },
    { id: 'sheets', label: 'Sheets', icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> },
    { id: 'slides', label: 'Slides', icon: <Presentation className="w-3.5 h-3.5 text-amber-500" /> },
    { id: 'pdf', label: 'PDFs', icon: <File className="w-3.5 h-3.5 text-red-600" /> },
    { id: 'shared', label: 'Shared with Me', icon: <Users className="w-3.5 h-3.5 text-slate-500" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            {/* Google Drive Logo representation */}
            <div className="w-9 h-9 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.2 3.3l16.3-28.25h-29.4c0 1.6.4 3.2 1.25 4.6z" fill="#0066da"/>
                <path d="m43.65 25-16.3-28.25c-1.3.8-2.4 1.9-3.2 3.3l-22.9 39.6c-.85 1.4-1.25 3-1.25 4.6h29.4z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.3-.8 2.4-1.9 3.2-3.3l1.6-2.75c.85-1.4 1.25-3 1.25-4.6h-29.45l11.45 19.8c4.45-.45 8.65-2.9 11.95-9.15z" fill="#ea4335"/>
                <path d="m43.65 25 14.7-25.45c-1.4-.8-3-1.25-4.65-1.25h-20.1c-1.65 0-3.25.45-4.65 1.25z" fill="#00832d"/>
                <path d="m59.95 53.3h-32.65l-16.3 28.25c1.4.8 3 1.25 4.65 1.25h55.9c1.65 0 3.25-.45 4.65-1.25z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.8-22.15c-.8-1.4-1.9-2.5-3.2-3.3l-13.75 23.95 16.3 28.3h29.4c0-1.6-.4-3.2-1.25-4.6z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Google Drive Files</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Live Drive Connection
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Browse and attach real Docs, Sheets, Slides, and files from your Google Drive
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Native Picker Trigger */}
            <button
              type="button"
              onClick={handleLaunchNativePicker}
              disabled={isLaunchingNative}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-semibold shadow-2xs transition-all"
              title="Launch official Google Picker dialog"
            >
              {isLaunchingNative ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              )}
              Native Google Picker
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Browse Drive vs Paste Direct Link */}
        <div className="px-4 pt-2.5 pb-0 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('browse')}
              className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'browse'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Browse Google Drive
            </button>
            <button
              onClick={() => setActiveTab('directLink')}
              className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'directLink'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Paste Link Directly
            </button>
          </div>

          {activeTab === 'browse' && (
            <button
              onClick={() => loadFiles(searchQuery, activeFilter)}
              disabled={loading}
              className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors mb-2"
              title="Refresh files"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          )}
        </div>

        {activeTab === 'browse' ? (
          <>
            {/* Search and Category Filter Toolbar */}
            <div className="p-3 bg-slate-50/50 border-b border-slate-200 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search file name in Google Drive..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 focus:border-blue-500 rounded-lg outline-none transition-all placeholder:text-slate-400 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {filterTabs.map((tab) => {
                  const isActive = activeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        startTransition(() => {
                          setActiveFilter(tab.id);
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Files List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[300px]">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2.5">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <span className="text-xs font-medium">Connecting to Google Drive and fetching files...</span>
                </div>
              ) : error ? (
                <div className="py-10 px-4 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-700">{error}</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                      Ensure your Google account has approved the Drive integration scopes.
                    </p>
                  </div>
                  {onReauth && (
                    <button
                      onClick={onReauth}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                    >
                      Re-authorize Google Drive Access
                    </button>
                  )}
                </div>
              ) : files.length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <File className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">No Drive files found</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {searchQuery
                      ? `No files matching "${searchQuery}". Try a different search.`
                      : 'No files match this filter in your Google Drive.'}
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('directLink')}
                      className="text-xs text-blue-600 hover:underline font-semibold"
                    >
                      Paste a link directly instead →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {files.map((file) => {
                    const isAttached = attachedIds.has(file.id);
                    const sizeStr = formatFileSize(file.size);
                    const ownerName = file.owners?.[0]?.displayName;

                    return (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isAttached
                            ? 'bg-emerald-50/50 border-emerald-300'
                            : 'bg-white border-slate-200/90 hover:border-blue-400 hover:shadow-xs'
                        }`}
                      >
                        <div
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          onClick={() => handleSelect(file)}
                        >
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0">
                            {getMimeIcon(file.mimeType)}
                          </div>
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-semibold text-slate-800 truncate hover:text-blue-600">
                              {file.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                              {file.modifiedTime && (
                                <span>
                                  Modified {new Date(file.modifiedTime).toLocaleDateString()}
                                </span>
                              )}
                              {sizeStr && <span>• {sizeStr}</span>}
                              {ownerName && <span>• Owner: {ownerName}</span>}
                              {file.shared && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                  Shared
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Preview file in Google Drive"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleSelect(file)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                              isAttached
                                ? 'bg-emerald-600 text-white'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                            }`}
                          >
                            {isAttached ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" /> Attach
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer with summary and native picker shortcut */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Showing {files.length} files from Google Drive
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          /* Direct Link Paste Tab */
          <div className="p-6 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Paste Google Drive / Workspace URL</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste any link from Google Docs, Google Sheets, Google Slides, Google Drive folders, or external files.
              </p>
            </div>

            <form onSubmit={handleAddCustomLink} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Google Workspace Link URL <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    required
                    placeholder="https://docs.google.com/document/d/... or https://drive.google.com/..."
                    value={customLink}
                    onChange={(e) => setCustomLink(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Attachment Title (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Q4 Operations Strategy Doc"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('browse')}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
                >
                  Back to Drive Browse
                </button>
                <button
                  type="submit"
                  disabled={!customLink.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                >
                  Attach Link
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
