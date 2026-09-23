import { type Request, type Response, Router } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { google } from 'googleapis';
import { createHmac, timingSafeEqual } from 'node:crypto';

const authCookieName = 'raimi_media_upload_access';
const authCookieMaxAge = 72 * 60 * 60;
const maxFileSize = Number(
  process.env.MAX_FILE_SIZE_BYTES ?? 2 * 1024 * 1024 * 1024,
);
const allowedMimeTypes =
  /^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|quicktime|webm|x-matroska))$/i;

const router = Router();

export interface ConfigResponse {
  configured: boolean;
  maxFileSizeBytes: number;
}
router.get(
  '/config',
  (_request: Request, response: Response<ConfigResponse>) => {
    response.json({
      configured: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID),
      maxFileSizeBytes: maxFileSize,
    });
  },
);

export interface UploadStatusResponse {
  required: boolean;
  authorised: boolean;
}
router.get(
  '/uploads/status',
  (request: Request, response: Response<UploadStatusResponse>) => {
    response.json({
      required: Boolean(process.env.UPLOAD_PASSCODE),
      authorised: isAuthorised(request),
    });
  },
);

export interface UploadSessionResponse {
  uploadUrl: string;
  authorised: boolean;
}
export interface ErrorResponse {
  error: string;
}
type UploadSessionResponseBody = UploadSessionResponse | ErrorResponse;
export interface UploadSessionRequest {
  name?: string;
  size?: number;
  mimeType?: string;
  passcode?: string;
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
  const { name, size, mimeType, passcode } = request.body;
  const authorised = isAuthorised(request);
  if (
    process.env.UPLOAD_PASSCODE &&
    !authorised &&
    !safeEqual(passcode ?? '', process.env.UPLOAD_PASSCODE)
  ) {
    response.status(401).json({ error: 'Enter the event code to upload.' });
    return;
  }
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
    if (process.env.UPLOAD_PASSCODE && !authorised) {
      setAuthorisationCookie(response);
    }
    response.json({ uploadUrl, authorised: true });
  } catch (error) {
    console.error('Could not create Drive upload session:', error);
    response
      .status(502)
      .json({ error: 'Could not connect to storage. Check the server setup.' });
  }
}

function isAuthorised(request: Request) {
  if (!process.env.UPLOAD_PASSCODE) {
    return true;
  }
  const token = parseCookies(request.headers.cookie ?? '')[authCookieName];
  if (!token) {
    return false;
  }
  const [expires, signature] = token.split('.');
  if (
    !expires ||
    !signature ||
    Number(expires) < Math.floor(Date.now() / 1000)
  ) {
    return false;
  }
  return safeEqual(signature, signToken(expires));
}

function setAuthorisationCookie(response: Response) {
  const expires = String(Math.floor(Date.now() / 1000) + authCookieMaxAge);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${authCookieName}=${expires}.${signToken(expires)}; Max-Age=${authCookieMaxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
}

function signToken(value: string) {
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_COOKIE_SECRET is required when upload authentication is enabled.',
    );
  }
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function parseCookies(header: string) {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('=').map(decodeURIComponent))
      .filter(([key, value]) => key && value),
  );
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
