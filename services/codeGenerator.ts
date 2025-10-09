import { type Extractor, type LinkExtractionStrategy } from '../types';

interface GenerateDynamicCodeParams {
  url: string;
  projectName: string;
  scrapingScope: 'single' | 'multi';
  multiPageMode: 'button' | 'url';
  startPage: number;
  numPages: number;
  nextPageSelector: string;
  browser: 'chrome' | 'firefox' | 'edge' | 'brave' | 'opera';
  delay: number;
  urlPrefix?: string;
  urlSuffix?: string;
  proxyList?: string;
}

export interface GenerateBsCodeParams {
    projectName: string;
    scrapingMode: 'structured' | 'simple' | 'links';
    container: Omit<Extractor, 'id' | 'name'>;
    extractors: Extractor[];
    outputFormat: 'csv' | 'json' | 'print';
    source: 'live-url' | 'local-files';
    // --- Optional params for links mode ---
    linkExtractionStrategy?: LinkExtractionStrategy;
    linkContainer?: Omit<Extractor, 'id' | 'name'>;
    linkSelector?: Omit<Extractor, 'id' | 'name'>;
    // --- Optional params for live-url source ---
    url?: string;
    urlPrefix?: string;
    urlSuffix?: string;
    proxyList?: string;
    delay?: number;
    browser?: 'chrome' | 'firefox' | 'edge' | 'brave' | 'opera';
}


const getDriverSetupCode = (browser: GenerateDynamicCodeParams['browser'], proxyListCleaned: string): string => {
  const hasProxy = !!proxyListCleaned;
  let imports = new Set<string>();
  let setupCode = '';

  const proxySetup = `# --- Proxy Configuration ---
proxies = [
    "${proxyListCleaned.split('\n').join('",\n    "')}"
]
chosen_proxy = random.choice(proxies)
print(f"Using proxy: {chosen_proxy}")`;

  if (browser === 'firefox') {
    imports.add('from selenium.webdriver.firefox.service import Service as FirefoxService');
    imports.add('from webdriver_manager.firefox import GeckoDriverManager');
    if (hasProxy) {
      imports.add('import random');
      imports.add('from selenium.webdriver.common.proxy import Proxy, ProxyType');
      setupCode = `${proxySetup}
proxy = Proxy({
    'proxyType': ProxyType.MANUAL,
    'httpProxy': chosen_proxy,
    'sslProxy': chosen_proxy,
})
options = webdriver.FirefoxOptions()
options.proxy = proxy
driver = webdriver.Firefox(service=FirefoxService(GeckoDriverManager().install()), options=options)`;
    } else {
      setupCode = 'driver = webdriver.Firefox(service=FirefoxService(GeckoDriverManager().install()))';
    }
  } else if (browser === 'edge') {
    imports.add('from selenium.webdriver.edge.service import Service as EdgeService');
    imports.add('from webdriver_manager.microsoft import EdgeChromiumDriverManager');
    if (hasProxy) {
      imports.add('import random');
      setupCode = `${proxySetup}
options = webdriver.EdgeOptions()
options.add_argument(f'--proxy-server={chosen_proxy}')
driver = webdriver.Edge(service=EdgeService(EdgeChromiumDriverManager().install()), options=options)`;
    } else {
      setupCode = 'driver = webdriver.Edge(service=EdgeService(EdgeChromiumDriverManager().install()))';
    }
  } else { // Chrome, Brave, Opera
    imports.add('from selenium.webdriver.chrome.service import Service as ChromeService');
    imports.add('from webdriver_manager.chrome import ChromeDriverManager');
    
    let optionsLines = '';
    if (hasProxy) {
      imports.add('import random');
      optionsLines += `${proxySetup}
options = webdriver.ChromeOptions()
options.add_argument(f'--proxy-server={chosen_proxy}')`;
    } else {
      optionsLines = 'options = webdriver.ChromeOptions()';
    }

    if (browser === 'brave') {
      optionsLines += '\\n# For Brave, you might need to specify the binary location if it is not found automatically\\n# options.binary_location = "/path/to/brave"';
    } else if (browser === 'opera') {
      optionsLines += '\\n# For Opera, you might need to specify the binary location if it is not found automatically\\n# options.binary_location = "/path/to/opera"';
    }

    setupCode = `${optionsLines}
driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)`;
  }

  const browserName = browser.charAt(0).toUpperCase() + browser.slice(1);
  const indentedSetupCode = setupCode.trim().split('\n').map(line => `    ${line}`).join('\n');

  return `${Array.from(imports).join('\n')}

try:
${indentedSetupCode}
except Exception as e:
    print(f"Error setting up ${browserName} Driver: {e}")
    print("Please ensure ${browserName} is installed on your system.")
    exit()`;
};


