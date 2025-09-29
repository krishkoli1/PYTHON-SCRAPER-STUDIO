import React, { useState, useCallback, useRef, useEffect } from 'react';
import { type Extractor, type OutputFormat, type ScrapingMode, type ScrapingScope, type MultiPageMode } from './types';
import { generateSeleniumCode, generateBeautifulSoupCode } from './services/codeGenerator';
import { CodeBlock } from './components/CodeBlock';
import { StepIndicator } from './components/StepIndicator';
import { PlusIcon } from './components/icons/PlusIcon';
import { TrashIcon } from './components/icons/TrashIcon';
import { ArrowPathIcon } from './components/icons/ArrowPathIcon';
import { CursorArrowRaysIcon } from './components/icons/CursorArrowRaysIcon';
import { PlayIcon } from './components/icons/PlayIcon';
import { GoogleGenAI, Type } from '@google/genai';

const App: React.FC = () => {
  const [step, setStep] = useState<number>(1);
  const [startMethod, setStartMethod] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('scraping_project');
  const [htmlContents, setHtmlContents] = useState<{ name: string; content: string }[]>([]);

  const [scrapingScope, setScrapingScope] = useState<ScrapingScope>('single');
  const [multiPageMode, setMultiPageMode] = useState<MultiPageMode>('button');
  const [startPage, setStartPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(5);
  const [nextPageSelector, setNextPageSelector] = useState<string>('li.next > a');
  const [urlPrefix, setUrlPrefix] = useState<string>('');
  const [urlSuffix, setUrlSuffix] = useState<string>('');
  const [autoDetectLoading, setAutoDetectLoading] = useState<boolean>(false);
  
  const [scrapingMode, setScrapingMode] = useState<ScrapingMode>('structured');
  const [container, setContainer] = useState<Omit<Extractor, 'id' | 'name'>>({ tag: '', attrs: '' });
  const [containerTestResult, setContainerTestResult] = useState<{ count: number; preview: string; error?: boolean } | null>(null);
  const [isContainerSet, setIsContainerSet] = useState<boolean>(false);
  
  const [extractionMethod, setExtractionMethod] = useState<'auto' | 'manual' | null>(null);
  const [autoFieldDetectLoading, setAutoFieldDetectLoading] = useState<boolean>(false);

  const [extractors, setExtractors] = useState<Extractor[]>([
    { id: Date.now(), name: 'item_1', tag: '', attrs: '' },
  ]);
  
  const [seleniumCode, setSeleniumCode] = useState<string>('');
  const [bsCode, setBsCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const [selectingFor, setSelectingFor] = useState<'container' | number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [testResults, setTestResults] = useState<{ [key: number]: { count: number; preview: string; error?: boolean } }>({});
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('csv');


  const handleUrlSubmit = () => {
    const urlToValidate = scrapingScope === 'multi' && multiPageMode === 'url' ? urlPrefix : url;
    if (!urlToValidate || !urlToValidate.startsWith('http')) {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }
    if (scrapingScope === 'multi' && multiPageMode === 'url' && !urlPrefix) {
      setError('Please provide a URL prefix for the URL pattern.');
      return;
    }

    setError('');
    const code = generateSeleniumCode({ 
        url, 
        projectName,
        scrapingScope, 
        multiPageMode, 
        startPage, 
        numPages, 
        nextPageSelector,
        urlPrefix,
        urlSuffix
    });
    setSeleniumCode(code);
    setStep(2);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setError('');
      const file = files[0]; // Only process the first file as a sample
      
      if (file.type === 'text/html') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setHtmlContents([{ name: file.name, content }]);
          if (step !== 4) { // Don't auto-advance if already on the extractor page
            setStep(4); 
          }
        };
        reader.onerror = () => {
          setError(`Error reading file ${file.name}.`);
        };
        reader.readAsText(file);
      } else {
        setError(`File ${file.name} is not a valid .html file.`);
      }
    }
    event.target.value = ''; // Reset file input
  };

  const handleAddExtractor = () => {
    setExtractors([
      ...extractors,
      { id: Date.now(), name: `item_${extractors.length + 1}`, tag: '', attrs: '' },
    ]);
  };

  const handleRemoveExtractor = (id: number) => {
    if (extractors.length > 1) {
      setExtractors(extractors.filter((e) => e.id !== id));
      const newTestResults = { ...testResults };
      delete newTestResults[id];
      setTestResults(newTestResults);
    }
  };

  const handleExtractorChange = useCallback((id: number, field: keyof Omit<Extractor, 'id'>, value: string) => {
    setExtractors(prev =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
    const newTestResults = { ...testResults };
    delete newTestResults[id];
    setTestResults(newTestResults);
  }, [testResults]);
  
  const handleContainerChange = useCallback((field: 'tag' | 'attrs', value: string) => {
    setContainer(prev => ({ ...prev, [field]: value }));
    setContainerTestResult(null);
    setIsContainerSet(false); // Force re-test on any change
    setExtractionMethod(null); // Reset choice when container changes
  }, []);
  
  const handleModeChange = (mode: ScrapingMode) => {
      setScrapingMode(mode);
      // Reset state when switching modes to avoid confusion
      setContainer({ tag: '', attrs: '' });
      setContainerTestResult(null);
      setIsContainerSet(false);
      setExtractionMethod(null);
      setExtractors([{ id: Date.now(), name: 'item_1', tag: '', attrs: '' }]);
      setTestResults({});
      setError('');
  }

  const handleGenerateBsCode = () => {
    setError('');
    if (scrapingMode === 'structured') {
        if (!isContainerSet || !container.tag) {
            setError('Please define and successfully test a container before generating the code.');
            return;
        }
        if (extractors.length === 0 && extractionMethod !== 'auto') {
            setError('Please add at least one field to extract.');
            return;
        }
        const invalidExtractor = extractors.find(e => !e.name.trim() || !e.tag.trim());
        if (invalidExtractor) {
            setError('Please fill in all field names and HTML tags for extraction.');
            return;
        }
    } else { // simple mode
        const singleExtractor = extractors[0];
        if (!singleExtractor.name.trim() || !singleExtractor.tag.trim()) {
            setError('Please fill in the field name and HTML tag for extraction.');
            return;
        }
    }
    
    const code = generateBeautifulSoupCode({
        projectName,
        scrapingMode,
        container,
        extractors,
        outputFormat,
        scrapingScope,
        startPage,
        numPages,
    });
    setBsCode(code);
    setStep(5);
  };

  const handleStartOver = () => {
    setStep(1);
    setStartMethod('url');
    setUrl('');
    setProjectName('scraping_project');
    setHtmlContents([]);
    setScrapingScope('single');
    setMultiPageMode('button');
    setStartPage(1);
    setNumPages(5);
    setNextPageSelector('li.next > a');
    setUrlPrefix('');
    setUrlSuffix('');
    setScrapingMode('structured');
    setContainer({ tag: '', attrs: '' });
    setExtractors([{ id: Date.now(), name: 'item_1', tag: '', attrs: '' }]);
    setSeleniumCode('');
    setBsCode('');
    setError('');
    setSelectingFor(null);
    setTestResults({});
    setContainerTestResult(null);
    setIsContainerSet(false);
    setExtractionMethod(null);
    setOutputFormat('csv');
  };
  
  const handleBack = () => {
    if (step > 1) {
      setError('');
      setSelectingFor(null); // Exit selection mode when going back
      if (scrapingMode === 'structured') {
        setIsContainerSet(false);
        setContainerTestResult(null);
        setExtractionMethod(null);
      }
      if (step === 4 && startMethod === 'file') {
        setStep(1);
        setHtmlContents([]); // Clear preview
      } else {
        setStep(prevStep => prevStep - 1);
      }
    }
  };

  const convertToSelector = (t: string, a: string): string => {
    let selector = t.trim();
    if (!a.trim()) return selector;
    try {
        const parts = a.split(',').map(p => p.trim()).filter(p => p);
        for (const part of parts) {
            const eqIndex = part.indexOf('=');
            if (eqIndex === -1) continue;
            const key = part.substring(0, eqIndex).trim();
            const value = part.substring(eqIndex + 1).trim();
            if (key && value) {
                if (key.toLowerCase() === 'id') {
                    selector += `#${value.replace(/\s/g, '#')}`;
                } else if (key.toLowerCase() === 'class') {
                    const classes = value.split(/\s+/).filter(Boolean).join('.');
                    if(classes) selector += `.${classes}`;
                } else {
                    selector += `[${key}="${value.replace(/"/g, '\\"')}"]`;
                }
            }
        }
        return selector;
    } catch (e) {
        return 'INVALID_SELECTOR_DUE_TO_ATTR_PARSE_ERROR';
    }
  };

  const handleTest = useCallback((type: 'container' | 'extractor', id: number, tag: string, attrs: string) => {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (!tag.trim() || !iframeDoc) {
          const result = { count: 0, preview: 'HTML Tag is empty.', error: true };
          if(type === 'container') {
              setContainerTestResult(result);
              setIsContainerSet(false);
          }
          else setTestResults(prev => ({ ...prev, [id]: result }));
          return;
      }
      
      const selector = convertToSelector(tag, attrs);

      try {
          if (type === 'container') {
              const matches = iframeDoc.querySelectorAll(selector);
              const count = matches.length;
              const isSuccess = count > 0;
              const preview = `Found ${count} repeating container elements.`;
              setContainerTestResult({ count, preview, error: !isSuccess });
              setIsContainerSet(isSuccess);
              if (!isSuccess) {
                setExtractionMethod(null);
              }
          } else { // extractor
             if (scrapingMode === 'structured' && container.tag) {
                   const containerSelector = convertToSelector(container.tag, container.attrs);
                   const containers = iframeDoc.querySelectorAll(containerSelector);
                   if (containers.length > 0) {
                     const matchesInContainers = Array.from(containers).filter((c: Element) => c.querySelector(selector));
                     const count = matchesInContainers.length;
                     const preview = `${count} of ${containers.length} containers have a match.`;
                     setTestResults(prev => ({ ...prev, [id]: { count, preview, error: count === 0 }}));
                   } else {
                      setTestResults(prev => ({ ...prev, [id]: { count: 0, preview: 'No containers found to test within.', error: true }}));
                   }
              } else { // simple mode or container not set
                  const matches = iframeDoc.querySelectorAll(selector);
                  const count = matches.length;
                  const preview = `Found ${count} total matches. Preview: ` + Array.from(matches).slice(0, 3).map((el: Element) => (el.textContent || '').trim().slice(0, 20).concat('...')).join(' | ');
                  setTestResults(prev => ({ ...prev, [id]: { count, preview: preview || `Found ${count} matches. (No text content)`, error: count === 0 } }));
              }
          }
      } catch (e) {
          const result = { count: 0, preview: 'Invalid Tag or Attributes for testing.', error: true };
           if(type === 'container') {
              setContainerTestResult(result);
              setIsContainerSet(false);
              setExtractionMethod(null);
          }
          else setTestResults(prev => ({ ...prev, [id]: result }));
      }
  }, [container, scrapingMode]);

  const generateExtractorDetails = (el: HTMLElement): { tag: string; attrs: string } => {
    const tag = el.tagName.toLowerCase();
    const attrsArray: string[] = [];
  
    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const name = attr.name.toLowerCase();
        const value = attr.value;
  
        if (!value || name === 'id' || name === 'style' || name.startsWith('on')) {
            continue;
        }
  
        attrsArray.push(`${name}=${value}`);
    }
    
    return { tag, attrs: attrsArray.join(', ') };
  };

  const handleAutoDetectPattern = async () => {
    if (!url || !url.startsWith('http')) {
      setError('Please enter a valid example URL first.');
      return;
    }
    setError('');
    setAutoDetectLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Given the URL: "${url}". Find the page number in it. Replace that number with the placeholder "{page}". Return only the modified URL.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const pattern = response.text.trim();
      const placeholder = '{page}';

      if (pattern.includes(placeholder)) {
        const parts = pattern.split(placeholder);
        setUrlPrefix(parts[0]);
        setUrlSuffix(parts[1] || '');
      } else {
        setError('AI could not detect a page number pattern. Please set the prefix and suffix manually.');
        setUrlPrefix(url);
        setUrlSuffix('');
      }
    } catch (e) {
      console.error('Error detecting URL pattern with AI:', e);
      setError('An error occurred during AI pattern detection.');
    } finally {
      setAutoDetectLoading(false);
    }
  };

  const handleAutoFieldDetect = async () => {
    setError('');
    const iframeDoc = iframeRef.current?.contentDocument;
    const containerSelector = convertToSelector(container.tag, container.attrs);

    if (!iframeDoc || !containerSelector) {
        setError('Could not find HTML preview or container selector.');
        return;
    }

    const firstContainer = iframeDoc.querySelector(containerSelector);
    if (!firstContainer) {
        setError('Could not find a container element in the preview to analyze.');
        return;
    }

    setAutoFieldDetectLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Given this HTML snippet of a single item in a list: \`\`\`html\n${firstContainer.outerHTML}\n\`\`\`
      Identify the key pieces of information a user would want to extract. For each piece of information, provide:
      1. A short, descriptive variable name in snake_case (e.g., product_title).
      2. The HTML tag of the element (e.g., h2).
      3. A minimal but effective set of attributes to uniquely identify the element within the snippet (e.g., class=title).
      Return ONLY a JSON array of objects, where each object has "name", "tag", and "attrs" keys.
      Example: [{ "name": "product_title", "tag": "h2", "attrs": "class=title" }, { "name": "price", "tag": "span", "attrs": "class=price" }]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        tag: { type: Type.STRING },
                        attrs: { type: Type.STRING },
                    },
                    required: ['name', 'tag', 'attrs']
                }
            }
        }
      });
      
      const jsonStr = response.text.trim();
      const suggestedFields = JSON.parse(jsonStr);

      if (Array.isArray(suggestedFields) && suggestedFields.length > 0) {
        const newExtractors = suggestedFields.map(field => ({
          id: Date.now() + Math.random(),
          name: field.name || 'unnamed_field',
          tag: field.tag || '',
          attrs: field.attrs || '',
        }));
        setExtractors(newExtractors);
      } else {
        setError('AI could not find any fields to extract. Please add them manually.');
        setExtractors([]); // Clear any existing
      }
      setExtractionMethod('manual'); // Show the populated list for editing

    } catch (e) {
      console.error('Error auto-detecting fields with AI:', e);
      setError('An error occurred during AI field detection. Please try adding fields manually.');
    } finally {
      setAutoFieldDetectLoading(false);
    }
  };


  const handleMultiPageModeChange = (mode: MultiPageMode) => {
    setMultiPageMode(mode);
    setError('');
    // Reset state to avoid confusion
    if (mode === 'button') {
        setUrl(''); 
    }
    setUrlPrefix('');
    setUrlSuffix('');
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument;
    if (!iframeDoc || selectingFor === null) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target) {
        target.style.outline = '2px solid #6366f1';
        target.style.cursor = 'pointer';
      }
    };
    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target) {
        target.style.outline = '';
        target.style.cursor = '';
      }
    };
    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as HTMLElement;
      if (target && selectingFor !== null) {
        target.style.outline = '';
        const originalBg = target.style.backgroundColor;
        target.style.backgroundColor = '#d1fae5';
        setTimeout(() => { target.style.backgroundColor = originalBg; }, 300);

        const { tag, attrs } = generateExtractorDetails(target);
        if (selectingFor === 'container') {
          handleContainerChange('tag', tag);
          handleContainerChange('attrs', attrs);
          setTimeout(() => handleTest('container', 0, tag, attrs), 0);
        } else {
          handleExtractorChange(selectingFor, 'tag', tag);
          handleExtractorChange(selectingFor, 'attrs', attrs);
          setTimeout(() => handleTest('extractor', selectingFor, tag, attrs), 0);
        }
        setSelectingFor(null);
      }
    };

    iframeDoc.addEventListener('mouseover', handleMouseOver);
    iframeDoc.addEventListener('mouseout', handleMouseOut);
    iframeDoc.addEventListener('click', handleClick, true);

    return () => {
      iframeDoc.removeEventListener('mouseover', handleMouseOver);
      iframeDoc.removeEventListener('mouseout', handleMouseOut);
      iframeDoc.removeEventListener('click', handleClick, true);
    };
  }, [selectingFor, handleExtractorChange, handleContainerChange, handleTest]);
  
  useEffect(() => {
    if (step === 5) {
      const code = generateBeautifulSoupCode({ 
          projectName, 
          scrapingMode, 
          container, 
          extractors, 
          outputFormat,
          scrapingScope,
          startPage,
          numPages,
      });
      setBsCode(code);
    }
  }, [outputFormat, step, extractors, container, scrapingMode, projectName, scrapingScope, startPage, numPages]);


  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Step 1: Configure Scraper</h2>
            <p className="text-gray-600 mb-4">Choose how to provide the HTML content for scraping.</p>
            <div className="flex border-b border-gray-200 mb-4">
              <button onClick={() => setStartMethod('url')} className={`px-4 py-2 text-sm font-medium transition-colors ${startMethod === 'url' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Start with a URL</button>
              <button onClick={() => setStartMethod('file')} className={`px-4 py-2 text-sm font-medium transition-colors ${startMethod === 'file' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Start with an HTML File</button>
            </div>
            {startMethod === 'url' ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Provide a URL to generate a Python Selenium script that will download the page's HTML.</p>
                <div>
                    <label htmlFor="project-name" className="block text-sm font-medium text-gray-700">Project Folder Name</label>
                    <input id="project-name" type="text" value={projectName} onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} placeholder="e.g., my_web_scraper" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                    <p className="text-xs text-gray-500 mt-1">All generated files (HTML, CSV, etc.) will be saved in this folder.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scraping Scope</label>
                  <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-colors ${scrapingScope === 'single' ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600' : 'border-gray-300 bg-white hover:bg-gray-50'}`}>
                      <span className="font-semibold text-gray-900">Single Page</span>
                      <span className="text-sm text-gray-500 mt-1">Scrape content from a single URL.</span>
                      <input type="radio" name="scraping-scope" value="single" checked={scrapingScope === 'single'} onChange={() => setScrapingScope('single')} className="absolute h-full w-full opacity-0 cursor-pointer" />
                    </label>
                    <label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-colors ${scrapingScope === 'multi' ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600' : 'border-gray-300 bg-white hover:bg-gray-50'}`}>
                      <span className="font-semibold text-gray-900">Multiple Pages</span>
                      <span className="text-sm text-gray-500 mt-1">Scrape across multiple pages using pagination.</span>
                      <input type="radio" name="scraping-scope" value="multi" checked={scrapingScope === 'multi'} onChange={() => setScrapingScope('multi')} className="absolute h-full w-full opacity-0 cursor-pointer" />
                    </label>
                  </fieldset>
                </div>
                {scrapingScope === 'multi' && (
                  <div className="p-4 border border-indigo-200 bg-indigo-50 rounded-lg space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pagination Method</label>
                      <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className={`relative flex items-center p-3 border rounded-lg cursor-pointer transition-colors text-sm ${multiPageMode === 'button' ? 'border-indigo-600 bg-white ring-2 ring-indigo-600' : 'border-gray-300 bg-white hover:bg-gray-50'}`}>
                          <input type="radio" name="multi-page-mode" value="button" checked={multiPageMode === 'button'} onChange={() => handleMultiPageModeChange('button')} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                          <span className="ml-3 font-medium text-gray-900">Click 'Next' Button</span>
                        </label>
                        <label className={`relative flex items-center p-3 border rounded-lg cursor-pointer transition-colors text-sm ${multiPageMode === 'url' ? 'border-indigo-600 bg-white ring-2 ring-indigo-600' : 'border-gray-300 bg-white hover:bg-gray-50'}`}>
                           <input type="radio" name="multi-page-mode" value="url" checked={multiPageMode === 'url'} onChange={() => handleMultiPageModeChange('url')} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                          <span className="ml-3 font-medium text-gray-900">URL Pattern</span>
                        </label>
                      </fieldset>
                    </div>

                    <div>
                      <label htmlFor="start-page" className="block text-sm font-medium text-gray-700">Start Page Number</label>
                      <input id="start-page" type="number" value={startPage} onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                      <p className="text-xs text-gray-500 mt-1">The number to start counting pages from (used for file names and URL pattern).</p>
                    </div>
                    <div>
                      <label htmlFor="num-pages" className="block text-sm font-medium text-gray-700">Total Number of Pages to Scrape</label>
                      <input id="num-pages" type="number" value={numPages} onChange={(e) => setNumPages(Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" max="100" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                      <p className="text-xs text-gray-500 mt-1">The total count of pages you want to scrape.</p>
                    </div>
                     {multiPageMode === 'button' ? (
                        <div>
                        <label htmlFor="next-selector" className="block text-sm font-medium text-gray-700">"Next Page" Button CSS Selector</label>
                        <input id="next-selector" type="text" value={nextPageSelector} onChange={(e) => setNextPageSelector(e.target.value)} placeholder="e.g., li.next > a" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-indigo-500" />
                        <p className="text-xs text-gray-500 mt-1">This is the CSS selector for the link that takes you to the next page.</p>
                        </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="url-pattern-input" className="block text-sm font-medium text-gray-700">Example URL (from page 2 or higher)</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input id="url-pattern-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/products?page=2" className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                            <button onClick={handleAutoDetectPattern} disabled={autoDetectLoading} className="px-3 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-wait flex items-center">
                              {autoDetectLoading ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  Detecting...
                                </>
                              ) : "✨ Auto-detect Pattern"}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="url-prefix" className="block text-sm font-medium text-gray-700">URL Prefix</label>
                          <input id="url-prefix" type="text" value={urlPrefix} onChange={(e) => setUrlPrefix(e.target.value)} placeholder="https://example.com/page=" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-indigo-500" />
                        </div>
                         <div>
                          <label htmlFor="url-suffix" className="block text-sm font-medium text-gray-700">URL Suffix (optional)</label>
                          <input id="url-suffix" type="text" value={urlSuffix} onChange={(e) => setUrlSuffix(e.target.value)} placeholder=".html" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                { (scrapingScope === 'single' || multiPageMode === 'button') && (
                    <div>
                    <label htmlFor="url-input" className="block text-sm font-medium text-gray-700">
                        Website URL
                    </label>
                    <input id="url-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} 
                        placeholder="https://example.com"
                        className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" aria-describedby="url-example" />
                    <p id="url-example" className="text-xs text-gray-500 mt-1">e.g., <button onClick={() => setUrl('https://quotes.toscrape.com/js/')} className="text-indigo-600 hover:text-indigo-800 underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded">https://quotes.toscrape.com/js/</button></p>
                    </div>
                )}

                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                <button onClick={handleUrlSubmit} className="mt-4 w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">Generate Selenium Code</button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-4">Upload your HTML file to start defining your extractors.</p>
                <div className="mt-4 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" /></svg>
                    <div className="mt-4 flex text-sm leading-6 text-gray-600">
                      <label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".html" onChange={handleFileChange} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs leading-5 text-gray-600">HTML file up to 10MB</p>
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              </div>
            )}
          </div>
        );
      case 2:
        return (<div><h2 className="text-xl font-semibold text-gray-800 mb-2">Step 2: Run Selenium Script</h2><p className="text-gray-600 mb-4">Run this Python script on your local machine. It will create a folder named <span className="font-mono bg-gray-200 px-1 rounded">{projectName}</span> and save the page HTML to <span className="font-mono bg-gray-200 px-1 rounded">{scrapingScope === 'single' ? 'dataset.html' : `dataset_${startPage}.html, dataset_${startPage + 1}.html, etc.`}</span> inside it.</p><CodeBlock code={seleniumCode} language="python" /><div className="mt-4 flex flex-col sm:flex-row gap-2"><button onClick={handleBack} className="w-full bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors">Back</button><button onClick={() => setStep(3)} className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">Next: Upload Sample HTML</button></div></div>);
      case 3:
        return (
            <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Step 3: Upload Sample HTML File</h2>
                <p className="text-gray-600 mb-4">Upload one of the generated HTML files (e.g., `dataset_{startPage}.html`) to use as a sample for defining extractors.</p>
                
                <div className="mt-4 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
                    <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" /></svg>
                        <div className="mt-4 flex text-sm leading-6 text-gray-600">
                            <label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                                <span>Upload a file</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".html" onChange={handleFileChange} />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs leading-5 text-gray-600">A single HTML file up to 10MB</p>
                    </div>
                </div>

                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                
                <div className="mt-6 flex flex-col sm:flex-row gap-2">
                    <button onClick={handleBack} className="w-full bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors">Back</button>
                    <button 
                        onClick={() => setStep(4)}
                        className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
                        disabled={htmlContents.length === 0}
                    >
                        Next: Define Extractors
                    </button>
                </div>
            </div>
        );
      case 4:
        const singleExtractor = extractors[0];
        const singleTestResult = testResults[singleExtractor.id];
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[75vh]">
            <div className="flex flex-col"><h2 className="text-xl font-semibold text-gray-800 mb-2">HTML Preview</h2><p className="text-gray-600 mb-4 text-sm">Preview of your sample file: <span className="font-semibold">{htmlContents[0]?.name}</span></p><div className="flex-grow border border-gray-300 rounded-md overflow-hidden relative">{selectingFor !== null && ( <div className="absolute inset-x-0 top-0 bg-indigo-600 text-white text-center text-sm py-1 z-10 animate-pulse">Selection Mode Active: Click an element in the preview.</div> )}<iframe ref={iframeRef} srcDoc={htmlContents[0]?.content || ''} title="HTML Preview" className="w-full h-full" sandbox="allow-same-origin"/></div></div>
            <div className="flex flex-col"><div className="space-y-6 flex-grow overflow-y-auto pr-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Step 4: Define What to Extract</h3>
                <p className="text-sm text-gray-600 mb-4">First, choose your scraping goal.</p>
                <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-colors ${scrapingMode === 'structured' ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600' : 'border-gray-300 bg-white hover:bg-gray-50'}`}>
                    <span className="font-semibold text-gray-900">Extract Structured Data</span>
                    <span className="text-sm text-gray-500 mt-1">Scrape multiple fields from repeating items (e.g., name and price from product cards).</span>
                    <input type="radio" name="scraping-mode" value="structured" checked={scrapingMode === 'structured'} onChange={() => handleModeChange('structured')} className="absolute h-full w-full opacity-0 cursor-pointer" />
                  </label>
                  <label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-colors ${scrapingMode === 'simple' ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600' : 'border-gray-300 bg-white hover:bg-gray-50'}`}>
                    <span className="font-semibold text-gray-900">Extract a Simple List</span>
                    <span className="text-sm text-gray-500 mt-1">Scrape a single list of all matching items on the page (e.g., all links).</span>
                    <input type="radio" name="scraping-mode" value="simple" checked={scrapingMode === 'simple'} onChange={() => handleModeChange('simple')} className="absolute h-full w-full opacity-0 cursor-pointer" />
                  </label>
                </fieldset>
              </div>

              {scrapingMode === 'structured' ? (
                <>
                  <div><h3 className="text-base font-semibold text-gray-800 mt-4">Define Container</h3><p className="text-xs text-gray-500 mb-2">Find the repeating element that holds all the info for one item (e.g., a product card).</p><div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2"><div className="flex items-center gap-2"><input type="text" value={container.tag} onChange={(e) => handleContainerChange('tag', e.target.value)} placeholder="HTML Tag (e.g., div)" className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm" /><button onClick={() => setSelectingFor(selectingFor === 'container' ? null : 'container')} className={`p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${selectingFor === 'container' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`} title="Select container element"><CursorArrowRaysIcon /></button><button onClick={() => handleTest('container', 0, container.tag, container.attrs)} className="p-2 rounded-md bg-green-100 text-green-800 hover:bg-green-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500" title="Test container"><PlayIcon /></button></div><textarea value={container.attrs} onChange={(e) => handleContainerChange('attrs', e.target.value)} placeholder="Attributes (e.g., class=quote)" rows={1} className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm" />
                  {containerTestResult && (<div className={`p-2 text-xs rounded border ${containerTestResult.error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}><p className="font-semibold">{containerTestResult.preview}</p></div>)}</div></div>
                  
                  {isContainerSet && extractionMethod === null && (
                    <div className="mt-4 p-4 border-2 border-dashed border-indigo-200 bg-indigo-50 rounded-lg">
                        <h3 className="text-base font-semibold text-gray-800">Define Fields to Extract</h3>
                        <p className="text-xs text-gray-500 mb-3">Now, define the data you want from inside each container.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button onClick={handleAutoFieldDetect} disabled={autoFieldDetectLoading} className="w-full px-3 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-wait flex items-center justify-center">
                               {autoFieldDetectLoading ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  Detecting...
                                </>
                              ) : "✨ Auto-detect Fields"}
                            </button>
                            <button onClick={() => setExtractionMethod('manual')} className="w-full px-3 py-2 bg-white text-gray-700 font-semibold rounded-md border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                Add Fields Manually
                            </button>
                        </div>
                    </div>
                  )}

                  {isContainerSet && extractionMethod === 'manual' && (
                    <div><h3 className="text-base font-semibold text-gray-800 mt-4">Define Fields to Extract</h3><p className="text-xs text-gray-500 mb-2">Define the data you want from inside each container.</p>
                      <div className="space-y-4">{extractors.map((extractor, index) => {const testResult = testResults[extractor.id];return (<div key={extractor.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg"><div className="flex justify-between items-center mb-2"><label className="block text-sm font-medium text-gray-700">Field #{index + 1}</label><button onClick={() => handleRemoveExtractor(extractor.id)} disabled={extractors.length <= 1} className="text-gray-400 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors" aria-label="Remove extractor"><TrashIcon /></button></div><div className="grid grid-cols-1 gap-4"><input type="text" value={extractor.name} onChange={(e) => handleExtractorChange(extractor.id, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))} placeholder="Variable Name (e.g., quote_text)" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" /><div className="flex items-center gap-2"><input type="text" value={extractor.tag} onChange={(e) => handleExtractorChange(extractor.id, 'tag', e.target.value)} placeholder="HTML Tag (e.g., span)" className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm" /><button onClick={() => setSelectingFor(extractor.id === selectingFor ? null : extractor.id)} className={`p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${selectingFor === extractor.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`} title="Select element from preview"><CursorArrowRaysIcon /></button><button onClick={() => handleTest('extractor', extractor.id, extractor.tag, extractor.attrs)} className="p-2 rounded-md bg-green-100 text-green-800 hover:bg-green-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500" title="Test this field"><PlayIcon /></button></div><textarea value={extractor.attrs} onChange={(e) => handleExtractorChange(extractor.id, 'attrs', e.target.value)} placeholder="Attributes (e.g., class=text)" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm" />
                      {testResult && (<div className={`mt-2 p-2 text-xs rounded border ${testResult.error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}><p className="font-semibold">{testResult.preview}</p></div>)}</div></div>);})}</div>
                      <button onClick={handleAddExtractor} className="mt-4 flex items-center justify-center w-full bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"><PlusIcon />Add Field</button>
                    </div>
                  )}
                </>
              ) : ( // Simple Mode
                <div><h3 className="text-base font-semibold text-gray-800 mt-4">Define Field to Extract</h3><p className="text-xs text-gray-500 mb-2">Define the single element you want to extract from the entire page.</p>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-1 gap-4">
                        <input type="text" value={singleExtractor.name} onChange={(e) => handleExtractorChange(singleExtractor.id, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))} placeholder="Variable Name (e.g., all_links)" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                        <div className="flex items-center gap-2">
                            <input type="text" value={singleExtractor.tag} onChange={(e) => handleExtractorChange(singleExtractor.id, 'tag', e.target.value)} placeholder="HTML Tag (e.g., a)" className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm" />
                            <button onClick={() => setSelectingFor(singleExtractor.id === selectingFor ? null : singleExtractor.id)} className={`p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${selectingFor === singleExtractor.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`} title="Select element from preview"><CursorArrowRaysIcon /></button>
                            <button onClick={() => handleTest('extractor', singleExtractor.id, singleExtractor.tag, singleExtractor.attrs)} className="p-2 rounded-md bg-green-100 text-green-800 hover:bg-green-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500" title="Test this field"><PlayIcon /></button>
                        </div>
                        <textarea value={singleExtractor.attrs} onChange={(e) => handleExtractorChange(singleExtractor.id, 'attrs', e.target.value)} placeholder="Attributes (e.g., class=link)" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm" />
                        {singleTestResult && (
                            <div className={`mt-2 p-2 text-xs rounded border ${singleTestResult.error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                <p className="font-semibold">{singleTestResult.preview}</p>
                            </div>
                        )}
                    </div>
                </div>
                </div>
              )}
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              <div className="mt-2 flex flex-col sm:flex-row gap-2 pt-2 border-t"><button onClick={handleBack} className="w-full bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors">Back</button><button onClick={handleGenerateBsCode} disabled={(scrapingMode === 'structured' && !isContainerSet) || htmlContents.length === 0} className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed" title={(scrapingMode === 'structured' && !isContainerSet) ? 'You must define and test a container first' : ''}>Generate BeautifulSoup Code</button></div>
            </div>
          </div>
        );
      case 5:
        return (<div><h2 className="text-xl font-semibold text-gray-800 mb-2">Step 5: Final BeautifulSoup Script</h2><p className="text-gray-600 mb-4">Run this script in the parent directory of your <span className="font-mono bg-gray-200 px-1 rounded">{projectName}</span> folder to extract the data.</p><div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-2">Output Format:</label><div className="flex items-center space-x-4">{(['csv', 'json', 'print'] as OutputFormat[]).map((format) => (<label key={format} className="flex items-center"><input type="radio" name="output-format" value={format} checked={outputFormat === format} onChange={() => setOutputFormat(format)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" /><span className="ml-2 text-sm text-gray-700 capitalize">{format === 'print' ? 'Print to Console' : format.toUpperCase()}</span></label>))}</div></div><CodeBlock code={bsCode} language="python" /><div className="mt-4 flex flex-col sm:flex-row-reverse gap-2"><button onClick={handleStartOver} className="w-full bg-gray-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors flex items-center justify-center gap-2"><ArrowPathIcon />Start Over</button><button onClick={handleBack} className="w-full bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors">Back</button></div></div>);
      default:
        return <div>Invalid Step</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Python Scraper Studio</h1>
          <p className="text-lg text-gray-600 mt-2">Generate web scraping scripts in a few easy steps.</p>
        </header>
        <div className="mb-8">
          <StepIndicator currentStep={step} />
        </div>
        <main className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {renderStep()}
        </main>
      </div>
    </div>
  );
};

export default App;
