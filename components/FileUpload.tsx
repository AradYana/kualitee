'use client';

import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { DataRow } from '@/lib/types';

interface FileUploadProps {
  label: string;
  onDataLoaded: (data: DataRow[]) => void;
  onError: (message: string) => void;
}

export default function FileUpload({ label, onDataLoaded, onError }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rowCount, setRowCount] = useState<number | null>(null);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let data: DataRow[] = [];

      if (extension === 'csv') {
        // Parse CSV
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
        // Parse Excel
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        data = XLSX.utils.sheet_to_json<DataRow>(worksheet);
      } else {
        throw new Error('Unsupported file format. Please use CSV or Excel files.');
      }

      // Validate MSID column exists
      if (data.length > 0 && !('MSID' in data[0])) {
        onError(`MSID column not found in ${label}`);
        setIsProcessing(false);
        return;
      }

      setRowCount(data.length);
      onDataLoaded(data);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unknown error processing file');
    }

    setIsProcessing(false);
  }, [label, onDataLoaded, onError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="border border-matrix-green p-4">
      <div className="text-matrix-green/60 text-sm mb-2">
        ┌─── {label} ───┐
      </div>
      
      <div className="mb-3">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          disabled={isProcessing}
          className="w-full"
        />
      </div>

      {isProcessing && (
        <div className="text-warning-amber animate-pulse">
          READING FILE DATA...
        </div>
      )}

      {fileName && !isProcessing && (
        <div className="text-matrix-green text-sm">
          <div>FILE: {fileName}</div>
          {rowCount !== null && (
            <div className="text-matrix-green/60">
              RECORDS LOADED: {rowCount}
            </div>
          )}
          <div className="text-matrix-green mt-1">
            ✓ DATA READY
          </div>
        </div>
      )}

      <div className="text-matrix-green/60 text-sm mt-2">
        └─────────────────────┘
      </div>
    </div>
  );
}