export const generateSeleniumCode = (params: GenerateDynamicCodeParams): string => {
  const { url, projectName, scrapingScope, multiPageMode, startPage, numPages, nextPageSelector, urlPrefix, urlSuffix, proxyList, browser, delay } = params;
  
  const proxyListCleaned = proxyList?.trim() || '';
  const driverSetup = getDriverSetupCode(browser, proxyListCleaned);
  const delayInSeconds = delay / 1000;

  const commonSetup = `import time
import os
from selenium import webdriver
${driverSetup}

# --- Configuration ---
# The folder where all files will be saved
folder_name = "${projectName}"
# Time to wait for pages to load, in seconds. Increase for slower websites.
ACTION_DELAY = ${delayInSeconds}

# --- Script ---
os.makedirs(folder_name, exist_ok=True)
`;

  if (scrapingScope === 'single') {
    return `${commonSetup}
# The URL to scrape
url = "${url}"

print(f"Opening URL: {url}")
driver.get(url)

# Wait for the page to load dynamically.
print(f"Waiting for page to load ({ACTION_DELAY} seconds)...")
time.sleep(ACTION_DELAY)

# Save the page source to an HTML file
file_name = os.path.join(folder_name, "dataset.html")
try:
    with open(file_name, "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print(f"Successfully saved page HTML to '{file_name}'")
except Exception as e:
    print(f"Error saving file: {e}")

# Clean up and close the browser
driver.quit()
print("Browser closed.")
`;
  }

  // Multi-page logic
  if (multiPageMode === 'button') {
    return `from selenium.webdriver.common.by import By
${commonSetup}
# The URL to start scraping from
url = "${url}"

print(f"Opening URL: {url}")
driver.get(url)

start_page = ${startPage}
pages_to_scrape = ${numPages}
end_page = start_page + pages_to_scrape
next_button_selector = "${nextPageSelector.replace(/"/g, '\\"')}"

print(f"\\nStarting scrape of {pages_to_scrape} pages by clicking the 'next' button...")

# This loop will scrape the current page, then click 'next', repeating 'pages_to_scrape' times.
for i in range(pages_to_scrape):
    page_num = start_page + i
    print(f"\\nProcessing page {page_num}...")
    # Wait for the page to load dynamically.
    print(f"Waiting for page to load ({ACTION_DELAY} seconds)...")
    time.sleep(ACTION_DELAY)
    
    # Save the page source to an HTML file
    file_name = os.path.join(folder_name, f"dataset_{page_num}.html")
    try:
        with open(file_name, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print(f"Successfully saved page HTML to '{file_name}'")
    except Exception as e:
        print(f"Error saving file '{file_name}': {e}")

    # If this is the last page to scrape, don't look for a next button
    if i == pages_to_scrape - 1:
        print("\\nReached target number of pages.")
        break
        
    # Find and click the next page button
    try:
        next_button = driver.find_element(By.CSS_SELECTOR, next_button_selector)
        print("Found next page button, clicking...")
        next_button.click()
    except Exception as e:
        print("Could not find or click the next page button. Ending scrape.")
        # Uncomment the line below for more details on the error
        # print(f"Reason: {e}")
        break

# Clean up and close the browser
driver.quit()
print("\\nScraping finished. Browser closed.")
`;
  } else { // URL Pattern mode
    return `${commonSetup}
# The URL pattern for the pages to scrape.
# The script will construct the final URL using this prefix and suffix.
url_prefix = "${(urlPrefix || '').replace(/"/g, '\\"')}"
url_suffix = "${(urlSuffix || '').replace(/"/g, '\\"')}"

start_page = ${startPage}
pages_to_scrape = ${numPages}
end_page = start_page + pages_to_scrape

print(f"\\nStarting scrape of {pages_to_scrape} pages using URL pattern...")
print(f"Range: page {start_page} to {end_page - 1}")

for page_num in range(start_page, end_page):
    # Construct the URL for the current page
    current_url = f"{url_prefix}{page_num}{url_suffix}"
    print(f"\\nProcessing page {page_num}: {current_url}")

    try:
        driver.get(current_url)
    except Exception as e:
        print(f"    Error opening URL {current_url}: {e}")
        continue # Skip to the next page if URL fails

    # Wait for the page to load dynamically.
    print(f"Waiting for page to load ({ACTION_DELAY} seconds)...")
    time.sleep(ACTION_DELAY)
    
    # Save the page source to an HTML file
    file_name = os.path.join(folder_name, f"dataset_{page_num}.html")
    try:
        with open(file_name, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print(f"Successfully saved page HTML to '{file_name}'")
    except Exception as e:
        print(f"Error saving file '{file_name}': {e}")

# Clean up and close the browser
driver.quit()
print("\\nScraping finished. Browser closed.")
`;
  }
};

