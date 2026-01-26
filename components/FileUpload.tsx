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
    <div className="terminal-output p-4">
      <div className="text-sm font-semibold text-text-primary mb-3">
        📄 {label}
      </div>
      
      <div className="mb-3">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          disabled={isProcessing}
          className="text-input w-full text-sm"
        />
      </div>

      {isProcessing && (
        <div className="text-text-secondary text-sm animate-pulse">
          Reading file data...
        </div>
      )}

      {fileName && !isProcessing && (
        <div className="text-sm">
          <div className="text-text-primary">File: {fileName}</div>
          {rowCount !== null && (
            <div className="text-text-secondary">
              Records loaded: {rowCount}
            </div>
          )}
          <div className="mt-1 font-semibold" style={{ color: '#008000' }}>
            ✓ Data Ready
          </div>
        </div>
      )}
    </div>
  );
}
