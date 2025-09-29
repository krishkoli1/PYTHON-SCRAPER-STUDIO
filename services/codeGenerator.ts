import { type Extractor, type OutputFormat, type ScrapingMode, type ScrapingScope, type MultiPageMode } from '../types';

interface GenerateSeleniumCodeParams {
  url: string;
  projectName: string;
  scrapingScope: ScrapingScope;
  multiPageMode: MultiPageMode;
  startPage: number;
  numPages: number;
  nextPageSelector: string;
  urlPrefix?: string;
  urlSuffix?: string;
}

export const generateSeleniumCode = ({ url, projectName, scrapingScope, multiPageMode, startPage, numPages, nextPageSelector, urlPrefix, urlSuffix }: GenerateSeleniumCodeParams): string => {
  const commonSetup = `from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import os

# --- Setup Instructions ---
# 1. Make sure you have Python installed.
# 2. Install required libraries:
#    pip install selenium webdriver-manager

# --- Script ---
# The folder where all files will be saved
folder_name = "${projectName}"
os.makedirs(folder_name, exist_ok=True)

# Initialize Chrome WebDriver
# webdriver-manager will automatically download the correct driver for your Chrome version.
try:
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
except Exception as e:
    print(f"Error setting up Chrome Driver: {e}")
    print("Please ensure Google Chrome is installed on your system.")
    exit()
`;

  if (scrapingScope === 'single') {
    return `${commonSetup}
# The URL to scrape
url = "${url}"

print(f"Opening URL: {url}")
driver.get(url)

# Wait for the page to load dynamically.
# Adjust the sleep time if the page needs more time to load all content.
print("Waiting for page to load (5 seconds)...")
time.sleep(5)

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
    # Adjust the sleep time if the page needs more time to load all content.
    time.sleep(3)
    
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
    # Adjust the sleep time if the page needs more time to load all content.
    time.sleep(3)
    
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

const convertToCssSelector = (tag: string, attrs: string): string => {
    if (!tag.trim()) return '';
    let selector = tag.trim();
    if (!attrs.trim()) return selector;
    try {
        const parts = attrs.split(',').map(p => p.trim()).filter(p => p.includes('='));
        for (const part of parts) {
            const eqIndex = part.indexOf('=');
            let key = part.substring(0, eqIndex).trim();
            let value = part.substring(eqIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            if (key && value) {
                if (key.toLowerCase() === 'id') selector += `#${value.split(/\s+/)[0]}`;
                else if (key.toLowerCase() === 'class') {
                    const classes = value.split(/\s+/).filter(Boolean).join('.');
                    if (classes) selector += `.${classes}`;
                } else selector += `[${key}="${value.replace(/"/g, '\\"')}"]`;
            }
        }
        return selector;
    } catch (e) {
        console.error("Error creating selector from attributes:", attrs, e);
        return tag.trim();
    }
};

const getStructuredExtractionLogic = (container: Omit<Extractor, 'id' | 'name'>, extractors: Extractor[]): string => {
    const containerSelector = convertToCssSelector(container.tag, container.attrs).replace(/"/g, '\\"');
    return `    # Find all the container elements
    container_selector = "${containerSelector}"
    containers = soup.select(container_selector)
    print(f"    Found {len(containers)} containers in this file.")

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
    print(f"    Found {len(elements)} matching elements in this file.")

    # Extract the text content from each element
    for el in elements:
        all_data.append(el.get_text(strip=True))`;
};

const getOutputLogic = (scrapingMode: ScrapingMode, outputFormat: OutputFormat, extractorName: string): string => {
    const dataListName = 'all_data';

    const structuredCsv = `# --- Save data to CSV ---
if ${dataListName}:
    csv_file_name = os.path.join(folder_name, "output.csv")
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
    json_file_name = os.path.join(folder_name, "output.json")
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
for item in ${dataListName}:
    print(item)`;

    if (scrapingMode === 'structured') {
        if (outputFormat === 'csv') return structuredCsv;
        if (outputFormat === 'json') return structuredJson;
        return printOutput;
    } else { // simple
        if (outputFormat === 'csv') return simpleCsv;
        if (outputFormat === 'json') return simpleJson;
        return printOutput;
    }
};


interface GenerateBsCodeParams {
    projectName: string;
    scrapingMode: ScrapingMode;
    container: Omit<Extractor, 'id' | 'name'>;
    extractors: Extractor[];
    outputFormat: OutputFormat;
    scrapingScope: ScrapingScope;
    startPage: number;
    numPages: number;
}

export const generateBeautifulSoupCode = (params: GenerateBsCodeParams): string => {
    const { projectName, scrapingMode, container, extractors, outputFormat, scrapingScope, startPage, numPages } = params;
  
    if ((scrapingMode === 'structured' && (!container.tag || extractors.length === 0)) || (scrapingMode === 'simple' && !extractors[0]?.tag)) {
        return `# Please complete the definitions in Step 4 to generate the script.
# - For Structured Data, define a container and at least one field.
# - For a Simple List, define the single field you want to extract.`;
    }

    const imports = new Set<string>(['from bs4 import BeautifulSoup', 'import os']);
    if (outputFormat === 'csv') imports.add('import csv');
    if (outputFormat === 'json') imports.add('import json');

    let fileNamesPythonList: string;
    if (scrapingScope === 'single') {
        fileNamesPythonList = '["dataset.html"]';
    } else {
        const fileNames = Array.from({ length: numPages }, (_, i) => `"dataset_${startPage + i}.html"`);
        fileNamesPythonList = `[${fileNames.join(', ')}]`;
    }


    const extractionLogic = scrapingMode === 'structured'
        ? getStructuredExtractionLogic(container, extractors)
        : getSimpleExtractionLogic(extractors[0]);
        
    const outputLogic = getOutputLogic(scrapingMode, outputFormat, extractors[0].name);

    return `${Array.from(imports).join('\n')}

# --- Setup Instructions ---
# 1. Make sure you have Python installed.
# 2. Install required libraries:
#    pip install beautifulsoup4

# --- Script ---
# The folder where HTML files are located and output will be saved
folder_name = "${projectName}"
# The list of files to process, based on your configuration in Step 1.
file_names = ${fileNamesPythonList}
all_data = []  # A list to hold all data from all files

print(f"Processing {len(file_names)} file(s) from '{folder_name}' folder...")
for file_name in file_names:
    file_path = os.path.join(folder_name, file_name)
    print(f"  - Reading {file_path}")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            html_content = f.read()
    except FileNotFoundError:
        print(f"    Error: The file '{file_path}' was not found. Skipping.")
        continue  # Skip to the next file

    soup = BeautifulSoup(html_content, "html.parser")
    
${extractionLogic}

# --- Final Output ---
${outputLogic}
`;
};