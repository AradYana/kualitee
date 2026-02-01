'use client';

import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { DataRow } from '@/lib/types';

interface FileUploadProps {
  label: string;
  onDataLoaded: (data: DataRow[]) => void;
  onError: (message: string) => void;
  onClearError?: () => void;
}

export default function FileUpload({ label, onDataLoaded, onError, onClearError }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    setHasError(false);
    setErrorMessage(null);
    onClearError?.();

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let data: DataRow[] = [];

      if (extension === 'csv') {
        const text = await file.text();
        const result = Papa.parse<DataRow>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        });

        if (result.errors.length > 0) {
          throw new Error(`CSV Parse Error: ${result.errors[0].message}`);
        }

        data = result.data;
      } else if (extension === 'xlsx' || extension === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        data = XLSX.utils.sheet_to_json<DataRow>(worksheet);
      } else {
        throw new Error('Unsupported file format. Please use CSV or Excel files.');
      }

      if (data.length > 0) {
        const firstRow = data[0];
        const msidKey = Object.keys(firstRow).find(
          (key) => key.toLowerCase() === 'msid'
        );

        if (!msidKey) {
          setHasError(true);
          setErrorMessage('Missing MSID column');
          setRowCount(null);
          onError(`MSID column not found in ${label}`);
          setIsProcessing(false);
          return;
        }

        if (msidKey !== 'MSID') {
          data = data.map((row) => {
            const newRow: DataRow = { ...row, MSID: row[msidKey] as string };
            delete (newRow as Record<string, unknown>)[msidKey];
            return newRow;
          });
        }
      }

      setRowCount(data.length);
      setHasError(false);
      setErrorMessage(null);
      onDataLoaded(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error processing file';
      setHasError(true);
      setErrorMessage(msg);
      setRowCount(null);
      onError(msg);
    }

    setIsProcessing(false);
  }, [label, onDataLoaded, onError, onClearError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          hasError ? 'bg-red-100' : fileName && !isProcessing && rowCount ? 'bg-green-100' : 'bg-slate-200'
        }`}>
          {hasError ? (
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : fileName && !isProcessing && rowCount ? (
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        </div>
        <span className="font-semibold text-slate-800">{label}</span>
      </div>
      
      <div className="mb-3">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          disabled={isProcessing}
          className="input-field text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
        />
      </div>

      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Reading file data...
        </div>
      )}

      {fileName && !isProcessing && (
        <div className="text-sm space-y-1">
          <div className="text-slate-600">
            <span className="font-medium">File:</span> {fileName}
          </div>
          
          {hasError ? (
            <div className="flex items-center gap-2 text-red-600 font-semibold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ✗ {errorMessage || 'Error loading file'}
            </div>
          ) : rowCount !== null ? (
            <>
              <div className="text-slate-500">
                <span className="font-medium">Records:</span> {rowCount}
              </div>
              <div className="flex items-center gap-2 text-green-600 font-semibold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                ✓ Data Ready
              </div>
            </>
          ) : null}
        </div>
      )}

      {!fileName && !isProcessing && (
        <p className="text-sm text-slate-400">No file selected</p>
      )}
    </div>
  );
}