export const generatePlaywrightCode = (params: GenerateDynamicCodeParams): string => {
  const { url, projectName, scrapingScope, multiPageMode, startPage, numPages, nextPageSelector, urlPrefix, urlSuffix, proxyList, browser, delay } = params;

  const proxyListCleaned = proxyList?.trim() || '';
  const delayInMilliseconds = delay;

  const browserMap: { [key in GenerateDynamicCodeParams['browser']]: string } = {
      'chrome': 'chromium',
      'firefox': 'firefox',
      'edge': 'chromium',
      'brave': 'chromium',
      'opera': 'chromium',
  };
  const playwrightBrowser = browserMap[browser] || 'chromium';

  const commonSetup = `import time
import os
import random
from playwright.sync_api import sync_playwright

# --- Setup Instructions ---
# 1. Make sure you have Python installed.
# 2. Install required libraries:
#    pip install playwright
# 3. Install Playwright's browser binaries:
#    playwright install

# --- Configuration ---
# The folder where all files will be saved
folder_name = "${projectName}"
# Time to wait for pages to load, in milliseconds. Increase for slower websites.
ACTION_DELAY = ${delayInMilliseconds}

# --- Script ---
os.makedirs(folder_name, exist_ok=True)
`;

  const proxySetup = proxyListCleaned ? `
proxies = [
    "${proxyListCleaned.split('\n').join('",\n    "')}"
]
chosen_proxy = random.choice(proxies)
print(f"Using proxy: {chosen_proxy}")
launch_options['proxy'] = { "server": f"http://{chosen_proxy}" }
` : '';

  const mainLogic = (isSingle: boolean): string => `
with sync_playwright() as p:
    launch_options = {"headless": False}
    ${proxySetup}
    
    try:
        browser_instance = p.${playwrightBrowser}.launch(**launch_options)
    except Exception as e:
        print(f"Error launching ${playwrightBrowser} with Playwright: {e}")
        print("Please ensure you have run 'playwright install'.")
        exit()

    page = browser_instance.new_page()
    ${ isSingle ? `
    # The URL to scrape
    url = "${url}"

    print(f"Opening URL: {url}")
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
    except Exception as e:
        print(f"Error navigating to {url}: {e}")
        browser_instance.close()
        exit()

    # Wait for the page to load dynamically.
    print(f"Waiting for page to load ({ACTION_DELAY}ms)...")
    page.wait_for_timeout(ACTION_DELAY)

    # Save the page source to an HTML file
    file_name = os.path.join(folder_name, "dataset.html")
    try:
        with open(file_name, "w", encoding="utf-8") as f:
            f.write(page.content())
        print(f"Successfully saved page HTML to '{file_name}'")
    except Exception as e:
        print(f"Error saving file: {e}")
    ` : (multiPageMode === 'button' ? `
    # The URL to start scraping from
    url = "${url}"

    print(f"Opening URL: {url}")
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
    except Exception as e:
        print(f"Error navigating to {url}: {e}")
        browser_instance.close()
        exit()

    start_page = ${startPage}
    pages_to_scrape = ${numPages}
    next_button_selector = "${nextPageSelector.replace(/"/g, '\\"')}"

    print(f"\\nStarting scrape of {pages_to_scrape} pages by clicking the 'next' button...")

    for i in range(pages_to_scrape):
        page_num = start_page + i
        print(f"\\nProcessing page {page_num}...")
        # Wait for the page to load dynamically.
        print(f"Waiting for page to load ({ACTION_DELAY}ms)...")
        page.wait_for_timeout(ACTION_DELAY)
        
        # Save the page source to an HTML file
        file_name = os.path.join(folder_name, f"dataset_{page_num}.html")
        try:
            with open(file_name, "w", encoding="utf-8") as f:
                f.write(page.content())
            print(f"Successfully saved page HTML to '{file_name}'")
        except Exception as e:
            print(f"Error saving file '{file_name}': {e}")

        if i == pages_to_scrape - 1:
            print("\\nReached target number of pages.")
            break
            
        try:
            print("Found next page button, clicking...")
            page.locator(next_button_selector).click()
        except Exception as e:
            print("Could not find or click the next page button. Ending scrape.")
            # print(f"Reason: {e}") # Uncomment for details
            break
    ` : `
    # The URL pattern for the pages to scrape.
    url_prefix = "${(urlPrefix || '').replace(/"/g, '\\"')}"
    url_suffix = "${(urlSuffix || '').replace(/"/g, '\\"')}"

    start_page = ${startPage}
    pages_to_scrape = ${numPages}
    end_page = start_page + pages_to_scrape

    print(f"\\nStarting scrape of {pages_to_scrape} pages using URL pattern...")
    print(f"Range: page {start_page} to {end_page - 1}")

    for page_num in range(start_page, end_page):
        current_url = f"{url_prefix}{page_num}{url_suffix}"
        print(f"\\nProcessing page {page_num}: {current_url}")

        try:
            page.goto(current_url, wait_until="domcontentloaded", timeout=60000)
        except Exception as e:
            print(f"    Error opening URL {current_url}: {e}")
            continue

        print(f"Waiting for page to load ({ACTION_DELAY}ms)...")
        page.wait_for_timeout(ACTION_DELAY)
        
        file_name = os.path.join(folder_name, f"dataset_{page_num}.html")
        try:
            with open(file_name, "w", encoding="utf-8") as f:
                f.write(page.content())
            print(f"Successfully saved page HTML to '{file_name}'")
        except Exception as e:
            print(f"Error saving file '{file_name}': {e}")
    `)}
    # Clean up and close the browser
    browser_instance.close()
    print("\\nScraping finished. Browser closed.")
`;
  return commonSetup + mainLogic(scrapingScope === 'single');
};


