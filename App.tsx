

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { type Extractor, type OutputFormat, type ScrapingMode, type ScrapingScope, type MultiPageMode, type Browser, type StaticSourceType, type LinkExtractionStrategy } from './types';
import { generateSeleniumCode, generateBeautifulSoupCode, generatePlaywrightCode } from './services/codeGenerator';
import { CodeBlock } from './components/CodeBlock';
import { StepIndicator } from './components/StepIndicator';
import { PlusIcon } from './components/icons/PlusIcon';
import { TrashIcon } from './components/icons/TrashIcon';
import { ArrowPathIcon } from './components/icons/ArrowPathIcon';
import { CursorArrowRaysIcon } from './components/icons/CursorArrowRaysIcon';
import { PlayIcon } from './components/icons/PlayIcon';
import { GoogleGenAI, Type } from '@google/genai';
import MouseTrailer from './components/MouseTrailer';
import { WandIcon } from './components/icons/WandIcon';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { CheckCircleIcon } from './components/icons/CheckCircleIcon';
import { XCircleIcon } from './components/icons/XCircleIcon';


type ScrapingType = 'dynamic' | 'static';
type CurrentView = 'apiKey' | 'advisor' | 'app';
type AiRecommendation = { recommendation: ScrapingType; reason: string; };

type AiCodeDebuggerProps = {
  apiKey: string;
  originalCode: string;
  codeType: 'Selenium' | 'BeautifulSoup' | 'Playwright' | 'General Python';
};

