import React from 'react';

export interface Extractor {
  id: number;
  name: string;
  tag: string;
  attrs: string;
}

export type OutputFormat = 'csv' | 'json' | 'print';

export type ScrapingMode = 'structured' | 'simple';

export type ScrapingScope = 'single' | 'multi';

export type MultiPageMode = 'button' | 'url';

export type Browser = 'chrome' | 'firefox' | 'edge' | 'brave' | 'opera';

export type StaticSourceType = 'url' | 'file';

export interface GenerateBsCodeParams {
    projectName: string;
    scrapingMode: ScrapingMode;
    container: Omit<Extractor, 'id' | 'name'>;
    extractors: Extractor[];
    outputFormat: OutputFormat;
    source: 'live-url' | 'local-files';
    // --- Optional params for live-url source ---
    url?: string;
    urlPrefix?: string;
    urlSuffix?: string;
    proxyList?: string;
    delay?: number;
    browser?: Browser;
}