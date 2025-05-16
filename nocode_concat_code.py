#!/usr/bin/env python3
import os

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
    output_file = os.path.join(output_dir, "combined_codebase.txt")
    
    # Set directories to exclude (instance folder is excluded, along with common non-code directories).
    exclude_dirs = {"instance", "venv", ".venv", "migrations", "__pycache__", ".git", ".vscode"}
    # Define the code file extensions to track.
    code_extensions = (".py", ".html", ".css", ".js")
    
    print(f"Searching for code files in '{os.path.abspath(root_dir)}' with extensions {code_extensions},")
    print(f"excluding directories: {exclude_dirs} and any files starting with 'nocode_'.")
    
    # Gather matching code files from the entire project.
    code_files = gather_code_files(root_dir, code_extensions, exclude_dirs)
    print(f"Found {len(code_files)} code files.")
    
    # Ensure the output directory exists.
    os.makedirs(output_dir, exist_ok=True)
    print(f"Writing combined codebase to '{os.path.abspath(output_file)}'")
    
    # Write the content of each code file into the output file.
    try:
        with open(output_file, "w", encoding="utf-8") as outfile:
            # Sort the files for consistent order.
            for f in sorted(code_files):
                relative_path = os.path.relpath(f, root_dir)
                outfile.write(f"--- Start of {relative_path} ---\n")
                try:
                    with open(f, "r", encoding="utf-8", errors="ignore") as infile:
                        outfile.write(infile.read())
                except Exception as e:
                    outfile.write(f"\n!!! Error reading file {relative_path}: {e} !!!\n")
                outfile.write(f"\n--- End of {relative_path} ---\n\n")
        print("Successfully combined codebase into:", os.path.abspath(output_file))
    except IOError as e:
        print(f"Error writing to output file {output_file}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()
