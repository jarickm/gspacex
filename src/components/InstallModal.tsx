import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  Smartphone,
  Apple,
  Monitor,
  CheckCircle2,
  Share2,
  PlusSquare,
  X,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  QrCode,
  Sparkles,
  Info,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  getAiApiBaseUrl,
  DEFAULT_HOSTED_BACKEND_URL,
  setCustomBackendUrl,
} from '../services/aiApi';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isWindows, isAndroid, install } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'windows'>('android');
  const [isInstalling, setIsInstalling] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showQrCode, setShowQrCode] = useState(false);
  const [backendTestStatus, setBackendTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [backendTestMsg, setBackendTestMsg] = useState<string>('');

  // Set default tab based on user's detected device
  useEffect(() => {
    if (isIOS) {
      setActiveTab('ios');
    } else if (isWindows) {
      setActiveTab('windows');
    } else {
      setActiveTab('android');
    }
  }, [isIOS, isWindows]);

  const standaloneAppUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://ais-dev-enxnpelbddd7tflkv7rfjd-462514151820.asia-east1.run.app';

  // Generate QR Code data URL
  useEffect(() => {
    if (standaloneAppUrl) {
      QRCode.toDataURL(standaloneAppUrl, {
        width: 220,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code:', err));
    }
  }, [standaloneAppUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(standaloneAppUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  const handleTestBackend = async () => {
    setBackendTestStatus('testing');
    setBackendTestMsg('Testing connection to Gemini AI backend...');
    try {
      const activeBase = getAiApiBaseUrl() || DEFAULT_HOSTED_BACKEND_URL;
      const res = await fetch(`${activeBase}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendTestStatus('ok');
        setBackendTestMsg(
          `Connected! Cloud backend is online (AI Gemini Key: ${data.hasApiKey ? 'Active' : 'Missing'}).`
        );
      } else {
        setBackendTestStatus('error');
        setBackendTestMsg(`Backend responded with HTTP status ${res.status}.`);
      }
    } catch (err: any) {
      setBackendTestStatus('error');
      setBackendTestMsg(`Failed to connect: ${err?.message || 'Network error'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Install GQueues App</h3>
              <p className="text-xs text-slate-500">
                Official Native Installation • Android (WebAPK) • iOS • Windows
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Parsing Error Explanation & Solution Alert */}
        <div className="p-3.5 bg-amber-50/90 border-b border-amber-200 flex items-start gap-3 text-xs text-amber-950">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-900 text-xs">
              Got "There was a problem parsing the package" on Android?
            </span>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              Modern Android gives this error when downloading unverified APK stubs, and Google Workspace blocks OAuth logins in raw WebViews. The <strong>official, 100% verified solution</strong> is installing via <strong>Google Chrome (WebAPK)</strong> below. Android automatically generates and signs the package on your device with zero parsing errors!
            </p>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'android'
                ? 'bg-white text-emerald-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>Android</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Apple className="w-4 h-4 text-slate-800" />
            <span>iOS (iPhone/iPad)</span>
          </button>

          <button
            onClick={() => setActiveTab('windows')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'windows'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-600" />
            <span>Windows (PC)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-700">
          {/* Quick 1-Tap Install Button if Browser Supported */}
          {isInstallable && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3.5 h-3.5" /> Direct 1-Tap Install Ready
              </span>
              <p className="text-xs text-emerald-900">
                Your browser is ready to install GQueues Workspace Manager directly onto your device.
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>{isInstalling ? 'Installing...' : 'Install GQueues App Now'}</span>
              </button>
            </div>
          )}

          {isInstalled && (
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>GQueues Workspace is already installed in Standalone Mode on this device!</span>
            </div>
          )}

          {/* TAB 1: ANDROID */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              {/* Recommended: Official WebAPK Installation via Chrome */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      Official Android Installation (Google WebAPK)
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    No Parse Error • Signed by Google
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Installing through Google Chrome automatically generates an official, digitally signed <strong>WebAPK</strong> registered in your phone's app drawer, home screen, and notification center with full Google Workspace access.
                </p>

                {/* 3 Step Visual Guide */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <div className="flex-1">
                      <span className="font-bold text-slate-900">Open in Chrome or scan QR Code</span>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Open the standalone app URL directly in Google Chrome on your phone.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <div className="flex-1">
                      <span className="font-bold text-slate-900">
                        Tap the Chrome menu (⋮ 3 dots in top right)
                      </span>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="flex-1">
                      <span className="font-bold text-slate-900">Tap "Install"</span>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Android installs the official app to your phone with the GQueues icon and full-screen view.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions: Open Standalone & Copy URL */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <a
                    href={standaloneAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors no-underline text-center shadow-xs"
                  >
                    <span>Open Standalone App</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="py-2.5 px-3 bg-slate-200 hover:bg-slate-300 active:scale-[0.99] text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedLink ? 'Copied URL!' : 'Copy App URL'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQrCode(!showQrCode)}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-700" />
                    <span>{showQrCode ? 'Hide QR' : 'Show QR'}</span>
                  </button>
                </div>

                {/* QR Code Container */}
                {showQrCode && qrDataUrl && (
                  <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-2 mt-2">
                    <p className="text-xs font-bold text-slate-800">
                      Scan with your Android phone's Camera:
                    </p>
                    <img
                      src={qrDataUrl}
                      alt="GQueues App QR Code"
                      className="w-44 h-44 rounded-lg border border-slate-100 shadow-2xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Point camera to open directly in Chrome and tap <strong>Install App</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IOS (iPhone / iPad) */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Apple className="w-4 h-4 text-slate-900" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      Apple iOS Installation (Safari WebClip)
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full">
                    iPhone & iPad
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Apple iOS does not use APK files. Instead, iOS installs web applications natively via Safari's "Add to Home Screen" feature, providing a full-screen app icon and standalone workspace.
                </p>

                {/* 3 Steps for iOS */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <div className="flex-1">
                      <span className="font-bold text-slate-900">Open in Safari</span>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Open the standalone app URL in Safari (or scan the QR code).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <div className="flex-1">
                      <span className="font-bold text-slate-900">
                        Tap the Share button{' '}
                        <Share2 className="w-3.5 h-3.5 inline text-blue-600 mx-0.5" />
                      </span>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        In Safari's bottom navigation bar, tap Share, then scroll down and tap{' '}
                        <strong>
                          <PlusSquare className="w-3.5 h-3.5 inline text-slate-700 mx-0.5" />
                          Add to Home Screen
                        </strong>
                        .
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="flex-1">
                      <span className="font-bold text-slate-900">Tap "Add"</span>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        GQueues will appear on your iPhone / iPad home screen with its custom icon.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <a
                    href={standaloneAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors no-underline text-center shadow-xs"
                  >
                    <span>Open in Safari</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQrCode(!showQrCode)}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-700" />
                    <span>{showQrCode ? 'Hide QR' : 'Show QR'}</span>
                  </button>
                </div>

                {/* QR Code */}
                {showQrCode && qrDataUrl && (
                  <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-2 mt-2">
                    <p className="text-xs font-bold text-slate-800">
                      Scan with iPhone / iPad Camera:
                    </p>
                    <img
                      src={qrDataUrl}
                      alt="GQueues App QR Code"
                      className="w-44 h-44 rounded-lg border border-slate-100 shadow-2xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Tap the banner in Safari, then tap Share → Add to Home Screen.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WINDOWS */}
          {activeTab === 'windows' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-blue-700" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      Windows 10 / 11 Desktop Installation
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    Desktop Window
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Install GQueues as a standalone native window on Windows with taskbar pinning and Start Menu access.
                </p>

                {/* Method 1: Edge / Chrome Address Bar Install */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Method 1: 1-Click via Chrome or Microsoft Edge (Recommended)
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Open the standalone app tab, then click the <strong>Install</strong> icon in the address bar (or menu → <em>Apps → Install GQueues</em>).
                  </p>
                  <a
                    href={standaloneAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors no-underline shadow-2xs"
                  >
                    <span>Open Standalone Tab to Install</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Method 2: Download Windows Shortcut Installer */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    Method 2: Desktop Shortcut Installer (.bat)
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Downloads <strong>Install-GQueues-Windows.bat</strong> to your Downloads folder. Double-clicking it automatically pins GQueues to your Windows Desktop and Start Menu.
                  </p>
                  <a
                    href="/downloads/Install-GQueues-Windows.bat"
                    download="Install-GQueues-Windows.bat"
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors no-underline shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Windows Shortcut Installer</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* AI Companion Cloud Backend for Android APK, iOS & Vercel */}
          <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200/80 space-y-2 mt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                <Server className="w-3.5 h-3.5 text-blue-600" />
                <span>AI Companion Cloud Backend (Android APK • iOS • Vercel)</span>
              </div>
              <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                CORS & Serverless Ready
              </span>
            </div>

            <p className="text-[11px] text-blue-800 leading-relaxed">
              <strong>How it works:</strong> On Vercel, requests are handled by Vercel Serverless Functions with your <code>GEMINI_API_KEY</code>. On Android APKs and iOS WebClips, requests route to the live cloud backend with full CORS support.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
              <div className="text-[10px] text-slate-500 font-mono truncate max-w-xs">
                Active: {getAiApiBaseUrl() || DEFAULT_HOSTED_BACKEND_URL}
              </div>

              <button
                type="button"
                onClick={handleTestBackend}
                disabled={backendTestStatus === 'testing'}
                className="w-full sm:w-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3 h-3" />
                <span>{backendTestStatus === 'testing' ? 'Testing...' : 'Test AI Connection'}</span>
              </button>
            </div>

            {backendTestStatus !== 'idle' && (
              <div
                className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                  backendTestStatus === 'ok'
                    ? 'bg-emerald-100/80 text-emerald-900 border border-emerald-200'
                    : backendTestStatus === 'testing'
                    ? 'bg-blue-100/80 text-blue-900 border border-blue-200'
                    : 'bg-rose-100/80 text-rose-900 border border-rose-200'
                }`}
              >
                {backendTestStatus === 'ok' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                )}
                <span className="text-[11px]">{backendTestMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Official Progressive Web App • Full Google OAuth Support</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
