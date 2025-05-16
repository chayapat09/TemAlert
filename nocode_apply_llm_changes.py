import json
import os
import argparse

def write_files_from_json(json_data_str, base_path=".", dry_run=False):
    """
    Parses a JSON string containing file data and writes the files to disk.

    Args:
        json_data_str (str): The JSON string copied from the LLM output.
                             It should be a list of {'filePath': '...', 'content': '...'} objects.
        base_path (str): The root directory of the project where files should be written.
                         Defaults to the current directory (".").
        dry_run (bool): If True, prints what would be done without writing files.
                        Defaults to False.
    """
    try:
        # Load the JSON data from the string
        files_data = json.loads(json_data_str)

        # Basic validation of the loaded data structure
        if not isinstance(files_data, list):
            print("Error: JSON data is not a list.")
            return
        if not all(isinstance(item, dict) and 'filePath' in item and 'content' in item for item in files_data):
            print("Error: JSON list does not contain the expected dictionary structure ('filePath', 'content').")
            return

        print(f"Processing {len(files_data)} file(s)...")
        if dry_run:
            print("--- DRY RUN MODE: No files will be written. ---")

        for file_info in files_data:
            relative_path = file_info['filePath']
            content = file_info['content']

            # IMPORTANT: Sanitize the relative path to prevent directory traversal issues
            # os.path.normpath cleans up path separators (e.g., /// -> /)
            # os.path.abspath ensures we have a full path rooted somewhere
            # We then check if the path starts with the intended base path
            absolute_base = os.path.abspath(base_path)
            target_path = os.path.abspath(os.path.join(absolute_base, relative_path))
            
            if not target_path.startswith(absolute_base):
                 print(f"Error: Potential directory traversal attempt detected for path: {relative_path}. Skipping.")
                 continue

            # Get the directory part of the target path
            target_dir = os.path.dirname(target_path)

            if dry_run:
                print(f"DRY RUN: Would ensure directory exists: {target_dir}")
                print(f"DRY RUN: Would write {len(content)} bytes to: {target_path}")
            else:
                try:
                    # Create directories if they don't exist (like mkdir -p)
                    if not os.path.exists(target_dir):
                        print(f"Creating directory: {target_dir}")
                        os.makedirs(target_dir, exist_ok=True)
                    
                    # Write the file content
                    print(f"Writing file: {target_path}")
                    with open(target_path, 'w', encoding='utf-8') as f:
                        f.write(content)

                except OSError as e:
                    print(f"Error writing file {target_path}: {e}")
                except Exception as e:
                     print(f"An unexpected error occurred while processing {target_path}: {e}")


        print("--- Processing Complete ---")
        if dry_run:
            print("--- DRY RUN MODE: No files were written. ---")

    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON received. Please check the LLM output.")
        print(f"Details: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

# --- How to Use ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse LLM JSON output and write files.")
    parser.add_argument("-f", "--file", help="Path to a file containing the JSON output from the LLM.")
    parser.add_argument("-b", "--basepath", default=".", help="Project base path where files should be written (default: current directory).")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without actually writing files.")

    args = parser.parse_args()

    json_input = None
    if args.file:
        try:
            with open(args.file, 'r', encoding='utf-8') as f:
                json_input = f.read()
            print(f"Reading JSON from file: {args.file}")
        except FileNotFoundError:
            print(f"Error: Input file not found: {args.file}")
            exit(1)
        except Exception as e:
            print(f"Error reading input file: {e}")
            exit(1)
    else:
        print("No input file provided. Please paste the JSON output below.")
        print("End input with EOF (Ctrl+D on Linux/macOS, Ctrl+Z then Enter on Windows).")
        try:
            json_input = "".join(line for line in __import__('sys').stdin) # Read all stdin
        except Exception as e:
            print(f"Error reading input from stdin: {e}")
            exit(1)


    if json_input:
        # Remove the surrounding Markdown code block if present
        if json_input.strip().startswith("```json"):
           json_input = json_input.strip()[7:] # Remove ```json
        if json_input.strip().endswith("```"):
            json_input = json_input.strip()[:-3] # Remove ```

        write_files_from_json(json_input.strip(), args.basepath, args.dry_run)
    else:
        print("No JSON input received.")