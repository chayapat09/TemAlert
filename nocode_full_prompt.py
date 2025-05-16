#!/usr/bin/env python3
import os

# --- Constants for Output Structure ---

PROMPT_TEMPLATE = """
GET / Tickers
Retrieve the latest price snapshot, best bid/ask price, and trading volume in the last 24 hours.

Rate Limit: 20 requests per 2 seconds
Rate limit rule: IP
HTTP Request
GET /api/v5/market/tickers

Request Example

GET /api/v5/market/tickers?instType=SWAP

Request Parameters
Parameter	Type	Required	Description
instType	String	Yes	Instrument type
SPOT
SWAP
FUTURES
OPTION
uly	String	No	Underlying, e.g. BTC-USD
Applicable to FUTURES/SWAP/OPTION
instFamily	String	No	Instrument family
Applicable to FUTURES/SWAP/OPTION
Response Example

{
    "code":"0",
    "msg":"",
    "data":[
     {
        "instType":"SWAP",
        "instId":"LTC-USD-SWAP",
        "last":"9999.99",
        "lastSz":"1",
        "askPx":"9999.99",
        "askSz":"11",
        "bidPx":"8888.88",
        "bidSz":"5",
        "open24h":"9000",
        "high24h":"10000",
        "low24h":"8888.88",
        "volCcy24h":"2222",
        "vol24h":"2222",
        "sodUtc0":"0.1",
        "sodUtc8":"0.1",
        "ts":"1597026383085"
     },
     {
        "instType":"SWAP",
        "instId":"BTC-USD-SWAP",
        "last":"9999.99",
        "lastSz":"1",
        "askPx":"9999.99",
        "askSz":"11",
        "bidPx":"8888.88",
        "bidSz":"5",
        "open24h":"9000",
        "high24h":"10000",
        "low24h":"8888.88",
        "volCcy24h":"2222",
        "vol24h":"2222",
        "sodUtc0":"0.1",
        "sodUtc8":"0.1",
        "ts":"1597026383085"
    }
  ]
}
Response Parameters
Parameter	Type	Description
instType	String	Instrument type
instId	String	Instrument ID
last	String	Last traded price
lastSz	String	Last traded size. 0 represents there is no trading volume
askPx	String	Best ask price
askSz	String	Best ask size
bidPx	String	Best bid price
bidSz	String	Best bid size
open24h	String	Open price in the past 24 hours
high24h	String	Highest price in the past 24 hours
low24h	String	Lowest price in the past 24 hours
volCcy24h	String	24h trading volume, with a unit of currency.
If it is a derivatives contract, the value is the number of base currency.
If it is SPOT/MARGIN, the value is the quantity in quote currency.
vol24h	String	24h trading volume, with a unit of contract.
If it is a derivatives contract, the value is the number of contracts.
If it is SPOT/MARGIN, the value is the quantity in base currency.
sodUtc0	String	Open price in the UTC 0
sodUtc8	String	Open price in the UTC 8
ts	String	Ticker data generation time, Unix timestamp format in milliseconds, e.g. 1597026383085


above is api which we call one time and it give all top bid asks for OKX. Which more efficiantly for OKX (which now to fetch all OKX bid ask data it need more than 200 seconds compare to other of less than 30 seconds)
also please update internal code to calling this new method (fetch_all_top_bid_ask) also add this new interface in to exchange_interface , for bybit bitkub and binanceth please implement this method by internal logic fail back to calling fetch_top_bid_ask for each symbol and make sure fetching rate (how much concurrenty use is similar to before)
"""

