import type { GoogleDriveFile, DriveAttachment } from '../types/gqueues';

export type DriveFilterType = 'all' | 'recent' | 'docs' | 'sheets' | 'slides' | 'pdf' | 'images' | 'shared';

export interface DriveFetchOptions {
  searchQuery?: string;
  filterType?: DriveFilterType;
  pageSize?: number;
}

/**
 * Fetch real files from user's Google Drive and Shared Drives
 */
export async function fetchDriveFiles(
  accessToken: string,
  options?: DriveFetchOptions
): Promise<GoogleDriveFile[]> {
  const queryParts = ['trashed = false'];

  const searchQuery = options?.searchQuery?.trim();
  if (searchQuery) {
    const escaped = searchQuery.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  const filterType = options?.filterType || 'all';

  if (filterType === 'docs') {
    queryParts.push("(mimeType = 'application/vnd.google-apps.document' or mimeType contains 'word' or mimeType contains 'document')");
  } else if (filterType === 'sheets') {
    queryParts.push("(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType contains 'spreadsheet' or mimeType contains 'excel')");
  } else if (filterType === 'slides') {
    queryParts.push("(mimeType = 'application/vnd.google-apps.presentation' or mimeType contains 'presentation' or mimeType contains 'powerpoint')");
  } else if (filterType === 'pdf') {
    queryParts.push("mimeType = 'application/pdf'");
  } else if (filterType === 'images') {
    queryParts.push("mimeType contains 'image/'");
  } else if (filterType === 'shared') {
    queryParts.push('sharedWithMe = true');
  }

  const q = queryParts.join(' and ');
  const params = new URLSearchParams({
    q,
    pageSize: String(options?.pageSize || 40),
    fields: 'files(id,name,mimeType,webViewLink,iconLink,thumbnailLink,modifiedTime,size,owners,shared)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    // If it's a 401 or 403, pass informative error
    if (res.status === 401) {
      throw new Error('Google Drive authorization expired. Please sign in again.');
    }
    if (res.status === 403) {
      throw new Error('Google Drive access scope needed. Please grant Google Drive permission.');
    }
    throw new Error(`Failed to fetch Drive files (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const files = data.files || [];

  return files.map((f: any) => ({
    id: f.id,
    name: f.name || 'Untitled File',
    mimeType: f.mimeType || 'application/octet-stream',
    webViewLink: f.webViewLink || `https://drive.google.com/open?id=${f.id}`,
    iconLink: f.iconLink,
    thumbnailLink: f.thumbnailLink,
    modifiedTime: f.modifiedTime,
    size: f.size,
    owners: f.owners,
    shared: f.shared,
  }));
}

/**
 * Loads the Google API client script and initializes the Google Picker library
 */
export function loadPickerLibrary(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window not available'));
    }

    if ((window as any).google?.picker) {
      return resolve();
    }

    const checkGapi = () => {
      if ((window as any).gapi) {
        (window as any).gapi.load('picker', {
          callback: () => resolve(),
          onerror: (err: any) => reject(new Error(`Failed to load Google Picker API: ${err}`)),
        });
        return true;
      }
      return false;
    };

    if (checkGapi()) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (checkGapi()) {
        clearInterval(interval);
      } else if (attempts > 30) {
        clearInterval(interval);
        reject(new Error('Google API client script timed out'));
      }
    }, 150);
  });
}

/**
 * Opens the native Google Picker UI dialog
 */
export async function openNativeGooglePicker(
  accessToken: string,
  onSelect: (attachment: DriveAttachment) => void
): Promise<boolean> {
  try {
    await loadPickerLibrary();

    const google = (window as any).google;
    if (!google?.picker) {
      console.warn('Google Picker library not ready');
      return false;
    }

    const pickerOrigin =
      window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
        ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
        : window.location.origin;

    const docsView = new google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const picker = new google.picker.PickerBuilder()
      .addView(docsView)
      .addView(google.picker.ViewId.DOCS)
      .addView(google.picker.ViewId.SPREADSHEETS)
      .addView(google.picker.ViewId.PRESENTATIONS)
      .addView(google.picker.ViewId.PDFS)
      .addView(google.picker.ViewId.RECENTLY_PICKED)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(accessToken)
      .setOrigin(pickerOrigin)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const docs = data[google.picker.Response.DOCUMENTS] || data.docs || [];
          docs.forEach((doc: any) => {
            onSelect({
              id: doc.id,
              name: doc.name,
              url: doc.url || `https://drive.google.com/open?id=${doc.id}`,
              mimeType: doc.mimeType || 'application/vnd.google-apps.file',
            });
          });
        }
      })
      .build();

    picker.setVisible(true);
    return true;
  } catch (err) {
    console.warn('Native Google Picker failed or was blocked by browser iframe environment:', err);
    return false;
  }
}
