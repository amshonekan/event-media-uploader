import { type Request, type Response, Router } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { google } from 'googleapis';
const maxFileSize = Number(
  process.env.MAX_FILE_SIZE_BYTES ?? 2 * 1024 * 1024 * 1024,
);
const allowedMimeTypes =
  /^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|quicktime|webm|x-matroska))$/i;

const router = Router();

export interface UploadSessionResponse {
  uploadUrl: string;
}
export interface ErrorResponse {
  error: string;
}
type UploadSessionResponseBody = UploadSessionResponse | ErrorResponse;
export interface UploadSessionRequest {
  name?: string;
  size?: number;
  mimeType?: string;
}
router.post(
  '/uploads/session',
  (
    request: Request<
      ParamsDictionary,
      UploadSessionResponseBody,
      UploadSessionRequest
    >,
    response: Response<UploadSessionResponseBody>,
  ) => {
    void createUploadSession(request, response);
  },
);

async function createUploadSession(
  request: Request<
    ParamsDictionary,
    UploadSessionResponseBody,
    UploadSessionRequest
  >,
  response: Response<UploadSessionResponseBody>,
) {
  const { name, size, mimeType } = request.body;
  if (
    !name ||
    typeof size !== 'number' ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    !mimeType ||
    !allowedMimeTypes.test(mimeType)
  ) {
    response
      .status(400)
      .json({ error: 'Choose a supported image or video file.' });
    return;
  }
  if (size > maxFileSize) {
    response.status(413).json({
      error: `Files must be smaller than ${Math.round(maxFileSize / 1024 / 1024 / 1024)} GB.`,
    });
    return;
  }
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
    response.status(503).json({
      error: 'The upload room has not been connected to storage yet.',
    });
    return;
  }
  try {
    const client = await createGoogleAuthClient();
    // getRequestHeaders() returns a Headers instance, not a plain object, so it must be merged via the Headers API
    const headers = new Headers(await client.getRequestHeaders());
    headers.set('Content-Type', 'application/json; charset=UTF-8');
    headers.set('X-Upload-Content-Type', mimeType);
    headers.set('X-Upload-Content-Length', String(size));

    if (request.headers.origin) {
      headers.set('Origin', request.headers.origin);
    }
    const sessionResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: sanitiseName(name),
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        }),
      },
    );
    if (!sessionResponse.ok) {
      throw new Error(await sessionResponse.text());
    }
    const uploadUrl = sessionResponse.headers.get('location');
    if (!uploadUrl) {
      throw new Error('Google Drive did not return an upload URL.');
    }
    response.json({ uploadUrl });
  } catch (error) {
    console.error('Could not create Drive upload session:', error);
    response
      .status(502)
      .json({ error: 'Could not connect to storage. Check the server setup.' });
  }
}

async function createGoogleAuthClient() {
  // Service accounts have no Drive storage quota of their own, so a real account
  // via OAuth refresh token is required for uploads to land in a personal folder.
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    );
    client.setCredentials({
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    });
    return client;
  }
  const auth = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ? new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      })
    : new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
  return auth.getClient();
}

function sanitiseName(name: string) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: not an issue
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180);
}

export default router;
