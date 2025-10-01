# Dynamic Web Scraper Generator

This is a powerful web-based tool designed to simplify the process of creating web scraping scripts. It generates custom Python scripts for both dynamic (JavaScript-heavy) and static websites, integrating AI-powered features to make configuration easier and more intuitive.

Whether you need to control a real browser with **Selenium** or perform lightweight fetching with **Requests** and **BeautifulSoup**, this tool provides a complete, multi-step workflow to get you the data you need.

## ✨ Features

- **Dual Scraping Modes**: Choose between **Dynamic (Selenium)** for complex, interactive sites and **Static (Requests/BeautifulSoup)** for simpler, faster scraping.
- **Flexible Data Sources**: Scrape from live URLs or process local HTML files you already have.
- **Advanced Pagination Control**: Handles multi-page scraping by clicking 'Next' buttons or following numeric URL patterns.
- **Powerful Extractor UI**: An interactive interface with a live preview to visually define data extraction points using point-and-click or by manually specifying CSS selectors.
- **Proxy & Browser Configuration**: Enhance your scrapers with proxy rotation, configurable delays, and browser user-agent masking to avoid blocks.
- **Multiple Output Formats**: Generate scripts that save data as CSV, JSON, or simply print it to the console.
- **AI-Powered Assistance**:
    - **Method Advisor**: Analyzes a URL and recommends the most effective scraping method (Dynamic vs. Static).
    - **URL Pattern Detection**: Automatically determines the pagination pattern from an example URL.
    - **'Next Button' Selector Detection**: Analyzes HTML to find the CSS selector for the next page button.
    - **Field Detection**: Suggests data fields and their selectors from a sample HTML container.
    - **AI Debugger**: Helps you fix runtime errors in your generated code by analyzing the script and the error message.

---

## 🚀 How to Use the Application

The application guides you through a series of steps to generate the perfect script for your needs.

### Step 0: Provide API Key

To enable the AI-powered features (like auto-detection and the debugger), you must first provide a **Google AI API Key**. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Step 1: Get an AI Recommendation (Optional)

- **Analyze URL**: Enter the URL of the website you want to scrape. The AI will analyze it and recommend either "Dynamic" or "Static" scraping, along with a reason.
- **Proceed or Choose**: You can either accept the recommendation, which will pre-fill the URL and take you to the correct configuration screen, or choose to skip and select your method manually.

### Step 2: Choose Your Scraping Method

If you skipped the AI advisor or chose to select manually, you'll be presented with two main choices:

1.  **Dynamic Web Scraping**: For modern websites that load content with JavaScript. This will use **Selenium**.
2.  **Static Web Scraping**: For traditional websites where all content is in the initial HTML. This will use **Requests** and **BeautifulSoup**.

---

### Dynamic Scraping Workflow (Selenium)

This flow generates two scripts: one to fetch HTML and another to parse it.

1.  **Configure Scraper**:
    - Set a project folder name, choose a browser (e.g., Chrome, Firefox), and define a delay between actions.
    - Optionally, enable and configure proxies.
    - Define the URL and pagination method ('Next' Button or URL Pattern). Use the "✨" buttons for AI assistance.
2.  **(Conditional) Configure Proxies**: If enabled, paste or upload your proxy list.
3.  **Run Selenium Script**:
    - The app generates the first Python script.
    - **Action**: Copy this script and run it on your local machine. It will launch the selected browser, navigate the site, and save the HTML of each page into your project folder.
4.  **Upload Sample HTML**:
    - Upload one of the `.html` files that the Selenium script just saved. This will be used as a template for the next step.
5.  **Define Extractors**:
    - Use the interactive preview to define what data to extract. You can point-and-click elements with the cursor icon (`CursorArrowRaysIcon`) or let the AI "✨ Auto-detect Fields".
    - Test your selectors to see a live preview of the results.
6.  **Get Final Scraper**:
    - The app generates the final BeautifulSoup script.
    - **Action**: Copy this script and run it from the parent directory of your project folder. It will process all the downloaded HTML files and save the extracted data in your chosen format (CSV/JSON).

### Static Scraping Workflow (Requests + BeautifulSoup)

This flow is more direct and generates a single, all-in-one script.

1.  **Choose Static Source**:
    - **Scrape from URL**: For scraping a live, static website.
    - **Extract from Local HTML Files**: If you already have HTML files saved.
2.  **Configure Scraper**:
    - **(If scraping from URL)**: Provide the target URL, pagination settings, a sample HTML file for the preview, and optional proxy/delay settings.
    - **(If extracting from local files)**: Simply provide a project name and upload your HTML files.
3.  **Define Extractors**:
    - This step is identical to the dynamic workflow. Use the interactive preview to define what data you want to extract.
4.  **Get Final Scraper**:
    - The app generates the final, all-in-one Python script.
    - **Action**: Run this script locally. It will either fetch the live URLs or process your local files, then parse the data and save the output.

---

## 🐍 Running the Generated Scripts Locally

### Prerequisites

You must have **Python 3** installed on your machine.

### Installation

1.  Clone your repository or download the generated scripts.
2.  It is highly recommended to use a virtual environment to manage dependencies.
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```
3.  Install the required Python libraries using the provided `requirements.txt` file.
    ```bash
    pip install -r requirements.txt
    ```

### Execution

1.  Navigate to your project directory in your terminal.
2.  Run the Python script you generated.
    ```bash
    python your_generated_script_name.py
    ```
3.  Follow any instructions printed by the script. If you encounter an error, you can use the **Debug with AI** panel in the web application to get help.