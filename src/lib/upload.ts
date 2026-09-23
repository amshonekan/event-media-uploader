import type { ISession, IUploadItem } from './types';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function getApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

export async function uploadItem(
  item: IUploadItem,
  passcode: string,
  onProgress: (progress: number) => void,
  onAuthorised: () => void,
) {
  if (item.file.size > 2 * 1024 * 1024 * 1024) {
    throw new Error('This file is over the 2 GB limit.');
  }

  const sessionResponse = await fetch(getApiUrl('/api/uploads/session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: item.file.name,
      size: item.file.size,
      mimeType: item.file.type || 'application/octet-stream',
      passcode,
    }),
  });

  const session: ISession = await sessionResponse.json();
  if (!sessionResponse.ok || !session.uploadUrl) {
    throw new Error(session.error ?? 'The upload room is not ready yet.');
  }
  if (session.authorised) {
    onAuthorised();
  }

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', session.uploadUrl!);
    request.setRequestHeader(
      'Content-Type',
      item.file.type || 'application/octet-stream',
    );
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error('Storage provider rejected this upload.'));
    request.onerror = () => reject(new Error('Network connection lost.'));
    request.send(item.file);
  });
}

export async function checkAuthorisation() {
  const response = await fetch(getApiUrl('/api/uploads/status'));
  if (!response.ok) {
    return false;
  }
  const result = (await response.json()) as { authorised?: boolean };
  return result.authorised === true;
}

export function formatBytes(bytes: number) {
  if (!bytes) {
    return '0 bytes';
  }

  const units = ['bytes', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