const AiCodeDebugger: React.FC<AiCodeDebuggerProps> = ({ apiKey, originalCode, codeType }) => {
  const [errorInput, setErrorInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fixerError, setFixerError] = useState('');
  const [fixedCode, setFixedCode] = useState<string | null>(null);

  const handleFixCode = async () => {
    if (!errorInput.trim()) {
      setFixerError('Please paste the error message you received.');
      return;
    }
    setFixerError('');
    setIsLoading(true);
    setFixedCode(null);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an expert Python developer specializing in ${codeType === 'General Python' ? 'general Python scripting and file processing' : `web scraping with ${codeType}`}.
The user was given the following Python script to run:
--- START OF SCRIPT ---
${originalCode}
--- END OF SCRIPT ---

When they ran it, they encountered the following error:
--- START OF ERROR ---
${errorInput}
--- END OF ERROR ---

Your task is to analyze the script and the error message, identify the root cause of the error, and provide a corrected version of the full Python script.

IMPORTANT:
- Only return the complete, corrected Python code.
- Do not add any explanations, apologies, or introductory text. Just provide the raw code.`;

      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      let newCode = response.text.trim();
      newCode = newCode.replace(/^```(?:python\n)?/, '').replace(/```$/, '').trim();
      
      if (newCode) {
        setFixedCode(newCode);
      } else {
        setFixerError('The AI could not generate a fix. Please check the error message or try again.');
      }
    } catch (e) {
      console.error('Error fixing code with AI:', e);
      setFixerError('An error occurred while trying to fix the code. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
      <summary className="p-3 font-semibold text-zinc-200 cursor-pointer flex items-center gap-2 select-none">
        <WandIcon />
        Debug with AI
      </summary>
      <div className="p-4 border-t-2 border-zinc-800">
        <p className="text-sm text-zinc-400 -mt-2 mb-4">If you get an error running the script, paste it below and the AI will attempt to fix it.</p>
        <div>
          <label htmlFor={`error-input-${codeType}`} className="block text-sm font-medium text-zinc-300">Error Message</label>
          <textarea
            id={`error-input-${codeType}`}
            rows={5}
            value={errorInput}
            onChange={(e) => setErrorInput(e.target.value)}
            placeholder="Paste the entire error message here..."
            className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white"
            disabled={isLoading}
          />
        </div>
        {fixerError && <p className="text-red-400 font-semibold text-sm mt-2">{fixerError}</p>}
        <div className="mt-4">
          <button onClick={handleFixCode} className="w-full sm:w-auto bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed flex items-center justify-center transition-all transform hover:scale-105" disabled={isLoading}>
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Generating Fix...
              </>
            ) : (
              'Generate Fix'
            )}
          </button>
        </div>

        {fixedCode && (
          <div className="mt-6">
            <h4 className="text-md font-semibold text-zinc-200 bg-zinc-900 p-2 rounded-t-md">AI Generated Fix</h4>
            <CodeBlock code={fixedCode} />
          </div>
        )}
      </div>
    </details>
  );
};


const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<CurrentView>('apiKey');
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  
  const [analysisUrl, setAnalysisUrl] = useState<string>('');
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AiRecommendation | null>(null);

  const [step, setStep] = useState<number>(1);
  const [scrapingType, setScrapingType] = useState<ScrapingType | null>(null);
  const [dynamicEngine, setDynamicEngine] = useState<'selenium' | 'playwright'>('selenium');
  const [staticSource, setStaticSource] = useState<StaticSourceType | null>(null);

  const [url, setUrl] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('scraping_project');
  const [htmlContents, setHtmlContents] = useState<{ name: string; content: string }[]>([]);

  const [useProxy, setUseProxy] = useState<boolean>(false);
  const [proxyList, setProxyList] = useState<string>('');
  
  const [browser, setBrowser] = useState<Browser>('chrome');
  const [delay, setDelay] = useState<number>(5000);

  const [scrapingScope, setScrapingScope] = useState<ScrapingScope>('single');
  const [multiPageMode, setMultiPageMode] = useState<MultiPageMode>('button');
  const [startPage, setStartPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(5);
  const [nextPageSelector, setNextPageSelector] = useState<string>('li.next > a');
  const [urlPrefix, setUrlPrefix] = useState<string>('');
  const [urlSuffix, setUrlSuffix] = useState<string>('');
  const [autoDetectUrlLoading, setAutoDetectUrlLoading] = useState<boolean>(false);
  const [autoDetectSelectorLoading, setAutoDetectSelectorLoading] = useState<boolean>(false);
  const [startPageHtml, setStartPageHtml] = useState<string>('');
  
  const [scrapingMode, setScrapingMode] = useState<ScrapingMode>('structured');
  const [container, setContainer] = useState<Omit<Extractor, 'id' | 'name'>>({ tag: '', attrs: '' });
  const [containerTestResult, setContainerTestResult] = useState<{ count: number; preview: string; error?: boolean } | null>(null);
  const [isContainerSet, setContainerSet] = useState<boolean>(false);
  
  const [extractionMethod, setExtractionMethod] = useState<'auto' | 'manual' | null>(null);
  const [autoFieldDetectLoading, setAutoFieldDetectLoading] = useState<boolean>(false);

  const [extractors, setExtractors] = useState<Extractor[]>([
    { id: Date.now(), name: 'item_1', tag: '', attrs: '' },
  ]);

  const [linkExtractionStrategy, setLinkExtractionStrategy] = useState<LinkExtractionStrategy>('all');
  const [linkContainer, setLinkContainer] = useState<Omit<Extractor, 'id' | 'name'>>({ tag: '', attrs: '' });
  const [linkSelector, setLinkSelector] = useState<Omit<Extractor, 'id' | 'name'>>({ tag: 'a', attrs: '' });
  const [isLinkContainerSet, setLinkContainerSet] = useState<boolean>(false);
  const [linkContainerTestResult, setLinkContainerTestResult] = useState<{ count: number; preview: string; error?: boolean } | null>(null);
  const [linkSelectorTestResult, setLinkSelectorTestResult] = useState<{ count: number; preview: string; error?: boolean } | null>(null);

  const [extractedLinks, setExtractedLinks] = useState<{ text: string, href: string, selected: boolean }[]>([]);
  const [aiLinkFilterPrompt, setAiLinkFilterPrompt] = useState<string>('');
  const [aiLinkFilterLoading, setAiLinkFilterLoading] = useState<boolean>(false);
  
  const [seleniumCode, setSeleniumCode] = useState<string>('');
  const [playwrightCode, setPlaywrightCode] = useState<string>('');
  const [bsCode, setBsCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const [selectingFor, setSelectingFor] = useState<'container' | number | 'linkContainer' | 'linkSelector' | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [testResults, setTestResults] = useState<{ [key: number]: { count: number; preview: string; error?: boolean } }>({});
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('csv');
  
  const handleApiKeySubmit = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      setError('');
      setCurrentView('advisor');
    } else {
      setError('Please enter a valid API key.');
    }
  };

  const resetAllState = () => {
    setStep(1);
    setScrapingType(null);
    setDynamicEngine('selenium');
    setStaticSource(null);
    setUrl('');
    setProjectName('scraping_project');
    setHtmlContents([]);
    setUseProxy(false);
    setProxyList('');
    setBrowser('chrome');
    setDelay(5000);
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
    setExtractedLinks([]);
    setAiLinkFilterPrompt('');
    setAiLinkFilterLoading(false);
    setSeleniumCode('');
    setPlaywrightCode('');
    setBsCode('');
    setError('');
    setSelectingFor(null);
    setTestResults({});
    setContainerTestResult(null);
    setContainerSet(false);
    setLinkExtractionStrategy('all');
    setLinkContainer({ tag: '', attrs: '' });
    setLinkSelector({ tag: 'a', attrs: '' });
    setLinkContainerTestResult(null);
    setLinkSelectorTestResult(null);
    setLinkContainerSet(false);
    setExtractionMethod(null);
    setOutputFormat('csv');
    setStartPageHtml('');
    setAutoDetectUrlLoading(false);
    setAutoDetectSelectorLoading(false);
  };

  const handleStartOver = () => {
    resetAllState();
    setAnalysisUrl('');
    setAnalysisResult(null);
    setCurrentView('apiKey');
    setApiKey('');
    setApiKeyInput('');
  };

  const handleAnalyzeUrl = async () => {
    if (!analysisUrl.trim() || !analysisUrl.startsWith('http')) {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }
    setError('');
    setAnalysisLoading(true);
    setAnalysisResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const encodedAnalysisUrl = encodeURI(analysisUrl);
      const prompt = `You are a web scraping expert. Your task is to analyze a given URL and recommend the best scraping method.

The two methods are:
1.  **Dynamic Scraping (Selenium)**: Use this for modern, complex websites that rely on JavaScript to load content, are built with frameworks like React/Vue/Angular, have infinite scroll, or require user interaction to reveal data. This method is more robust and handles more complex scenarios.
2.  **Static Scraping (BeautifulSoup & Requests)**: Use this for simpler, traditional websites (like blogs, news articles, forums) where all the content is present in the initial HTML source code. This is faster but less powerful.

**Critical Analysis:**
- When analyzing the URL, consider the website's complexity.
- **Crucial Rule:** Websites like Kaggle.com (for datasets) and GeeksforGeeks.org (for articles) often use JavaScript to load their main content dynamically or to protect against bots. They are prime examples that **must be classified as "dynamic"**.
- If a website is known to be a Single Page Application (SPA), it is always "dynamic".
- If you are unsure, err on the side of caution. **Recommending "dynamic" is the safer choice** because a dynamic scraper can handle a static site, but a static scraper will fail on a dynamic site.

Analyze the website at this URL: ${encodedAnalysisUrl}

Based on this analysis, decide which method is more appropriate.

Respond with a JSON object with two keys:
- "recommendation": A string, either "dynamic" or "static".
- "reason": A short, user-friendly explanation (1-2 sentences) for your choice.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendation: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ['recommendation', 'reason'],
          },
        },
      });
      const result = JSON.parse(response.text.trim()) as AiRecommendation;
      setAnalysisResult(result);
    } catch (e) {
      console.error('Error analyzing URL with AI:', e);
      setError('An error occurred during AI analysis. Please check the URL and your API key, or choose a method manually.');
    } finally {
      setAnalysisLoading(false);
    }
  };
  
  const handleProceedWithRecommendation = () => {
      if (analysisResult) {
          setScrapingType(analysisResult.recommendation);
          setUrl(analysisUrl);
          setCurrentView('app');
      }
  };

  const validateUrlConfig = () => {
    const isStaticUrlScrape = scrapingType === 'static' && staticSource === 'url';
    const urlToValidate = scrapingScope === 'multi' && (multiPageMode === 'url' || isStaticUrlScrape) ? urlPrefix : url;
    if (!urlToValidate || !urlToValidate.startsWith('http')) {
        setError('Please enter a valid URL (e.g., https://example.com)');
        return false;
    }
    if (scrapingScope === 'multi' && (multiPageMode === 'url' || isStaticUrlScrape) && !urlPrefix) {
        setError('Please provide a URL prefix for the URL pattern.');
        return false;
    }
    setError('');
    return true;
  }

  const handleGenerateDynamicCode = (proxies: string) => {
    const params = { url, projectName, scrapingScope, multiPageMode, startPage, numPages, nextPageSelector, urlPrefix, urlSuffix, proxyList: proxies, browser, delay };
    if (dynamicEngine === 'playwright') {
        const code = generatePlaywrightCode(params);
        setPlaywrightCode(code);
        setSeleniumCode('');
    } else {
        const code = generateSeleniumCode(params);
        setSeleniumCode(code);
        setPlaywrightCode('');
    }
  }

  const handleNextFromDynamicConfig = () => {
    if (!validateUrlConfig()) return;
    
    if (useProxy) {
      setStep(2);
    } else {
      handleGenerateDynamicCode('');
      setStep(2);
    }
  };
  
  const handleNextFromStaticUrlConfig = () => {
      if (!validateUrlConfig()) return;
      if (htmlContents.length === 0) {
          setError('Please upload a sample HTML file to continue.');
          return;
      }
      if (useProxy) {
        setStep(2);
      } else {
        setStep(2);
      }
  }

  const handleGenerateDynamicWithProxy = () => {
    if (useProxy && !proxyList.trim()) {
      setError('Please provide a list of proxies or disable the proxy option.');
      return;
    }
    setError('');
    handleGenerateDynamicCode(proxyList);
    setStep(3);
  };

  const handleProxyFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError('');
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => setProxyList(e.target?.result as string);
        reader.onerror = () => setError(`Error reading file ${file.name}.`);
        reader.readAsText(file);
      } else { setError(`File ${file.name} is not a valid .txt file.`); }
    }
     event.target.value = '';
  };
  
  const handleStartPageHtmlUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError('');
      if (file.type === 'text/html') {
        const reader = new FileReader();
        reader.onload = (e) => setStartPageHtml(e.target?.result as string);
        reader.onerror = () => setError(`Error reading file ${file.name}.`);
        reader.readAsText(file);
      } else { setError(`File ${file.name} is not a valid .html file.`); }
    }
    event.target.value = '';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setError('');
      const file = files[0];
      if (file.type === 'text/html') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setHtmlContents([{ name: file.name, content }]);
        };
        reader.onerror = () => setError(`Error reading file ${file.name}.`);
        reader.readAsText(file);
      } else { setError(`File ${file.name} is not a valid .html file.`); }
    }
    event.target.value = '';
  };

  const handleAddExtractor = () => setExtractors([...extractors, { id: Date.now(), name: `item_${extractors.length + 1}`, tag: '', attrs: '' }]);

  const handleRemoveExtractor = (id: number) => {
    if (extractors.length > 1) {
      setExtractors(extractors.filter((e) => e.id !== id));
      const newTestResults = { ...testResults };
      delete newTestResults[id];
      setTestResults(newTestResults);
    }
  };

  const handleExtractorChange = useCallback((id: number, field: keyof Omit<Extractor, 'id'>, value: string) => {
    setExtractors(prev => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    const newTestResults = { ...testResults };
    delete newTestResults[id];
    setTestResults(newTestResults);
  }, [testResults]);
  
  const handleContainerChange = useCallback((field: 'tag' | 'attrs', value: string) => {
    setContainer(prev => ({ ...prev, [field]: value }));
    setContainerTestResult(null);
    setContainerSet(false);
    setExtractionMethod(null);
    if (scrapingMode === 'links') setExtractedLinks([]);
  }, [scrapingMode]);

  const handleLinkContainerChange = useCallback((field: 'tag' | 'attrs', value: string) => {
      setLinkContainer(prev => ({ ...prev, [field]: value }));
      setLinkContainerTestResult(null);
      setLinkContainerSet(false);
      setExtractedLinks([]);
  }, []);

  const handleLinkSelectorChange = useCallback((field: 'tag' | 'attrs', value: string) => {
      setLinkSelector(prev => ({ ...prev, [field]: value }));
      setLinkSelectorTestResult(null);
      setExtractedLinks([]);
  }, []);
  
  const handleModeChange = (mode: ScrapingMode) => {
      setScrapingMode(mode);
      setContainer({ tag: '', attrs: '' });
      setContainerTestResult(null);
      setContainerSet(false);
      setExtractionMethod(null);
      setExtractors([{ id: Date.now(), name: 'item_1', tag: '', attrs: '' }]);
      setTestResults({});
      setError('');
      if (mode === 'links') {
        setExtractedLinks([]);
        setLinkExtractionStrategy('all');
        setLinkContainer({ tag: '', attrs: '' });
        setLinkSelector({ tag: 'a', attrs: '' });
        setLinkContainerTestResult(null);
        setLinkSelectorTestResult(null);
        setLinkContainerSet(false);
      }
  }

  const handleGenerateBsCode = () => {
    setError('');
    if (scrapingMode === 'structured') {
        if (!isContainerSet || !container.tag) { setError('Please define and successfully test a container before generating the code.'); return; }
        if (extractors.length === 0 && extractionMethod !== 'auto') { setError('Please add at least one field to extract.'); return; }
        const invalidExtractor = extractors.find(e => !e.name.trim() || !e.tag.trim());
        if (invalidExtractor) { setError('Please fill in all field names and HTML tags for extraction.'); return; }
    } else if (scrapingMode === 'simple') {
        const singleExtractor = extractors[0];
        if (!singleExtractor.name.trim() || !singleExtractor.tag.trim()) { setError('Please fill in the field name and HTML tag for extraction.'); return; }
    } else if (scrapingMode === 'links') {
        if (linkExtractionStrategy === 'container' && !isLinkContainerSet) { setError('Please define and successfully test a Card Container before generating the code.'); return; }
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setSelectingFor(null);
    setContainerSet(false);
    setContainerTestResult(null);
    setExtractionMethod(null);
    setLinkContainerSet(false);
    setLinkContainerTestResult(null);
    setLinkSelectorTestResult(null);

    if (step > 1) {
      setStep(prevStep => prevStep - 1);
    } else if (scrapingType === 'static' && staticSource) {
      setStaticSource(null);
    } else if (scrapingType) {
      setScrapingType(null);
    } else {
      setCurrentView('advisor');
    }
  };

  const convertToSelector = (t: string, a: string): string => {
    let selector = t.trim();
    if (!a.trim()) return selector;
    const attrsRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
    let match;
    try {
        while ((match = attrsRegex.exec(a)) !== null) {
            const key = match[1].toLowerCase();
            const value = match[2] ?? match[3] ?? match[4];
            if (key && typeof value !== 'undefined') {
                if (key === 'id') {
                    selector += `#${value.split(/\s+/)[0]}`;
                } else if (key === 'class') {
                    const classes = value.split(/\s+/).filter(Boolean).join('.');
                    if (classes) selector += `.${classes}`;
                } else {
                    selector += `[${key}="${value.replace(/"/g, '\\"')}"]`;
                }
            }
        }
        return selector;
    } catch (e) {
        console.error("Error creating selector:", e);
        return 'INVALID_SELECTOR_DUE_TO_ATTR_PARSE_ERROR';
    }
  };
  
  const getBaseUrl = () => {
      try {
          return new URL(url || (scrapingScope === 'multi' && urlPrefix) || 'http://localhost');
      } catch (e) {
          return new URL('http://localhost'); // fallback
      }
  };

  const handleFindAllLinksPreview = useCallback(() => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) { setError("Cannot find HTML preview."); return; }
    
    const base = getBaseUrl();
    const anchors = Array.from(iframeDoc.querySelectorAll('a[href]'));
    
    if (anchors.length === 0) { setExtractedLinks([]); return; }

    const results = anchors.map(anchor => {
        const anchorEl = anchor as HTMLAnchorElement;
        const text = anchorEl.innerText.trim().replace(/\s\s+/g, ' ');
        let href = '';
        try {
            href = new URL(anchorEl.getAttribute('href') || '', base.href).href;
        } catch(e) {
            console.warn(`Could not parse href: ${anchorEl.getAttribute('href')}`);
            href = anchorEl.getAttribute('href') || '';
        }
        return { text, href, selected: true };
    });
    setExtractedLinks(results);
  }, [url, urlPrefix, scrapingScope]);

  const handleFindLinksInContainerPreview = useCallback(() => {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (!iframeDoc) { setError("Cannot find HTML preview."); return; }

      const containerSelector = convertToSelector(linkContainer.tag, linkContainer.attrs);
      const linkSel = convertToSelector(linkSelector.tag, linkSelector.attrs);
      if (!containerSelector || !linkSel) { setError("Container or Link selector is invalid."); return; }

      const base = getBaseUrl();
      const containers = iframeDoc.querySelectorAll(containerSelector);
      const results: { text: string; href: string; selected: boolean }[] = [];

      containers.forEach(c => {
          const anchor = c.querySelector(linkSel);
          if (anchor && anchor.getAttribute('href')) {
              const anchorEl = anchor as HTMLAnchorElement;
              const text = anchorEl.innerText.trim().replace(/\s\s+/g, ' ');
              let href = '';
              try {
                  href = new URL(anchorEl.getAttribute('href') || '', base.href).href;
              } catch (e) {
                  console.warn(`Could not parse href: ${anchorEl.getAttribute('href')}`);
                  href = anchorEl.getAttribute('href') || '';
              }
              results.push({ text, href, selected: true });
          }
      });
      setExtractedLinks(results);
  }, [url, urlPrefix, scrapingScope, linkContainer, linkSelector]);

  const handleTest = useCallback((type: 'container' | 'extractor' | 'linkContainer' | 'linkSelector', id: number | null, tag: string, attrs: string) => {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (!tag.trim() || !iframeDoc) {
          const result = { count: 0, preview: 'HTML Tag is empty.', error: true };
          if (type === 'container') { setContainerTestResult(result); setContainerSet(false); }
          else if (type === 'linkContainer') { setLinkContainerTestResult(result); setLinkContainerSet(false); }
          else if (type === 'extractor' && id) setTestResults(prev => ({ ...prev, [id]: result }));
          return;
      }
      
      const selector = convertToSelector(tag, attrs);
      try {
          if (type === 'container' || type === 'linkContainer') {
              const matches = iframeDoc.querySelectorAll(selector);
              const count = matches.length;
              const isSuccess = count > 0;
              const result = { count, preview: `Found ${count} repeating container elements.`, error: !isSuccess };
              if (type === 'container') { setContainerTestResult(result); setContainerSet(isSuccess); if (!isSuccess) setExtractionMethod(null); }
              else { setLinkContainerTestResult(result); setLinkContainerSet(isSuccess); }
          } else if (type === 'linkSelector') {
              const containerSel = convertToSelector(linkContainer.tag, linkContainer.attrs);
              const containers = iframeDoc.querySelectorAll(containerSel);
              if (containers.length > 0) {
                  // FIX: Explicitly type 'c' as Element to resolve type inference issue.
                  const matchesInContainers = Array.from(containers).filter((c: Element) => c.querySelector(selector));
                  const count = matchesInContainers.length;
                  setLinkSelectorTestResult({ count, preview: `${count} of ${containers.length} containers have a link match.`, error: count === 0 });
              } else { setLinkSelectorTestResult({ count: 0, preview: 'No card containers found to test within.', error: true }); }
          } else if (type === 'extractor' && id) {
             if (scrapingMode === 'structured' && container.tag) {
                   const containerSelector = convertToSelector(container.tag, container.attrs);
                   const containers = iframeDoc.querySelectorAll(containerSelector);
                   if (containers.length > 0) {
                     // FIX: Explicitly type 'c' as Element to resolve type inference issue.
                     const matchesInContainers = Array.from(containers).filter((c: Element) => c.querySelector(selector));
                     const count = matchesInContainers.length;
                     setTestResults(prev => ({ ...prev, [id]: { count, preview: `${count} of ${containers.length} containers have a match.`, error: count === 0 }}));
                   } else { setTestResults(prev => ({ ...prev, [id]: { count: 0, preview: 'No containers found to test within.', error: true }})); }
              } else {
                  const matches = iframeDoc.querySelectorAll(selector);
                  const count = matches.length;
                  const preview = `Found ${count} total matches. Preview: ` + Array.from(matches).slice(0, 3).map((el) => ((el as HTMLElement).textContent || '').trim().slice(0, 20).concat('...')).join(' | ');
                  setTestResults(prev => ({ ...prev, [id]: { count, preview: preview || `Found ${count} matches. (No text content)`, error: count === 0 } }));
              }
          }
      } catch (e) {
          const result = { count: 0, preview: 'Invalid Tag or Attributes for testing.', error: true };
          if (type === 'container') { setContainerTestResult(result); setContainerSet(false); setExtractionMethod(null); }
          else if (type === 'linkContainer') { setLinkContainerTestResult(result); setLinkContainerSet(false); }
          else if (type === 'linkSelector') { setLinkSelectorTestResult(result); }
          else if (type === 'extractor' && id) setTestResults(prev => ({ ...prev, [id]: result }));
      }
  }, [container, scrapingMode, linkContainer]);

  const generateExtractorDetails = (el: HTMLElement): { tag: string; attrs: string } => {
    const tag = el.tagName.toLowerCase();
    
    if (el.id && !/^\d+$/.test(el.id)) {
        return { tag, attrs: `id=${el.id}` };
    }

    const attrsArray: string[] = [];
    
    if (el.className && typeof el.className === 'string' && el.className.trim()) {
        attrsArray.push(`class="${el.className.trim()}"`);
    }

    if (attrsArray.length === 0) {
        for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            const name = attr.name.toLowerCase();
            const value = attr.value;

            if (!value || ['id', 'class', 'style'].includes(name) || name.startsWith('on')) {
                continue;
            }
            
            if (['href', 'src', 'alt', 'title', 'role', 'type', 'name'].some(p => name.startsWith(p)) || name.startsWith('data-')) {
                 attrsArray.push(`${name}="${value}"`);
            }
        }
    }
    
    return { tag, attrs: attrsArray.join(', ') };
  };

  const handleAutoDetectUrlPattern = async () => {
    if (!url || !url.startsWith('http')) { setError('Please enter a valid example URL first.'); return; }
    setError('');
    setAutoDetectUrlLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const encodedUrl = encodeURI(url);
      const prompt = `Given the URL: "${encodedUrl}". Find the page number in it. Replace that number with the placeholder "{page}". Return only the modified URL.`;
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      const pattern = response.text.trim();
      const placeholder = '{page}';
      if (pattern.includes(placeholder)) {
        const parts = pattern.split(placeholder);
        setUrlPrefix(parts[0]);
        setUrlSuffix(parts[1] || '');
      } else { setError('AI could not detect a page number pattern. Please set the prefix and suffix manually.'); setUrlPrefix(url); setUrlSuffix(''); }
    } catch (e) { console.error('Error detecting URL pattern with AI:', e); setError('An error occurred during AI pattern detection.');
    } finally { setAutoDetectUrlLoading(false); }
  };

  const handleAutoDetectNextSelector = async () => {
    if (!startPageHtml) { setError('Please upload the start page HTML file first to enable detection.'); return; }
    setError('');
    setAutoDetectSelectorLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Analyze the following HTML content and identify the element that functions as the 'Next Page' button or link in a pagination control. Provide a precise and robust CSS selector for this element. The element might contain text like "Next", ">", or "»". Return ONLY the CSS selector as a single line of text.`;
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{text: prompt}, {text: startPageHtml}] });
      const selector = response.text.trim();
      if (selector) { setNextPageSelector(selector); } 
      else { setError("AI could not determine a 'Next Page' selector. Please enter one manually."); }
    } catch (e) { console.error('Error auto-detecting next selector with AI:', e); setError('An error occurred during AI selector detection.');
    } finally { setAutoDetectSelectorLoading(false); }
  };

  const handleAutoFieldDetect = async () => {
    setError('');
    const iframeDoc = iframeRef.current?.contentDocument;
    const containerSelector = convertToSelector(container.tag, container.attrs);
    if (!iframeDoc || !containerSelector) { setError('Could not find HTML preview or container selector.'); return; }
    const firstContainer = iframeDoc.querySelector(containerSelector);
    if (!firstContainer) { setError('Could not find a container element in the preview to analyze.'); return; }
    setAutoFieldDetectLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const prompt = `Given this HTML snippet of a single item in a list: \`\`\`html\n${firstContainer.outerHTML}\n\`\`\`
      Identify the key pieces of information a user would want to extract. For each piece of information, provide:
      1. A short, descriptive variable name in snake_case (e.g., product_title).
      2. The HTML tag of the element (e.g., h2).
      3. A minimal but effective set of attributes to uniquely identify the element within the snippet (e.g., class=title).
      Return ONLY a JSON array of objects, where each object has "name", "tag", and "attrs" keys.
      Example: [{ "name": "product_title", "tag": "h2", "attrs": "class=title" }, { "name": "price", "tag": "span", "attrs": "class=price" }]`;

      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, tag: { type: Type.STRING }, attrs: { type: Type.STRING } }, required: ['name', 'tag', 'attrs'] } } } });
      const jsonStr = response.text.trim();
      const suggestedFields = JSON.parse(jsonStr);
      if (Array.isArray(suggestedFields) && suggestedFields.length > 0) {
        const newExtractors = suggestedFields.map(field => ({ id: Date.now() + Math.random(), name: field.name || 'unnamed_field', tag: field.tag || '', attrs: field.attrs || '' }));
        setExtractors(newExtractors);
      } else { setError('AI could not find any fields to extract. Please add them manually.'); setExtractors([]); }
      setExtractionMethod('manual');
    } catch (e) { console.error('Error auto-detecting fields with AI:', e); setError('An error occurred during AI field detection. Please try adding fields manually.');
    } finally { setAutoFieldDetectLoading(false); }
  };
  
  const handleAiLinkFilter = async () => {
    if (!aiLinkFilterPrompt.trim() || extractedLinks.length === 0) {
        setError("Please enter a filter instruction and ensure links have been extracted.");
        return;
    }
    setError('');
    setAiLinkFilterLoading(true);

    try {
        const ai = new GoogleGenAI({ apiKey });
        const linksToProcess = extractedLinks.map(({ text, href }) => ({ text, href }));
        const prompt = `You are an intelligent web scraping assistant. Your task is to filter a list of links based on a user's natural language request. The user will provide a list of links, each with 'text' and 'href' properties. You must analyze the user's request and the links, and then return a JSON array containing only the 'href' values of the links that should remain selected. Only include hrefs from the original list.

User request: "${aiLinkFilterPrompt}"
Links: ${JSON.stringify(linksToProcess)}
`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } } });
        const selectedHrefs = new Set(JSON.parse(response.text.trim()));
        setExtractedLinks(prevLinks => prevLinks.map(link => ({ ...link, selected: selectedHrefs.has(link.href) })));
    } catch (e) {
        console.error("Error filtering links with AI:", e);
        setError("An error occurred during AI filtering. Please try again or refine your instruction.");
    } finally {
        setAiLinkFilterLoading(false);
    }
  };

  const handleMultiPageModeChange = (mode: MultiPageMode) => {
    setMultiPageMode(mode);
    setError('');
    if (mode === 'button') setUrl(''); 
    setUrlPrefix('');
    setUrlSuffix('');
  };
  
    const handleToggleLinkSelection = (index: number) => {
        setExtractedLinks(prev => prev.map((link, i) => i === index ? { ...link, selected: !link.selected } : link));
    };

    const handleToggleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        const isSelected = event.target.checked;
        setExtractedLinks(prev => prev.map(link => ({ ...link, selected: isSelected })));
    };

    const handleExportLinks = (format: 'csv' | 'json') => {
        const selected = extractedLinks.filter(link => link.selected);
        if (selected.length === 0) {
            setError('Please select at least one link to export.');
            return;
        }
        setError('');

        const dataToExport = selected.map(({ text, href }) => ({ text, href }));
        let fileContent = '';
        let mimeType = '';
        let fileName = '';

        if (format === 'csv') {
            const header = '"Link Text","URL"\n';
            const rows = dataToExport.map(l => `"${(l.text || '').replace(/"/g, '""')}","${l.href}"`).join('\n');
            fileContent = header + rows;
            mimeType = 'text/csv;charset=utf-8;';
            fileName = 'links.csv';
        } else {
            fileContent = JSON.stringify(dataToExport, null, 2);
            mimeType = 'application/json;charset=utf-8;';
            fileName = 'links.json';
        }

        const blob = new Blob([fileContent], { type: mimeType });
        const link = document.createElement('a');
        if (link.href) {
            URL.revokeObjectURL(link.href);
        }
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

  useEffect(() => {
    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument;
    if (!iframeDoc || selectingFor === null) return;
    
    const handleMouseOver = (e: MouseEvent) => { 
      const target = e.target as HTMLElement;
      target.style.outline = '2px solid #0ea5e9'; // sky-500
      target.style.boxShadow = '0 0 0 3px rgba(14, 165, 233, 0.4)';
      target.style.cursor = 'crosshair';
    };
    const handleMouseOut = (e: MouseEvent) => { 
      const target = e.target as HTMLElement;
      target.style.outline = '';
      target.style.boxShadow = '';
      target.style.cursor = '';
    };
    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as HTMLElement;
      if (target && selectingFor !== null) {
        target.style.outline = '';
        target.style.boxShadow = '';

        const originalBg = target.style.backgroundColor;
        target.style.backgroundColor = '#0ea5e9';
        target.style.transition = 'background-color 0.1s ease';
        setTimeout(() => { target.style.backgroundColor = originalBg; }, 200);

        const { tag, attrs } = generateExtractorDetails(target);
        if (selectingFor === 'container') {
          handleContainerChange('tag', tag);
          handleContainerChange('attrs', attrs);
          setTimeout(() => handleTest('container', null, tag, attrs), 0);
        } else if (selectingFor === 'linkContainer') {
            handleLinkContainerChange('tag', tag);
            handleLinkContainerChange('attrs', attrs);
            setTimeout(() => handleTest('linkContainer', null, tag, attrs), 0);
        } else if (selectingFor === 'linkSelector') {
            handleLinkSelectorChange('tag', tag);
            handleLinkSelectorChange('attrs', attrs);
            setTimeout(() => handleTest('linkSelector', null, tag, attrs), 0);
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
      const previouslyHovered = iframeDoc.querySelector('[style*="outline"]');
      if (previouslyHovered) {
          (previouslyHovered as HTMLElement).style.outline = '';
          (previouslyHovered as HTMLElement).style.boxShadow = '';
          (previouslyHovered as HTMLElement).style.cursor = '';
      }
      iframeDoc.removeEventListener('mouseover', handleMouseOver);
      iframeDoc.removeEventListener('mouseout', handleMouseOut);
      iframeDoc.removeEventListener('click', handleClick, true);
    };
  }, [selectingFor, handleExtractorChange, handleContainerChange, handleTest, handleLinkContainerChange, handleLinkSelectorChange]);
  
  useEffect(() => {
    const isDynamicFinal = scrapingType === 'dynamic' && step === (useProxy ? 6 : 5);
    const isStaticUrlFinal = scrapingType === 'static' && staticSource === 'url' && step === (useProxy ? 4 : 3);
    const isStaticFileFinal = scrapingType === 'static' && staticSource === 'file' && step === 3;
        
    if (isDynamicFinal || isStaticUrlFinal || isStaticFileFinal) {
      const code = generateBeautifulSoupCode({ 
        projectName, 
        scrapingMode, 
        container, 
        extractors, 
        outputFormat,
        source: (scrapingType === 'static' && staticSource === 'url') ? 'live-url' : 'local-files',
        linkExtractionStrategy,
        linkContainer,
        linkSelector,
        url: scrapingScope === 'single' ? url : '',
        urlPrefix: scrapingScope === 'multi' ? urlPrefix : '',
        urlSuffix: scrapingScope === 'multi' ? urlSuffix : '',
        proxyList: useProxy ? proxyList : '',
        delay,
        browser,
      });
      setBsCode(code);
    }
  }, [outputFormat, step, extractors, container, scrapingMode, projectName, scrapingScope, url, urlPrefix, urlSuffix, proxyList, delay, browser, staticSource, linkExtractionStrategy, linkContainer, linkSelector, useProxy, isContainerSet, isLinkContainerSet]);

  // Handle automatic link preview for the "All Links" strategy
  useEffect(() => {
    if (scrapingMode === 'links' && htmlContents.length > 0 && linkExtractionStrategy === 'all') {
      handleFindAllLinksPreview();
    }
  }, [scrapingMode, htmlContents, handleFindAllLinksPreview, linkExtractionStrategy]);

  // Handle automatic link preview for the "Links from Cards" strategy
  useEffect(() => {
    if (scrapingMode === 'links' && linkExtractionStrategy === 'container' && isLinkContainerSet) {
        handleFindLinksInContainerPreview();
    }
  }, [scrapingMode, linkExtractionStrategy, isLinkContainerSet, linkContainer, linkSelector, handleFindLinksInContainerPreview]);

  let steps: string[] = [];
  if (scrapingType === 'dynamic') {
      const engineName = dynamicEngine === 'playwright' ? 'Playwright' : 'Selenium';
      steps = ["Configure", `Run ${engineName} Script`, "Upload Sample", "Define Extractors", "Get Scraper"];
      if (useProxy) { steps.splice(1, 0, "Configure Proxies"); }
  } else if (scrapingType === 'static') {
      if (staticSource === 'url') {
        steps = ["Configure", "Define Extractors", "Get Scraper"];
        if (useProxy) { steps.splice(1, 0, "Configure Proxies"); }
      } else if (staticSource === 'file') {
        steps = ["Upload HTML", "Define Extractors", "Get Scraper"];
      }
  }

  const renderExtractorUI = (currentStep: number) => {
    const singleExtractor = extractors[0];
    const singleTestResult = testResults[singleExtractor.id];
    const selectedLinksCount = extractedLinks.filter(l => l.selected).length;
    const allLinksSelected = extractedLinks.length > 0 && selectedLinksCount === extractedLinks.length;

    const generateCodeDisabled = (scrapingMode === 'structured' && (!isContainerSet || !container.tag)) || (scrapingMode === 'links' && linkExtractionStrategy === 'container' && !isLinkContainerSet);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[75vh]">
            <div className="flex flex-col"><h2 className="text-xl font-semibold text-zinc-100 mb-2">HTML Preview</h2><div className="flex-grow border border-zinc-700 rounded-lg overflow-hidden relative shadow-inner bg-white">{selectingFor !== null && ( <div className="absolute inset-x-0 top-0 bg-white text-black text-center text-sm py-1 z-10 animate-pulse">Selection Mode Active</div> )}<iframe ref={iframeRef} srcDoc={htmlContents[0]?.content || ''} title="HTML Preview" className="w-full h-full" sandbox="allow-same-origin"/></div></div>
            <div className="flex flex-col"><div className="space-y-6 flex-grow overflow-y-auto pr-2 -mr-2">
            <div><h3 className="text-lg font-semibold text-zinc-100">Step {currentStep}: Define What to Extract</h3><fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4"><label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${scrapingMode === 'structured' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">Extract Structured Data</span><span className="text-sm text-zinc-400 mt-1">Multiple fields from repeating items.</span><input type="radio" name="scraping-mode" value="structured" checked={scrapingMode === 'structured'} onChange={() => handleModeChange('structured')} className="absolute h-full w-full opacity-0" /></label><label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${scrapingMode === 'links' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">Extract Links</span><span className="text-sm text-zinc-400 mt-1">Find hyperlinks from the page.</span><input type="radio" name="scraping-mode" value="links" checked={scrapingMode === 'links'} onChange={() => handleModeChange('links')} className="absolute h-full w-full opacity-0" /></label><label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${scrapingMode === 'simple' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">Extract a Simple List</span><span className="text-sm text-zinc-400 mt-1">A single list of all matching items.</span><input type="radio" name="scraping-mode" value="simple" checked={scrapingMode === 'simple'} onChange={() => handleModeChange('simple')} className="absolute h-full w-full opacity-0" /></label></fieldset></div>
            
            {scrapingMode === 'structured' && (<>
                <div><h3 className="text-base font-semibold text-zinc-300">Define Container</h3><p className="text-xs text-zinc-500 mb-2">Specify the repeating element that contains the data you want to extract.</p><div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-2 mt-2"><div className="flex items-center gap-2"><input type="text" value={container.tag} onChange={(e) => handleContainerChange('tag', e.target.value)} placeholder="HTML Tag (e.g., div)" className="w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" /><button onClick={() => setSelectingFor(selectingFor === 'container' ? null : 'container')} className={`p-2 rounded-md transition-colors ${selectingFor === 'container' ? 'bg-white text-black' : 'bg-zinc-700 hover:bg-zinc-600 text-white'}`} title="Select container"><CursorArrowRaysIcon /></button><button onClick={() => handleTest('container', null, container.tag, container.attrs)} className="p-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-white" title="Test container"><PlayIcon /></button></div><textarea value={container.attrs} onChange={(e) => handleContainerChange('attrs', e.target.value)} placeholder="Attributes (e.g., class=quote)" rows={1} className="w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" />
                {containerTestResult && (<div className={`p-2 text-xs rounded-md border flex items-center gap-2 bg-zinc-900 border-zinc-800`}><div className={containerTestResult.error ? 'text-zinc-500' : 'text-white'}>{containerTestResult.error ? <XCircleIcon /> : <CheckCircleIcon />}</div><p className="text-zinc-300">{containerTestResult.preview}</p></div>)}</div></div>
                {isContainerSet && extractionMethod === null && (<div className="p-4 border-2 border-dashed border-zinc-700 bg-zinc-900/50 rounded-lg"><h3 className="text-base font-semibold text-zinc-300">Define Fields to Extract</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"><button onClick={handleAutoFieldDetect} disabled={autoFieldDetectLoading} className="w-full px-3 py-2 bg-zinc-700 text-zinc-100 font-semibold rounded-md hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-wait flex items-center justify-center transition-colors">{autoFieldDetectLoading ? 'Detecting...' : <><SparklesIcon className="mr-2" /> Auto-detect Fields</>}</button><button onClick={() => setExtractionMethod('manual')} className="w-full px-3 py-2 bg-transparent font-semibold rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800 transition-colors">Add Fields Manually</button></div></div>)}
                {isContainerSet && extractionMethod === 'manual' && (<div><h3 className="text-base font-semibold text-zinc-300">Define Fields to Extract</h3><div className="space-y-4">{extractors.map((extractor, index) => {const testResult = testResults[extractor.id];return (<div key={extractor.id} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg"><div className="flex justify-between items-center mb-2"><label className="block text-sm font-medium text-zinc-300">Field #{index + 1}</label><button onClick={() => handleRemoveExtractor(extractor.id)} disabled={extractors.length <= 1} className="text-zinc-500 hover:text-zinc-300 disabled:text-zinc-700" aria-label="Remove"><TrashIcon /></button></div><div className="grid grid-cols-1 gap-4"><input type="text" value={extractor.name} onChange={(e) => handleExtractorChange(extractor.id, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))} placeholder="Variable Name" className="w-full px-3 py-2 border border-zinc-700 rounded-md text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" /><div className="flex items-center gap-2"><input type="text" value={extractor.tag} onChange={(e) => handleExtractorChange(extractor.id, 'tag', e.target.value)} placeholder="HTML Tag" className="w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" /><button onClick={() => setSelectingFor(extractor.id === selectingFor ? null : extractor.id)} className={`p-2 rounded-md transition-colors ${selectingFor === extractor.id ? 'bg-white text-black' : 'bg-zinc-700 hover:bg-zinc-600 text-white'}`} title="Select element"><CursorArrowRaysIcon /></button><button onClick={() => handleTest('extractor', extractor.id, extractor.tag, extractor.attrs)} className="p-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-white" title="Test field"><PlayIcon /></button></div><textarea value={extractor.attrs} onChange={(e) => handleExtractorChange(extractor.id, 'attrs', e.target.value)} placeholder="Attributes" rows={2} className="w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" />
                {testResult && (<div className={`mt-2 p-2 text-xs rounded-md border flex items-center gap-2 bg-zinc-900 border-zinc-800`}><div className={testResult.error ? 'text-zinc-500' : 'text-white'}>{testResult.error ? <XCircleIcon /> : <CheckCircleIcon />}</div><p className="text-zinc-300">{testResult.preview}</p></div>)}</div></div>);})}</div><button onClick={handleAddExtractor} className="mt-4 flex items-center justify-center w-full bg-zinc-800 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-700 transition-colors"><PlusIcon />Add Field</button></div>)}</>
            )}

            {scrapingMode === 'links' && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold text-zinc-300">Link Extraction Strategy</h3>
                        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                            <label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${linkExtractionStrategy === 'all' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">All Links on Page</span><input type="radio" name="link-strategy" value="all" checked={linkExtractionStrategy === 'all'} onChange={() => setLinkExtractionStrategy('all')} className="absolute h-full w-full opacity-0" /></label>
                            <label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${linkExtractionStrategy === 'container' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">Links from Cards</span><input type="radio" name="link-strategy" value="container" checked={linkExtractionStrategy === 'container'} onChange={() => setLinkExtractionStrategy('container')} className="absolute h-full w-full opacity-0" /></label>
                        </fieldset>
                    </div>

                    {linkExtractionStrategy === 'container' && (
                        <div className="space-y-4">
                            <div><h3 className="text-base font-semibold text-zinc-300">Define Card Container</h3><p className="text-xs text-zinc-500 mb-2">The repeating element containing the link.</p><div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-2"><div className="flex items-center gap-2"><input type="text" value={linkContainer.tag} onChange={(e) => handleLinkContainerChange('tag', e.target.value)} placeholder="HTML Tag (e.g., div)" className="w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" /><button onClick={() => setSelectingFor(selectingFor === 'linkContainer' ? null : 'linkContainer')} className={`p-2 rounded-md transition-colors ${selectingFor === 'linkContainer' ? 'bg-white text-black' : 'bg-zinc-700 hover:bg-zinc-600 text-white'}`} title="Select card container"><CursorArrowRaysIcon /></button><button onClick={() => handleTest('linkContainer', null, linkContainer.tag, linkContainer.attrs)} className="p-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-white" title="Test card container"><PlayIcon /></button></div><textarea value={linkContainer.attrs} onChange={(e) => handleLinkContainerChange('attrs', e.target.value)} placeholder="Attributes (e.g., class=product)" rows={1} className="w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" />
                            {linkContainerTestResult && (<div className={`p-2 text-xs rounded-md border flex items-center gap-2 bg-zinc-900 border-zinc-800`}><div className={linkContainerTestResult.error ? 'text-zinc-500' : 'text-white'}>{linkContainerTestResult.error ? <XCircleIcon /> : <CheckCircleIcon />}</div><p className="text-zinc-300">{linkContainerTestResult.preview}</p></div>)}</div></div>
                            
                            {isLinkContainerSet && <div><h3 className="text-base font-semibold text-zinc-300">Define Link Element (within card)</h3><p className="text-xs text-zinc-500 mb-2">The specific link inside the container.</p><div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-2"><div className="flex items-center gap-2"><input type="text" value={linkSelector.tag} onChange={(e) => handleLinkSelectorChange('tag', e.target.value)} placeholder="HTML Tag (e.g., a)" className="w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" /><button onClick={() => setSelectingFor(selectingFor === 'linkSelector' ? null : 'linkSelector')} className={`p-2 rounded-md transition-colors ${selectingFor === 'linkSelector' ? 'bg-white text-black' : 'bg-zinc-700 hover:bg-zinc-600 text-white'}`} title="Select link element"><CursorArrowRaysIcon /></button><button onClick={() => handleTest('linkSelector', null, linkSelector.tag, linkSelector.attrs)} className="p-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-white" title="Test link element"><PlayIcon /></button></div><textarea value={linkSelector.attrs} onChange={(e) => handleLinkSelectorChange('attrs', e.target.value)} placeholder="Attributes (e.g., class=product-link)" rows={1} className="w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" />
                            {linkSelectorTestResult && (<div className={`p-2 text-xs rounded-md border flex items-center gap-2 bg-zinc-900 border-zinc-800`}><div className={linkSelectorTestResult.error ? 'text-zinc-500' : 'text-white'}>{linkSelectorTestResult.error ? <XCircleIcon /> : <CheckCircleIcon />}</div><p className="text-zinc-300">{linkSelectorTestResult.preview}</p></div>)}</div></div>}
                        </div>
                    )}

                    {extractedLinks.length > 0 ? (
                        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-3">
                            <div className="space-y-2 pb-3 border-b border-zinc-700"><label htmlFor="ai-link-filter" className="text-sm font-medium text-zinc-300 flex items-center gap-2"><SparklesIcon /> AI-Powered Filtering</label><div className="flex flex-col sm:flex-row gap-2"><input id="ai-link-filter" type="text" value={aiLinkFilterPrompt} onChange={(e) => setAiLinkFilterPrompt(e.target.value)} placeholder="e.g., keep only links to user profiles" className="flex-grow w-full px-3 py-1.5 border border-zinc-700 rounded-md font-sans text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" disabled={aiLinkFilterLoading} /><button onClick={handleAiLinkFilter} disabled={aiLinkFilterLoading || !aiLinkFilterPrompt.trim()} className="w-full sm:w-auto text-sm bg-zinc-700 text-zinc-100 font-semibold py-1.5 px-3 rounded-md hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors flex items-center justify-center">{aiLinkFilterLoading ? (<><svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Filtering...</>) : ('Apply Filter')}</button></div></div>
                            <div className="flex justify-between items-center text-sm"><label className="flex items-center gap-2 font-medium text-zinc-200"><input type="checkbox" checked={allLinksSelected} onChange={handleToggleSelectAll} className="h-4 w-4 rounded bg-zinc-800 border-zinc-600 text-white focus:ring-white" />Select All</label><span className="text-zinc-400">{selectedLinksCount} / {extractedLinks.length} selected</span></div>
                            <div className="max-h-60 overflow-y-auto border border-zinc-700 rounded-md p-1 space-y-1">{extractedLinks.map((link, index) => (<div key={index} className="p-1.5 rounded hover:bg-zinc-800"><label className="flex items-start cursor-pointer gap-2"><input type="checkbox" checked={link.selected} onChange={() => handleToggleLinkSelection(index)} className="h-4 w-4 rounded bg-zinc-800 border-zinc-600 text-white focus:ring-white mt-1" /><div className="text-sm overflow-hidden flex-1"><p className="font-medium text-zinc-200 line-clamp-2" title={link.text}>{link.text || '[No Text]'}</p><p className="text-zinc-400 truncate" title={link.href}>{link.href || '[No URL]'}</p></div></label></div>))}</div>
                            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-zinc-700"><button onClick={() => handleExportLinks('csv')} disabled={selectedLinksCount === 0} className="w-full text-sm bg-zinc-700 text-zinc-100 font-semibold py-2 px-3 rounded-md hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors">Export as CSV</button><button onClick={() => handleExportLinks('json')} disabled={selectedLinksCount === 0} className="w-full text-sm bg-zinc-700 text-zinc-100 font-semibold py-2 px-3 rounded-md hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors">Export as JSON</button></div>
                        </div>
                    ) : (
                        <p className="text-sm text-zinc-400 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">{linkExtractionStrategy === 'all' ? 'No links found in the sample HTML file. The script will find all links when run.' : 'No links found with the current selectors.'}</p>
                    )}
                </div>
            )}
            
            {scrapingMode === 'simple' && (
                <div><h3 className="text-base font-semibold text-zinc-300">Define Field to Extract</h3><div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg"><div className="grid grid-cols-1 gap-4"><input type="text" value={singleExtractor.name} onChange={(e) => handleExtractorChange(singleExtractor.id, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))} placeholder="Variable Name" className="w-full px-3 py-2 border border-zinc-700 rounded-md text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" /><div className="flex items-center gap-2"><input type="text" value={singleExtractor.tag} onChange={(e) => handleExtractorChange(singleExtractor.id, 'tag', e.target.value)} placeholder="HTML Tag" className="w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" /><button onClick={() => setSelectingFor(singleExtractor.id === selectingFor ? null : singleExtractor.id)} className={`p-2 rounded-md transition-colors ${selectingFor === singleExtractor.id ? 'bg-white text-black' : 'bg-zinc-700 hover:bg-zinc-600 text-white'}`} title="Select element"><CursorArrowRaysIcon /></button><button onClick={() => handleTest('extractor', singleExtractor.id, singleExtractor.tag, singleExtractor.attrs)} className="p-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-white" title="Test field"><PlayIcon /></button></div><textarea value={singleExtractor.attrs} onChange={(e) => handleExtractorChange(singleExtractor.id, 'attrs', e.target.value)} placeholder="Attributes" rows={2} className="w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200 focus:ring-1 focus:ring-white focus:border-white" />
                {singleTestResult && (<div className={`mt-2 p-2 text-xs rounded-md border flex items-center gap-2 bg-zinc-900 border-zinc-800`}><div className={singleTestResult.error ? 'text-zinc-500' : 'text-white'}>{singleTestResult.error ? <XCircleIcon /> : <CheckCircleIcon />}</div><p className="text-zinc-300">{singleTestResult.preview}</p></div>)}</div></div></div>
            )}
            </div>
            {error && <p className="text-red-400 font-semibold text-sm mt-2">{error}</p>}
            <div className="mt-2 flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-800">
              <button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Back</button>
              <button 
                onClick={handleGenerateBsCode} 
                disabled={htmlContents.length === 0 || generateCodeDisabled}
                className="w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed transition-all" 
                title={generateCodeDisabled ? 'Please define and test a container first' : ''}>
                Generate Scraper Code
              </button>
            </div>
            </div>
        </div>
    );
  }

  const renderAppContent = () => {
    if (!scrapingType) {
        return (
            <div>
                <h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step 1: Choose Scraping Method</h2>
                <p className="text-zinc-400 mb-6">Select the best method for your target website.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button onClick={() => setScrapingType('dynamic')} className="p-6 border border-zinc-800 rounded-lg text-left bg-zinc-900/50 hover:border-white hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-white transition-all transform hover:scale-105"><h3 className="text-lg font-bold text-zinc-100">Dynamic Web Scraping</h3><p className="text-sm text-zinc-400 mt-2">Best for modern websites that use JavaScript to load content. Uses Selenium to control a real browser.</p></button>
                    <button onClick={() => setScrapingType('static')} className="p-6 border border-zinc-800 rounded-lg text-left bg-zinc-900/50 hover:border-white hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-white transition-all transform hover:scale-105"><h3 className="text-lg font-bold text-zinc-100">Static Web Scraping</h3><p className="text-sm text-zinc-400 mt-2">Best for simple websites. Uses Requests and BeautifulSoup for fast, direct HTML parsing.</p></button>
                </div>
                 <div className="mt-8"><button onClick={handleBack} className="w-full sm:w-auto bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Back to Advisor</button></div>
            </div>
        )
    }

    if (scrapingType === 'dynamic') {
        const scriptStep = useProxy ? 3 : 2;
        const uploadStep = useProxy ? 4 : 3;
        const extractorStep = useProxy ? 5 : 4;
        const finalStep = useProxy ? 6 : 5;
        const engineName = dynamicEngine === 'playwright' ? 'Playwright' : 'Selenium';
        const codeToDisplay = dynamicEngine === 'playwright' ? playwrightCode : seleniumCode;

        if (step === 1) {
            return (
              <div><h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step 1: Configure Scraper</h2><p className="text-zinc-400 mb-4">Set up the details for your dynamic scraper.</p><div className="space-y-4">
                  <div><label className="block text-sm font-medium text-zinc-300 mb-2">Automation Engine</label><fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${dynamicEngine === 'selenium' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">Selenium</span><span className="text-sm text-zinc-400 mt-1">Classic, highly compatible.</span><input type="radio" name="dynamic-engine" value="selenium" checked={dynamicEngine === 'selenium'} onChange={() => setDynamicEngine('selenium')} className="absolute h-full w-full opacity-0 cursor-pointer" /></label><label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${dynamicEngine === 'playwright' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">Playwright</span><span className="text-sm text-zinc-400 mt-1">Modern, fast, and reliable.</span><input type="radio" name="dynamic-engine" value="playwright" checked={dynamicEngine === 'playwright'} onChange={() => setDynamicEngine('playwright')} className="absolute h-full w-full opacity-0 cursor-pointer" /></label></fieldset></div>
                  <div><label htmlFor="project-name" className="block text-sm font-medium text-zinc-300">Project Folder Name</label><input id="project-name" type="text" value={projectName} onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} placeholder="e.g., my_web_scraper" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200 focus:ring-2 focus:ring-white" /><p className="text-xs text-zinc-500 mt-1">All generated files (HTML, CSV, etc.) will be saved in this folder.</p></div>
                  <div><label htmlFor="browser-select" className="block text-sm font-medium text-zinc-300">Browser</label><select id="browser-select" value={browser} onChange={(e) => setBrowser(e.target.value as Browser)} className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200 focus:ring-2 focus:ring-white"><option value="chrome">Chrome (Recommended)</option><option value="firefox">Firefox</option><option value="edge">Microsoft Edge</option><option value="brave">Brave</option><option value="opera">Opera</option></select></div>
                  <div><label htmlFor="delay-timer" className="block text-sm font-medium text-zinc-300">Delay Between Actions (milliseconds)</label><input id="delay-timer" type="number" value={delay} onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value, 10) || 0))} min="0" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200 focus:ring-2 focus:ring-white" /><p className="text-xs text-zinc-500 mt-1">Time to wait for pages to load (e.g., 5000ms = 5s). Increase for slower websites.</p></div>
                  <div className="mt-4"><label className="flex items-center justify-between p-4 border border-zinc-800 rounded-lg cursor-pointer bg-zinc-900/50"><div><span className="font-semibold text-zinc-100">Use Proxies</span><span className="block text-sm mt-1 text-zinc-500">Route requests through a list of proxies.</span></div><div className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${useProxy ? 'bg-white' : 'bg-zinc-700'}`}><span className={`inline-block w-4 h-4 transform bg-black rounded-full transition-transform ${useProxy ? 'translate-x-6' : 'translate-x-1'}`} /><input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} className="absolute w-full h-full opacity-0 cursor-pointer" /></div></label></div>
                  <div><label className="block text-sm font-medium text-zinc-300 mb-2">Scraping Scope</label><fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${scrapingScope === 'single' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">Single Page</span><span className="text-sm text-zinc-400 mt-1">Scrape one URL.</span><input type="radio" name="scraping-scope" value="single" checked={scrapingScope === 'single'} onChange={() => setScrapingScope('single')} className="absolute h-full w-full opacity-0 cursor-pointer" /></label><label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${scrapingScope === 'multi' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">Multiple Pages</span><span className="text-sm text-zinc-400 mt-1">Scrape using pagination.</span><input type="radio" name="scraping-scope" value="multi" checked={scrapingScope === 'multi'} onChange={() => setScrapingScope('multi')} className="absolute h-full w-full opacity-0 cursor-pointer" /></label></fieldset></div>
                  {scrapingScope === 'multi' && (<div className="p-4 border border-zinc-800 bg-zinc-900/50 rounded-lg space-y-4"><fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className={`relative flex items-center p-3 border rounded-lg cursor-pointer text-sm transition-all ${multiPageMode === 'button' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><input type="radio" name="multi-page-mode" value="button" checked={multiPageMode === 'button'} onChange={() => handleMultiPageModeChange('button')} className="h-4 w-4 text-white bg-zinc-800 border-zinc-600 focus:ring-white" /><span className="ml-3 font-medium text-zinc-100">Click 'Next' Button</span></label><label className={`relative flex items-center p-3 border rounded-lg cursor-pointer text-sm transition-all ${multiPageMode === 'url' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><input type="radio" name="multi-page-mode" value="url" checked={multiPageMode === 'url'} onChange={() => handleMultiPageModeChange('url')} className="h-4 w-4 text-white bg-zinc-800 border-zinc-600 focus:ring-white" /><span className="ml-3 font-medium text-zinc-100">URL Pattern</span></label></fieldset><div><label htmlFor="start-page" className="block text-sm font-medium text-zinc-300">Start Page Number</label><input id="start-page" type="number" value={startPage} onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200" /></div><div><label htmlFor="num-pages" className="block text-sm font-medium text-zinc-300">Total Pages to Scrape</label><input id="num-pages" type="number" value={numPages} onChange={(e) => setNumPages(Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" max="100" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200" /></div>{multiPageMode === 'button' ? (<div className="space-y-3"><div><label htmlFor="start-url-button" className="block text-sm font-medium text-zinc-300">Start URL</label><input id="start-url-button" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page/1" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200" /></div><div><label htmlFor="next-selector" className="block text-sm font-medium text-zinc-300">"Next Page" Button CSS Selector</label><input id="next-selector" type="text" value={nextPageSelector} onChange={(e) => setNextPageSelector(e.target.value)} placeholder="e.g., li.next > a" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200" /></div><div className="p-3 border-2 border-dashed border-zinc-700 rounded-lg bg-zinc-900"><p className="text-xs text-zinc-300 mb-2">Don't know the selector? Upload the start page's HTML file and let AI find it for you.</p><div className="flex items-center gap-2"><label htmlFor="start-page-html-upload" className="flex-grow text-sm"><span className="cursor-pointer rounded-md bg-zinc-800 font-semibold text-zinc-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-white focus-within:ring-offset-2 hover:text-white border border-zinc-600 px-3 py-1.5">{startPageHtml ? 'File ready' : 'Upload HTML file'}</span><input id="start-page-html-upload" name="start-page-html-upload" type="file" className="sr-only" accept=".html" onChange={handleStartPageHtmlUpload} /></label><button onClick={handleAutoDetectNextSelector} disabled={autoDetectSelectorLoading || !startPageHtml} className="px-3 py-1.5 bg-zinc-700 text-zinc-100 text-sm font-semibold rounded-md hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed flex items-center">{autoDetectSelectorLoading ? 'Detecting...' : "✨ Auto-detect Selector"}</button></div></div></div>) : (<div className="space-y-3"><div><label htmlFor="url-pattern-input" className="block text-sm font-medium text-zinc-300">Example URL (from page 2+)</label><div className="flex items-center gap-2 mt-1"><input id="url-pattern-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/products?page=2" className="flex-grow px-4 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200" /><button onClick={handleAutoDetectUrlPattern} disabled={autoDetectUrlLoading} className="px-3 py-2 bg-zinc-700 text-zinc-100 font-semibold rounded-md hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 flex items-center">{autoDetectUrlLoading ? 'Detecting...' : "✨ Auto-detect Pattern"}</button></div></div><div><label htmlFor="url-prefix" className="block text-sm font-medium text-zinc-300">URL Prefix</label><input id="url-prefix" type="text" value={urlPrefix} onChange={(e) => setUrlPrefix(e.target.value)} placeholder="https://example.com/page=" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200" /></div><div><label htmlFor="url-suffix" className="block text-sm font-medium text-zinc-300">URL Suffix (optional)</label><input id="url-suffix" type="text" value={urlSuffix} onChange={(e) => setUrlSuffix(e.target.value)} placeholder=".html" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200" /></div></div>)}</div>)}
                  {scrapingScope === 'single' && (<div><label htmlFor="url-input" className="block text-sm font-medium text-zinc-300">Website URL</label><input id="url-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="mt-1 w-full px-4 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200" /></div>)}
                  {error && <p className="text-red-400 font-semibold text-sm mt-2">{error}</p>}
                  <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3"><button onClick={handleNextFromDynamicConfig} className="w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 transition-all">Continue</button><button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Change Method</button></div></div></div>
            );
        } else if (useProxy && step === 2) {
            return (<div><h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step 2: Configure Proxies</h2><p className="text-zinc-400 mb-4">Provide your list of proxies, one per line. Format: `ip:port`</p><div className="space-y-4"><div><label htmlFor="proxy-list" className="block text-sm font-medium text-zinc-300">Proxy List</label><textarea id="proxy-list" rows={8} value={proxyList} onChange={(e) => setProxyList(e.target.value)} placeholder="192.168.1.1:8080&#10;192.168.1.2:8080" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200" /></div><div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-700" /></div><div className="relative flex justify-center"><span className="bg-black/60 px-2 text-sm text-zinc-500">Or</span></div></div><label htmlFor="proxy-file-upload" className="relative cursor-pointer rounded-lg bg-transparent font-semibold text-zinc-200 focus-within:outline-none hover:text-white text-center block border border-dashed border-zinc-700 py-4 hover:border-zinc-500"><span>Upload a .txt file</span><input id="proxy-file-upload" type="file" className="sr-only" accept=".txt" onChange={handleProxyFileChange} /></label>{error && <p className="text-red-400 font-semibold text-sm mt-2">{error}</p>}</div><div className="mt-6 flex flex-col sm:flex-row gap-3"><button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Back</button><button onClick={handleGenerateDynamicWithProxy} className="w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 transition-all">Generate {engineName} Code</button></div></div>);
        } else if (step === scriptStep) {
            return (<div><h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step {scriptStep}: Run {engineName} Script</h2><p className="text-zinc-400 mb-4">Run this script locally to create a <span className="font-mono bg-zinc-800 p-1 rounded">{projectName}</span> folder and save the page HTML inside it.</p><div className="rounded-lg shadow-md overflow-hidden"><CodeBlock code={codeToDisplay} /><AiCodeDebugger apiKey={apiKey} originalCode={codeToDisplay} codeType={engineName} /></div><div className="mt-4 flex flex-col sm:flex-row gap-3"><button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Back</button><button onClick={() => setStep(scriptStep + 1)} className="w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 transition-all">Next: Upload Sample HTML</button></div></div>);
        } else if (step === uploadStep) {
            return (<div><h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step {uploadStep}: Upload Sample HTML File</h2><p className="text-zinc-400 mb-4">Upload one of the HTML files your {engineName} script generated.</p><div className="mt-4 flex justify-center rounded-lg border border-dashed border-zinc-700 px-6 py-10"><div className="text-center"><div className="mt-4 flex text-sm leading-6 text-zinc-400"><label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-white hover:text-zinc-300"><span>Upload a file</span><input id="file-upload" type="file" className="sr-only" accept=".html" onChange={handleFileChange} /></label><p className="pl-1">or drag and drop</p></div><p className="text-xs leading-5 text-zinc-500">A single HTML file up to 10MB</p></div></div>{error && <p className="text-red-400 font-semibold text-sm mt-2">{error}</p>}<div className="mt-6 flex flex-col sm:flex-row gap-3"><button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Back</button><button onClick={() => setStep(uploadStep + 1)} className="w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed transition-all" disabled={htmlContents.length === 0}>Next: Define Extractors</button></div></div>);
        } else if (step === extractorStep) {
            return renderExtractorUI(extractorStep);
        } else if (step === finalStep) {
            return (<div><h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step {finalStep}: Final BeautifulSoup Script</h2><p className="text-zinc-400 mb-4">Run this script in the parent directory of your <span className="font-mono bg-zinc-800 p-1 rounded">{projectName}</span> folder to extract the data.</p><div className="mb-4"><label className="block text-sm font-medium mb-2 text-zinc-300">Output Format:</label><div className="flex items-center space-x-4">{(['csv', 'json', 'print'] as OutputFormat[]).map((format) => (<label key={format} className="flex items-center"><input type="radio" name="output-format" value={format} checked={outputFormat === format} onChange={() => setOutputFormat(format)} className="h-4 w-4 text-white bg-zinc-800 border-zinc-600 focus:ring-white" /><span className="ml-2 text-sm capitalize">{format === 'print' ? 'Print to Console' : format.toUpperCase()}</span></label>))}</div></div><div className="rounded-lg shadow-md overflow-hidden"><CodeBlock code={bsCode} /><AiCodeDebugger apiKey={apiKey} originalCode={bsCode} codeType="BeautifulSoup" /></div><div className="mt-4 flex flex-col sm:flex-row-reverse gap-3"><button onClick={handleStartOver} className="w-full bg-zinc-800 text-white font-semibold py-2 px-4 rounded-lg hover:bg-zinc-700 flex items-center justify-center gap-2 transition-colors"><ArrowPathIcon />Start Over</button><button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Back</button></div></div>);
        } else {
             return <div>Invalid Step</div>;
        }
    }

    if (scrapingType === 'static') {
        if (!staticSource) {
            return (
                <div>
                    <h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step 1: Choose Static Scraping Source</h2>
                    <p className="text-zinc-400 mb-6">How do you want to get the HTML content?</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button onClick={() => setStaticSource('url')} className="p-6 border border-zinc-800 rounded-lg text-left bg-zinc-900/50 hover:border-white hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-white transition-all transform hover:scale-105"><h3 className="text-lg font-bold text-zinc-100">Scrape from URL</h3><p className="text-sm text-zinc-400 mt-2">Provide a URL to generate an all-in-one script that fetches and parses the live website.</p></button>
                        <button onClick={() => setStaticSource('file')} className="p-6 border border-zinc-800 rounded-lg text-left bg-zinc-900/50 hover:border-white hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-white transition-all transform hover:scale-105"><h3 className="text-lg font-bold text-zinc-100">Extract from Local HTML Files</h3><p className="text-sm text-zinc-400 mt-2">For when you already have the HTML files and just need to extract data from them.</p></button>
                    </div>
                    <div className="mt-8"><button onClick={handleBack} className="w-full sm:w-auto bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Change Method</button></div>
                </div>
            );
        }

        if (staticSource === 'file') {
             switch (step) {
                case 1:
                  return (<div><h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step 1: Upload Local HTML Files</h2><p className="text-zinc-400 mb-4">Provide a project name and upload the HTML file(s) you want to extract data from.</p><div className="space-y-4">
                        <div><label htmlFor="project-name" className="block text-sm font-medium text-zinc-300">Project Folder Name</label><input id="project-name" type="text" value={projectName} onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} placeholder="e.g., my_html_data" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200 focus:ring-2 focus:ring-white" /><p className="text-xs text-zinc-500 mt-1">The final script will look for your HTML files in this folder.</p></div>
                        <div><label className="block text-sm font-medium text-zinc-300">HTML File(s)</label><p className="text-xs text-zinc-500 mt-1 mb-2">Upload the HTML file to be used for the preview. The final script will process ALL .html files in the project folder.</p><div className="mt-2 flex justify-center rounded-lg border border-dashed border-zinc-700 px-6 py-4"><div className="text-center"><div className="flex text-sm leading-6 text-zinc-400"><label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-white hover:text-zinc-300"><span>{htmlContents.length > 0 ? `Selected: ${htmlContents[0].name}` : 'Upload a file for preview'}</span><input id="file-upload" type="file" className="sr-only" accept=".html" onChange={handleFileChange} /></label></div></div></div></div>
                        {error && <p className="text-red-400 font-semibold text-sm mt-2">{error}</p>}
                        <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3"><button onClick={() => setStep(2)} disabled={htmlContents.length === 0} className="w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed transition-all">Next: Define Extractors</button><button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Back</button></div></div></div>);
                case 2: return renderExtractorUI(2);
                case 3: return (<div><h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step 3: Final Extractor Script</h2><p className="text-zinc-400 mb-4">Place your HTML files in a folder named <span className="font-mono bg-zinc-800 p-1 rounded">{projectName}</span>. Run this script in the same directory as that folder.</p><div className="mb-4"><label className="block text-sm font-medium mb-2 text-zinc-300">Output Format:</label><div className="flex items-center space-x-4">{(['csv', 'json', 'print'] as OutputFormat[]).map((format) => (<label key={format} className="flex items-center"><input type="radio" name="output-format" value={format} checked={outputFormat === format} onChange={() => setOutputFormat(format)} className="h-4 w-4 text-white bg-zinc-800 border-zinc-600 focus:ring-white" /><span className="ml-2 text-sm capitalize">{format === 'print' ? 'Print to Console' : format.toUpperCase()}</span></label>))}</div></div><div className="rounded-lg shadow-md overflow-hidden"><CodeBlock code={bsCode} /><AiCodeDebugger apiKey={apiKey} originalCode={bsCode} codeType="BeautifulSoup" /></div><div className="mt-4 flex flex-col sm:flex-row-reverse gap-3"><button onClick={handleStartOver} className="w-full bg-zinc-800 text-white font-semibold py-2 px-4 rounded-lg hover:bg-zinc-700 flex items-center justify-center gap-2 transition-colors"><ArrowPathIcon />Start Over</button><button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Back</button></div></div>);
                default: return <div>Invalid Step</div>;
            }
        }
        
        if (staticSource === 'url') {
            const extractorStep = useProxy ? 3 : 2;
            const finalStep = useProxy ? 4 : 3;
            
            if (step === 1) {
                return (
                    <div><h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step 1: Configure Static Scraper</h2><p className="text-zinc-400 mb-4">Provide the target URL and an HTML sample file for defining extractors.</p><div className="space-y-4">
                        <div><label htmlFor="project-name" className="block text-sm font-medium text-zinc-300">Project Folder Name</label><input id="project-name" type="text" value={projectName} onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} placeholder="e.g., my_static_scraper" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200 focus:ring-2 focus:ring-white" /><p className="text-xs text-zinc-500 mt-1">The folder where output files (CSV, JSON) will be saved.</p></div>
                        <div><label htmlFor="browser-select" className="block text-sm font-medium text-zinc-300">Browser User-Agent</label><select id="browser-select" value={browser} onChange={(e) => setBrowser(e.target.value as Browser)} className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200 focus:ring-2 focus:ring-white"><option value="chrome">Chrome (Recommended)</option><option value="firefox">Firefox</option><option value="edge">Microsoft Edge</option><option value="brave">Brave</option><option value="opera">Opera</option></select><p className="text-xs text-zinc-500 mt-1">This sets the User-Agent header for your requests to mimic a browser.</p></div>
                        <div><label htmlFor="delay-timer" className="block text-sm font-medium text-zinc-300">Delay Between Requests (milliseconds)</label><input id="delay-timer" type="number" value={delay} onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value, 10) || 0))} min="0" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200 focus:ring-2 focus:ring-white" /><p className="text-xs text-zinc-500 mt-1">A polite delay to avoid overwhelming the server (e.g., 2000ms = 2s).</p></div>
                        <div className="mt-4"><label className="flex items-center justify-between p-4 border rounded-lg cursor-pointer bg-zinc-900/50 border-zinc-800"><div><span className="font-semibold text-zinc-100">Use Proxies</span><span className="block text-sm mt-1 text-zinc-500">Route requests through a list of proxies.</span></div><div className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${useProxy ? 'bg-white' : 'bg-zinc-700'}`}><span className={`inline-block w-4 h-4 transform bg-black rounded-full transition-transform ${useProxy ? 'translate-x-6' : 'translate-x-1'}`} /><input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} className="absolute w-full h-full opacity-0 cursor-pointer" /></div></label></div>
                        <div><label className="block text-sm font-medium text-zinc-300 mb-2">Scraping Scope</label><fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${scrapingScope === 'single' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">Single Page</span><span className="text-sm text-zinc-400 mt-1">Scrape one URL.</span><input type="radio" name="scraping-scope" value="single" checked={scrapingScope === 'single'} onChange={() => setScrapingScope('single')} className="absolute h-full w-full opacity-0 cursor-pointer" /></label><label className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${scrapingScope === 'multi' ? 'border-white bg-zinc-900 ring-2 ring-white' : 'border-zinc-700 bg-transparent hover:bg-zinc-900'}`}><span className="font-semibold text-zinc-100">Multiple Pages</span><span className="text-sm text-zinc-400 mt-1">Scrape using a URL pattern.</span><input type="radio" name="scraping-scope" value="multi" checked={scrapingScope === 'multi'} onChange={() => { setScrapingScope('multi'); setMultiPageMode('url'); }} className="absolute h-full w-full opacity-0 cursor-pointer" /></label></fieldset></div>
                        {scrapingScope === 'multi' && (<div className="p-4 border border-zinc-800 bg-zinc-900/50 rounded-lg space-y-4"><div><label htmlFor="start-page" className="block text-sm font-medium text-zinc-300">Start Page Number</label><input id="start-page" type="number" value={startPage} onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200" /></div><div><label htmlFor="num-pages" className="block text-sm font-medium text-zinc-300">Total Pages to Scrape</label><input id="num-pages" type="number" value={numPages} onChange={(e) => setNumPages(Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" max="100" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200" /></div><div className="space-y-3"><div><label htmlFor="url-pattern-input" className="block text-sm font-medium text-zinc-300">Example URL (from page 2+)</label><div className="flex items-center gap-2 mt-1"><input id="url-pattern-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/products?page=2" className="flex-grow px-4 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200" /><button onClick={handleAutoDetectUrlPattern} disabled={autoDetectUrlLoading} className="px-3 py-2 bg-zinc-700 text-zinc-100 font-semibold rounded-md hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 flex items-center">{autoDetectUrlLoading ? 'Detecting...' : "✨ Auto-detect Pattern"}</button></div></div><div><label htmlFor="url-prefix" className="block text-sm font-medium text-zinc-300">URL Prefix</label><input id="url-prefix" type="text" value={urlPrefix} onChange={(e) => setUrlPrefix(e.target.value)} placeholder="https://example.com/page=" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200" /></div><div><label htmlFor="url-suffix" className="block text-sm font-medium text-zinc-300">URL Suffix (optional)</label><input id="url-suffix" type="text" value={urlSuffix} onChange={(e) => setUrlSuffix(e.target.value)} placeholder=".html" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200" /></div></div></div>)}
                        {scrapingScope === 'single' && (<div><label htmlFor="url-input" className="block text-sm font-medium text-zinc-300">Website URL</label><input id="url-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="mt-1 w-full px-4 py-2 border border-zinc-700 rounded-md bg-zinc-900 text-zinc-200" /></div>)}
                        <div><label className="block text-sm font-medium text-zinc-300">Sample HTML File</label><p className="text-xs text-zinc-500 mt-1 mb-2">Upload an HTML file from the target site. This will be used as a preview to define your extractors.</p><div className="mt-2 flex justify-center rounded-lg border border-dashed border-zinc-700 px-6 py-4"><div className="text-center"><div className="flex text-sm leading-6 text-zinc-400"><label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-white hover:text-zinc-300"><span>{htmlContents.length > 0 ? `Selected: ${htmlContents[0].name}` : 'Upload a file'}</span><input id="file-upload" type="file" className="sr-only" accept=".html" onChange={handleFileChange} /></label></div></div></div></div>
                        {error && <p className="text-red-400 font-semibold text-sm mt-2">{error}</p>}
                        <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3"><button onClick={handleNextFromStaticUrlConfig} className="w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 transition-all">Continue</button><button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Change Method</button></div></div></div>
                );
            } else if (useProxy && step === 2) {
                return (<div><h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step 2: Configure Proxies</h2><p className="text-zinc-400 mb-4">Provide your list of proxies, one per line. Format: `ip:port`</p><div className="space-y-4"><div><label htmlFor="proxy-list" className="block text-sm font-medium text-zinc-300">Proxy List</label><textarea id="proxy-list" rows={8} value={proxyList} onChange={(e) => setProxyList(e.target.value)} placeholder="192.168.1.1:8080&#10;192.168.1.2:8080" className="mt-1 w-full px-3 py-2 border border-zinc-700 rounded-md font-mono text-sm bg-zinc-900 text-zinc-200" /></div><div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-700" /></div><div className="relative flex justify-center"><span className="bg-black/60 px-2 text-sm text-zinc-500">Or</span></div></div><label htmlFor="proxy-file-upload" className="relative cursor-pointer rounded-lg bg-transparent font-semibold text-zinc-200 focus-within:outline-none hover:text-white text-center block border border-dashed border-zinc-700 py-4 hover:border-zinc-500"><span>Upload a .txt file</span><input id="proxy-file-upload" type="file" className="sr-only" accept=".txt" onChange={handleProxyFileChange} /></label>{error && <p className="text-red-400 font-semibold text-sm mt-2">{error}</p>}</div><div className="mt-6 flex flex-col sm:flex-row gap-3"><button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Back</button><button onClick={() => { if (useProxy && !proxyList.trim()) { setError('Please provide a list of proxies or disable the proxy option.'); return; } setError(''); setStep(3); }} className="w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 transition-all">Next: Define Extractors</button></div></div>);
            } else if (step === extractorStep) {
                return renderExtractorUI(extractorStep);
            } else if (step === finalStep) {
                return (<div><h2 className="text-2xl font-semibold text-zinc-100 mb-2">Step {finalStep}: Final Scraper Script</h2><p className="text-zinc-400 mb-4">Run this all-in-one script locally to fetch data from the URL(s) and save the results.</p><div className="mb-4"><label className="block text-sm font-medium mb-2 text-zinc-300">Output Format:</label><div className="flex items-center space-x-4">{(['csv', 'json', 'print'] as OutputFormat[]).map((format) => (<label key={format} className="flex items-center"><input type="radio" name="output-format" value={format} checked={outputFormat === format} onChange={() => setOutputFormat(format)} className="h-4 w-4 text-white bg-zinc-800 border-zinc-600 focus:ring-white" /><span className="ml-2 text-sm capitalize">{format === 'print' ? 'Print to Console' : format.toUpperCase()}</span></label>))}</div></div><div className="rounded-lg shadow-md overflow-hidden"><CodeBlock code={bsCode} /><AiCodeDebugger apiKey={apiKey} originalCode={bsCode} codeType="BeautifulSoup" /></div><div className="mt-4 flex flex-col sm:flex-row-reverse gap-3"><button onClick={handleStartOver} className="w-full bg-zinc-800 text-white font-semibold py-2 px-4 rounded-lg hover:bg-zinc-700 flex items-center justify-center gap-2 transition-colors"><ArrowPathIcon />Start Over</button><button onClick={handleBack} className="w-full bg-transparent border border-zinc-600 text-zinc-300 font-semibold py-2 px-4 rounded-lg hover:bg-zinc-800 transition-colors">Back</button></div></div>);
            } else {
                 return <div>Invalid Step</div>;
            }
        }
    }
  };
  
  const renderAdvisor = () => (
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-zinc-100">AI Method Advisor</h1>
        <p className="text-zinc-400 mt-2">Enter your target URL and let AI recommend the best scraping method for you.</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <input 
                type="url" 
                value={analysisUrl}
                onChange={(e) => setAnalysisUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-grow w-full px-4 py-2 border border-zinc-700 rounded-lg bg-zinc-900 text-zinc-200 placeholder-zinc-500"
                disabled={analysisLoading}
            />
            <button 
                onClick={handleAnalyzeUrl} 
                className="w-full sm:w-auto bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 disabled:bg-zinc-600 disabled:text-zinc-400 flex items-center justify-center transition-all transform hover:scale-105"
                disabled={analysisLoading}
            >
                {analysisLoading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Analyzing...
                    </>
                ) : "Analyze URL"}
            </button>
        </div>
        
        {error && <p className="text-red-400 font-semibold text-sm mt-4">{error}</p>}
        
        {analysisResult && (
            <div className="mt-8 text-left p-6 bg-zinc-900/70 border border-zinc-800 rounded-lg animate-fade-in">
                <h3 className="text-lg font-semibold text-zinc-100">AI Recommendation</h3>
                <div className={`mt-2 font-bold text-xl text-white`}>
                    {analysisResult.recommendation === 'dynamic' ? 'Dynamic Scraping (Selenium)' : 'Static Scraping (BeautifulSoup)'}
                </div>
                <p className="mt-2 text-zinc-300">{analysisResult.reason}</p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <button onClick={handleProceedWithRecommendation} className="w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 transition-all">
                        Proceed with Recommendation
                    </button>
                    <button onClick={() => setCurrentView('app')} className="w-full bg-transparent text-zinc-300 font-semibold py-2 px-4 rounded-lg border border-zinc-600 hover:bg-zinc-800 transition-colors">
                        Choose Manually Instead
                    </button>
                </div>
            </div>
        )}
        
        <div className="mt-8">
            <button onClick={() => setCurrentView('app')} className="text-white hover:underline text-sm font-semibold">
                or, skip and choose method manually &rarr;
            </button>
        </div>
      </div>
  );


  if (currentView === 'apiKey') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <MouseTrailer />
        <div className="w-full max-w-md">
          <div className="bg-black/80 backdrop-blur-sm rounded-xl shadow-lg p-8 border border-zinc-800">
            <h1 className="text-2xl font-bold text-zinc-100 text-center">Welcome to the Dynamic Web Scraper Generator</h1>
            <p className="text-zinc-400 mt-2 text-center">To use the AI-powered features, please enter your Google AI API Key.</p>
            <div className="mt-6">
              <label htmlFor="api-key-input" className="block text-sm font-medium text-zinc-300">Google AI API Key</label>
              <input id="api-key-input" type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="Enter your API key here" className="mt-1 w-full px-4 py-2 border border-zinc-700 rounded-lg bg-zinc-900 text-zinc-200" />
            </div>
            {error && <p className="text-red-400 font-semibold text-sm mt-2">{error}</p>}
            <button onClick={handleApiKeySubmit} className="mt-6 w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 transition-colors">Continue</button>
            <p className="text-xs text-zinc-500 mt-4 text-center">Get a key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">Google AI Studio</a>.</p>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'advisor') {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <MouseTrailer />
          {renderAdvisor()}
        </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 bg-black">
      <MouseTrailer />
      <div className="w-full max-w-6xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-zinc-100">Dynamic Web Scraper Generator</h1>
          <p className="text-lg text-zinc-400 mt-2">Generate web scraping scripts in a few easy steps.</p>
        </header>
        {scrapingType && (
          <div className="mb-12 flex justify-center">
            <StepIndicator currentStep={step} steps={steps} />
          </div>
        )}
        <main className="bg-black/80 backdrop-blur-sm rounded-xl shadow-lg p-6 md:p-8 border border-zinc-800">
          {renderAppContent()}
        </main>
      </div>
    </div>
  );
};

export default App;