/// <reference types="vite/client" />

declare module 'mammoth' {
  interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function convertToHtml(input: { arrayBuffer?: ArrayBuffer; buffer?: any; path?: string }): Promise<MammothResult>;
  export function extractRawText(input: { arrayBuffer?: ArrayBuffer; buffer?: any; path?: string }): Promise<MammothResult>;
}