JSON_OUTPUT_INSTRUCTIONS = """
After completing the task, present **only updated files** the resulting code (including newly created files and **full contents** of modified files) in the following JSON format. Ensure the entire output is a single JSON object enclosed in a Markdown code block (```json ... ```).

The JSON structure should be a list of objects, where each object represents a file:

[
  {
    "filePath": "relative/path/to/your/file1.py",
    "content": "Full content of the file as a single string. \\nMake sure to properly escape any special characters within the content to create valid JSON string."
  },
  {
    "filePath": "relative/path/to/another/file.html",
    "content": "Full content of the second file..."
  },
  {
    "filePath": "path/to/new_file.js",
    "content": "Content of a newly created file..."
  }
  // ... include all other relevant files here
]

**Important Instructions:**
* Use **relative paths** from the project root for `filePath`.
* Include the **complete content** for each file listed, not just the changes.
* Ensure the `content` field is a valid JSON string (newlines represented as \\n, quotes inside the code escaped like \\", etc.).
* Make sure the final output is **only** the JSON structure within a json code block. Do not include any explanatory text outside the code block unless specifically requested *before* the JSON block.
"""

# --- Core Logic ---

def gather_code_files(root, extensions, exclude_dirs=None):
    """
    Recursively search for code files with given extensions in the root directory,
    while skipping directories listed in exclude_dirs and ignoring any file
    that starts with 'nocode_'.

    Args:
        root (str): The root directory to start searching.
        extensions (tuple): A tuple of file extensions to include (e.g., ('.py', '.html', '.css', '.js')).
        exclude_dirs (set, optional): A set of directory names to exclude. Defaults to an empty set.

    Returns:
        list: A list of full paths to the matching files.
    """
    if exclude_dirs is None:
        exclude_dirs = set()
    collected = []

    # Walk through the directory tree
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        # Exclude specified directories (by name)
        # Modify dirnames in place to prevent descending into excluded folders
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]

        for filename in filenames:
            # Skip any file that starts with "nocode_"
            if filename.startswith("nocode_"):
                continue
            # Check if the file's extension is one we want to include
            if filename.endswith(extensions):
                full_path = os.path.join(dirpath, filename)
                collected.append(full_path)
    return collected

def main():
    # Set the project root directory.
    root_dir = "."
    # Define the output directory. Note: even though we're writing the combined output
    # to the 'instance' folder, we intentionally exclude this folder from scanning.
    output_dir = os.path.join(root_dir, "instance")
    output_file = os.path.join(output_dir, "llm_code_input.txt") # Renamed for clarity

    # Set directories to exclude (instance folder is excluded, along with common non-code directories).
    exclude_dirs = {"instance", "venv", ".venv", "migrations", "__pycache__", ".git", ".vscode", "node_modules", "dist", "build"}
    # Define the code file extensions to track.
    code_extensions = (".py", ".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".json", ".yaml", ".yml", ".md") # Added more common extensions

    print(f"Searching for code files in '{os.path.abspath(root_dir)}' with extensions {code_extensions},")
    print(f"excluding directories: {exclude_dirs} and any files starting with 'nocode_'.")

    # Gather matching code files from the entire project.
    code_files = gather_code_files(root_dir, code_extensions, exclude_dirs)
    print(f"Found {len(code_files)} code files.")

    # Ensure the output directory exists.
    os.makedirs(output_dir, exist_ok=True)
    print(f"Writing combined context to '{os.path.abspath(output_file)}'")

    # Write the content of each code file into the output file.
    try:
        with open(output_file, "w", encoding="utf-8") as outfile:
            # 1. Write the initial prompt template
            outfile.write(PROMPT_TEMPLATE)
            outfile.write("\n\n--- Context: Code Files Below ---\n\n")

            # 2. Write the content of each code file
            # Sort the files for consistent order.
            for f in sorted(code_files):
                relative_path = os.path.relpath(f, root_dir).replace("\\", "/") # Use forward slashes for paths
                outfile.write(f"--- Start of {relative_path} ---\n")
                try:
                    with open(f, "r", encoding="utf-8", errors="ignore") as infile:
                        outfile.write(infile.read())
                except Exception as e:
                    outfile.write(f"\n!!! Error reading file {relative_path}: {e} !!!\n")
                outfile.write(f"\n--- End of {relative_path} ---\n\n")

            # 3. Write the final instructions for the output format
            outfile.write("\n--- Task Output Instructions ---\n")
            outfile.write(JSON_OUTPUT_INSTRUCTIONS)

        print("Successfully combined context and instructions into:", os.path.abspath(output_file))
    except IOError as e:
        print(f"Error writing to output file {output_file}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()