const convertToCssSelector = (tag: string, attrs: string): string => {
    let selector = tag.trim();
    if (!attrs.trim()) return selector;

    const attrsRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
    let match;

    try {
        while ((match = attrsRegex.exec(attrs)) !== null) {
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
        console.error("Error creating selector from attributes:", attrs, e);
        return tag.trim(); // Fallback to just the tag on error
    }
};

const getStructuredExtractionLogic = (container: Omit<Extractor, 'id' | 'name'>, extractors: Extractor[]): string => {
    const containerSelector = convertToCssSelector(container.tag, container.attrs).replace(/"/g, '\\"');
    return `    # Find all the container elements
    container_selector = "${containerSelector}"
    containers = soup.select(container_selector)
    print(f"    Found {len(containers)} containers for this URL.")

    # Extract data from each container
    for c in containers:
        item = {}
${extractors.map(e => {
    const fieldSelector = convertToCssSelector(e.tag, e.attrs).replace(/"/g, '\\"');
    return `        field_element = c.select_one("${fieldSelector}")
        item['${e.name}'] = field_element.get_text(strip=True) if field_element else None`
}).join('\n')}
        all_data.append(item)`;
};

const getSimpleExtractionLogic = (extractor: Extractor): string => {
    const selector = convertToCssSelector(extractor.tag, extractor.attrs).replace(/"/g, '\\"');
    return `    # Find all matching elements on the page
    selector = "${selector}"
    elements = soup.select(selector)
    print(f"    Found {len(elements)} matching elements for this URL.")

    # Extract the text content from each element
    for el in elements:
        all_data.append(el.get_text(strip=True))`;
};

const getLinkExtractionLogic = (strategy: LinkExtractionStrategy = 'all', linkContainer: Omit<Extractor, 'id' | 'name'> = {tag: '', attrs: ''}, linkSelector: Omit<Extractor, 'id' | 'name'> = {tag: 'a', attrs: ''}, resolveUrl: boolean): string => {
    const resolveLogic = `        # Resolve relative URLs to absolute URLs
        href = link.get('href')
        if href:
            try:
                absolute_href = urljoin(base_url, href)
                item['href'] = absolute_href
            except:
                item['href'] = href # Fallback for malformed URLs`;
    
    const noResolveLogic = `        # Get the href attribute
        item['href'] = link.get('href')`;

    const finalResolveLogic = resolveUrl ? resolveLogic : noResolveLogic;

    if (strategy === 'container') {
        const containerSelector = convertToCssSelector(linkContainer.tag, linkContainer.attrs).replace(/"/g, '\\"');
        const finalLinkSelector = convertToCssSelector(linkSelector.tag, linkSelector.attrs).replace(/"/g, '\\"');
        return `    # Find all the card/container elements
    container_selector = "${containerSelector}"
    containers = soup.select(container_selector)
    print(f"    Found {len(containers)} containers in this file.")

    # Extract a link from each container
    for c in containers:
        link = c.select_one("${finalLinkSelector}")
        if not link:
            continue
        
        item = {
            'text': link.get_text(strip=True),
        }
${finalResolveLogic}
        if item.get('href'): # Only append if a link was actually found
            all_data.append(item)`;
    }

    // Default 'all' strategy
    return `    # Find all hyperlink elements
    links = soup.find_all('a', href=True)
    print(f"    Found {len(links)} links in this file.")

    # Extract text and href from each link
    for link in links:
        item = {
            'text': link.get_text(strip=True),
        }
${finalResolveLogic}
        if item.get('href'): # Only append if a link was actually found
            all_data.append(item)`;
};


const getOutputLogic = (scrapingMode: GenerateBsCodeParams['scrapingMode'], outputFormat: GenerateBsCodeParams['outputFormat'], extractorName: string, projectName: string): string => {
    const dataListName = 'all_data';
    const isLinksMode = scrapingMode === 'links';
    const csvFileName = isLinksMode ? 'links.csv' : 'output.csv';
    const jsonFileName = isLinksMode ? 'links.json' : 'output.json';

    const structuredCsv = `# --- Save data to CSV ---
if ${dataListName}:
    csv_file_name = os.path.join(folder_name, "${csvFileName}")
    print(f"\\nSaving {len(${dataListName})} items to {csv_file_name}...")
    try:
        with open(csv_file_name, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=${dataListName}[0].keys())
            writer.writeheader()
            writer.writerows(${dataListName})
        print("Data successfully saved to CSV.")
    except Exception as e:
        print(f"Error saving to CSV: {e}")
else:
    print("\\nNo data extracted to save.")`;

    const structuredJson = `# --- Save data to JSON ---
if ${dataListName}:
    json_file_name = os.path.join(folder_name, "${jsonFileName}")
    print(f"\\nSaving {len(${dataListName})} items to {json_file_name}...")
    try:
        with open(json_file_name, 'w', encoding='utf-8') as jsonfile:
            json.dump(${dataListName}, jsonfile, indent=4)
        print("Data successfully saved to JSON.")
    except Exception as e:
        print(f"Error saving to JSON: {e}")
else:
    print("\\nNo data extracted to save.")`;
    
    const simpleCsv = `# --- Save data to CSV ---
if ${dataListName}:
    csv_file_name = os.path.join(folder_name, "output.csv")
    print(f"\\nSaving {len(${dataListName})} items to {csv_file_name}...")
    try:
        with open(csv_file_name, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['${extractorName}'])  # Header
            for item in ${dataListName}:
                writer.writerow([item])
        print("Data successfully saved to CSV.")
    except Exception as e:
        print(f"Error saving to CSV: {e}")
else:
    print("\\nNo data extracted to save.")`;

    const simpleJson = `# --- Save data to JSON ---
if ${dataListName}:
    json_file_name = os.path.join(folder_name, "output.json")
    print(f"\\nSaving {len(${dataListName})} items to {json_file_name}...")
    try:
        # Saving as a list of strings under a single key
        output_json = {'${extractorName}': ${dataListName}}
        with open(json_file_name, 'w', encoding='utf-8') as jsonfile:
            json.dump(output_json, jsonfile, indent=4)
        print("Data successfully saved to JSON.")
    except Exception as e:
        print(f"Error saving to JSON: {e}")
else:
    print("\\nNo data extracted to save.")`;

    const printOutput = `# --- Print Extracted Data ---
print("\\n--- Extracted Data ---")
if not ${dataListName}:
    print("No data was extracted.")
else:
    for item in ${dataListName}:
        print(item)`;

    if (scrapingMode === 'structured' || scrapingMode === 'links') {
        if (outputFormat === 'csv') return structuredCsv;
        if (outputFormat === 'json') return structuredJson;
        return printOutput;
    } else { // simple
        if (outputFormat === 'csv') return simpleCsv;
        if (outputFormat === 'json') return simpleJson;
        return printOutput;
    }
};

export const generateBeautifulSoupCode = (params: GenerateBsCodeParams): string => {
    const { 
        projectName, scrapingMode, container, extractors, outputFormat, source, 
        url, urlPrefix, urlSuffix, proxyList, delay, browser,
        linkExtractionStrategy, linkContainer, linkSelector 
    } = params;
  
    if (
        (scrapingMode === 'structured' && (!container.tag || extractors.length === 0)) || 
        (scrapingMode === 'simple' && !extractors[0]?.tag) ||
        (scrapingMode === 'links' && linkExtractionStrategy === 'container' && !linkContainer?.tag)
    ) {
        return `# Please complete the definitions in the 'Define Extractors' step to generate the script.
# - For 'Structured Data', define a container and at least one field.
# - For 'Simple List', define the single field you want to extract.
# - For 'Links from Cards', define the Card Container.`;
    }

    let extractionLogic: string;
    if (scrapingMode === 'structured') {
        extractionLogic = getStructuredExtractionLogic(container, extractors);
    } else if (scrapingMode === 'simple') {
        extractionLogic = getSimpleExtractionLogic(extractors[0]);
    } else { // links mode
        const resolveUrls = source === 'live-url' || (source === 'local-files' && (!!url || !!urlPrefix));
        extractionLogic = getLinkExtractionLogic(linkExtractionStrategy, linkContainer, linkSelector, resolveUrls);
    }
        
    const outputLogic = getOutputLogic(
        scrapingMode, 
        outputFormat, 
        extractors[0]?.name || '', 
        projectName
    );
    
    // --- STATIC: LIVE URL SCRAPING ---
    if (source === 'live-url') {
        const proxyListCleaned = proxyList?.trim() || '';
        const imports = new Set<string>(['from bs4 import BeautifulSoup', 'import os', 'import requests', 'import time']);
        if (outputFormat === 'csv') imports.add('import csv');
        if (outputFormat === 'json') imports.add('import json');
        if (proxyListCleaned) imports.add('import random');
        if (scrapingMode === 'links') {
            imports.add('from urllib.parse import urljoin');
        }

        let urlListLogic: string;
        // Determine if it's single or multi-page based on whether urlPrefix is provided
        if (urlPrefix) {
             urlListLogic = `urls = []
url_prefix = "${urlPrefix.replace(/"/g, '\\"')}"
url_suffix = "${urlSuffix.replace(/"/g, '\\"')}"
# Note: You may need to adjust start_page and end_page based on your static config
start_page = 1 
end_page = start_page + 5 
for page_num in range(start_page, end_page):
    urls.append(f"{url_prefix}{page_num}{url_suffix}")`;
        } else {
             urlListLogic = `urls = ["${url}"]`;
        }

        const proxySetup = proxyListCleaned ? `proxies = ["${proxyListCleaned.split('\n').join('", "')}"]` : 'proxies = []';
        
        return `${Array.from(imports).join('\n')}

# --- Setup Instructions ---
# 1. Make sure you have Python installed.
# 2. Install required libraries:
#    pip install beautifulsoup4 requests

# --- Configuration ---
folder_name = "${projectName}"
# Time to wait between requests, in seconds. Be respectful of the website's servers.
REQUEST_DELAY = ${delay ? delay / 1000 : 2}
# A list to hold all data from all pages
all_data = []
# Browser user-agents to mimic a real browser visit
USER_AGENTS = {
    "chrome": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "firefox": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "edge": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.48",
    "brave": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "opera": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 OPR/77.0.4054.90",
}
# Your chosen browser user-agent
headers = {'User-Agent': USER_AGENTS.get("${browser || 'chrome'}", USER_AGENTS["chrome"])}
${proxySetup}

# --- Script ---
os.makedirs(folder_name, exist_ok=True)
${urlListLogic}

print(f"Starting to scrape {len(urls)} URL(s)...")
for url in urls:
    print(f"  - Scraping: {url}")
    base_url = url
    
    proxy_to_use = {}
    if proxies:
        chosen_proxy = random.choice(proxies)
        proxy_to_use = {"http": f"http://{chosen_proxy}", "https": f"http://{chosen_proxy}"}
        print(f"    Using proxy: {chosen_proxy}")

    try:
        response = requests.get(url, headers=headers, proxies=proxy_to_use, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"    Error fetching URL {url}: {e}")
        time.sleep(REQUEST_DELAY) # Wait before the next attempt
        continue

    soup = BeautifulSoup(response.text, "html.parser")

${extractionLogic}
    
    print(f"    Waiting {REQUEST_DELAY} seconds before next request...")
    time.sleep(REQUEST_DELAY)

# --- Final Output ---
${outputLogic}
`;
    }

    // --- DYNAMIC or STATIC FROM FILE: LOCAL FILE PROCESSING ---
    const imports = new Set<string>(['from bs4 import BeautifulSoup', 'import os']);
    if (outputFormat === 'csv') imports.add('import csv');
    if (outputFormat === 'json') imports.add('import json');
    
    const shouldResolveForLocal = scrapingMode === 'links' && (source === 'local-files' && (!!url || !!urlPrefix));
    if (shouldResolveForLocal) {
        imports.add('from urllib.parse import urljoin');
    }

    const baseUrlForFiles = url || urlPrefix;
    const baseUrlDeclaration = (shouldResolveForLocal && baseUrlForFiles) ? `base_url = "${baseUrlForFiles}"` : `base_url = ''`;

    const localFilesHeader = scrapingMode === 'links'
        ? (shouldResolveForLocal && baseUrlForFiles)
            ? `# Using base URL: ${baseUrlForFiles} to resolve relative links.`
            : `# Note: A base URL was not provided. Relative links (e.g., '/page2.html') will not be resolved to absolute URLs.`
        : '';

    return `${Array.from(imports).join('\n')}
${localFilesHeader}
# --- Setup Instructions ---
# 1. Make sure you have Python installed.
# 2. Install required libraries:
#    pip install beautifulsoup4
# 3. Place this script in the SAME directory as the '${projectName}' folder.

# --- Script ---
# The folder where HTML files are located and output will be saved
folder_name = "${projectName}"
all_data = []  # A list to hold all data from all files
${baseUrlDeclaration}

# Find all HTML files in the folder
try:
    file_names = [f for f in os.listdir(folder_name) if f.endswith('.html')]
    if not file_names:
        print(f"Error: No .html files found in the '{folder_name}' directory.")
        exit()
except FileNotFoundError:
    print(f"Error: The directory '{folder_name}' does not exist. Make sure it's in the same location as this script.")
    exit()

print(f"Processing {len(file_names)} file(s) from the '{folder_name}' folder...")
for file_name in file_names:
    file_path = os.path.join(folder_name, file_name)
    print(f"  - Reading {file_path}")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            html_content = f.read()
    except Exception as e:
        print(f"    Error reading file '{file_path}': {e}")
        continue  # Skip to the next file

    soup = BeautifulSoup(html_content, "html.parser")
    
${extractionLogic.replace('this URL', 'this file')}

# --- Final Output ---
${outputLogic}
`;
};