export type TUploadStatus = 'queued' | 'uploading' | 'complete' | 'error';

export interface IUploadItem {
  id: string;
  file: File;
  status: TUploadStatus;
  progress: number;
  message: string;
}

export interface ISession {
  uploadUrl?: string;
  error?: string;
  authorised?: boolean;
}
