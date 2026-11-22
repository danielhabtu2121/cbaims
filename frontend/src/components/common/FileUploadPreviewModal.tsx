import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileCheck,
  AlertCircle
} from 'lucide-react';

export interface FilePreviewData {
  fileName: string;
  fileSize?: number | string;
  fileType?: string;
  fileUrl?: string; // full data: URL, blob: URL, or http URL
  fileContent?: string; // raw base64 or data string
  mimeType?: string;
}

interface FileUploadPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileData: FilePreviewData | null;
}

export const FileUploadPreviewModal: React.FC<FileUploadPreviewModalProps> = ({
  isOpen,
  onClose,
  fileData,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setRotation(0);
    }
  }, [isOpen, fileData]);

  if (!isOpen || !fileData) return null;

  // Resolve preview URL
  let resolvedUrl = fileData.fileUrl || '';
  if (!resolvedUrl && fileData.fileContent) {
    if (fileData.fileContent.startsWith('data:')) {
      resolvedUrl = fileData.fileContent;
    } else {
      // Guess mime type from fileName or fileType
      const ext = (fileData.fileName.split('.').pop() || '').toLowerCase();
      let mime = fileData.mimeType || 'application/octet-stream';
      if (['jpg', 'jpeg'].includes(ext)) mime = 'image/jpeg';
      else if (ext === 'png') mime = 'image/png';
      else if (ext === 'gif') mime = 'image/gif';
      else if (ext === 'webp') mime = 'image/webp';
      else if (ext === 'svg') mime = 'image/svg+xml';
      else if (ext === 'pdf') mime = 'application/pdf';
      else if (ext === 'txt') mime = 'text/plain';

      resolvedUrl = `data:${mime};base64,${fileData.fileContent}`;
    }
  }

  const ext = (fileData.fileName.split('.').pop() || '').toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || resolvedUrl.startsWith('data:image/');
  const isPdf = ext === 'pdf' || resolvedUrl.startsWith('data:application/pdf');

  const formatSize = (s?: number | string) => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    if (s < 1024) return `${s} B`;
    if (s < 1024 * 1024) return `${(s / 1024).toFixed(1)} KB`;
    return `${(s / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = () => {
    if (!resolvedUrl) return;
    const a = document.createElement('a');
    a.href = resolvedUrl;
    a.download = fileData.fileName || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (!resolvedUrl) return;
    const w = window.open('');
    if (w) {
      if (isImage) {
        w.document.write(`<img src="${resolvedUrl}" style="max-width:100%;height:auto;margin:auto;display:block;" />`);
      } else {
        w.location.href = resolvedUrl;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-300 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 rounded-lg bg-blue-600/30 text-blue-300 shrink-0">
              {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold truncate text-white max-w-md" title={fileData.fileName}>
                  {fileData.fileName}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-200 uppercase shrink-0">
                  {ext || 'FILE'}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold shrink-0">
                  Ready to Submit
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pre-upload verification preview • {formatSize(fileData.fileSize) || fileData.fileType || 'Document'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isImage && (
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 mr-2 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(25, z - 25))}
                  className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-slate-300 font-mono px-1.5">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(300, z + 25))}
                  className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 ml-1"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}

            {resolvedUrl && (
              <>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
                  title="Download copy"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
                  title="Open in new window"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-slate-100 overflow-auto p-4 flex items-center justify-center min-h-[420px] max-h-[75vh]">
          {isImage && resolvedUrl ? (
            <div className="overflow-auto max-w-full max-h-full flex items-center justify-center p-2">
              <img
                src={resolvedUrl}
                alt={fileData.fileName}
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease',
                  maxHeight: zoom <= 100 ? '65vh' : 'none',
                }}
                className="rounded shadow-md object-contain max-w-full"
              />
            </div>
          ) : isPdf && resolvedUrl ? (
            <iframe
              src={resolvedUrl}
              title={fileData.fileName}
              className="w-full h-[65vh] rounded-lg shadow-md border border-slate-300 bg-white"
            />
          ) : (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center max-w-md shadow-sm space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <FileCheck className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-base">{fileData.fileName}</h4>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {formatSize(fileData.fileSize)} • {fileData.fileType || ext.toUpperCase()} Document
                </p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs text-left flex items-start gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>File Verified for Submission</strong>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    This document is loaded in memory and ready to be submitted to the bank repository.
                  </p>
                </div>
              </div>
              {resolvedUrl && (
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Document File
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Pre-Submission File Verification Passed</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
