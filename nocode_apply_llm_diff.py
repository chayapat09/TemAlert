import os
import argparse
import patch  # from python-patch library
import shutil # For backups

def apply_diff(diff_text, base_path=".", dry_run=False, backup=False):
    """
    Parses a unified diff string and applies it to files relative to a base path.

    Args:
        diff_text (str): The unified diff text copied from the LLM output.
        base_path (str): The root directory of the project where patches should be applied.
                         Defaults to the current directory (".").
        dry_run (bool): If True, prints what would be done without applying the patch.
        backup (bool): If True, creates a .bak file for each modified file before patching.
    """
    try:
        # The patch library expects bytes
        diff_bytes = diff_text.encode('utf-8')
        patch_set = patch.fromstring(diff_bytes)

        if not patch_set:
            print("Warning: No patches were found in the provided diff input.")
            return True # Nothing to do, technically successful

        print(f"Parsed {len(patch_set.items)} patch item(s). Processing...")
        if dry_run:
            print("--- DRY RUN MODE: No files will be modified. ---")
        if backup and not dry_run:
            print("--- Backup enabled: '.bak' files will be created for modified files. ---")

        applied_count = 0
        failed_count = 0
        skipped_count = 0

        # Get absolute base path ONCE for safety checks
        absolute_base = os.path.abspath(base_path)

        for patch_item in patch_set.items:
            # Determine the target file path from the patch header (prefer target)
            relative_path = patch_item.target # target is usually b/path/to/file
            if relative_path.startswith('b/'):
                relative_path = relative_path[2:]

            if not relative_path:
                 print(f"Warning: Could not determine relative path for a patch item. Header: --- {patch_item.source}, +++ {patch_item.target}. Skipping.")
                 skipped_count += 1
                 continue

            # Construct and sanitize the full target path
            target_path = os.path.abspath(os.path.join(absolute_base, relative_path))
            target_dir = os.path.dirname(target_path)

            # --- Security Check ---
            if not target_path.startswith(absolute_base):
                 print(f"Error: Potential directory traversal attempt detected for path: {relative_path}. Skipping patch.")
                 failed_count += 1
                 continue

            print("-" * 20)
            print(f"Processing patch for: {relative_path}")
            print(f"Full path: {target_path}")

            if dry_run:
                if not os.path.exists(target_dir):
                    print(f"DRY RUN: Would ensure directory exists: {target_dir}")
                if patch_item.is_new_file():
                    print("DRY RUN: Patch indicates a new file.")
                elif not os.path.exists(target_path):
                     print(f"DRY RUN: Warning - Original file does not exist: {target_path}. Patch might fail.")
                print(f"DRY RUN: Would attempt to apply patch to {target_path}")
                # Can't fully simulate apply success/failure easily in dry run
                applied_count += 1 # Assume success for dry run count
                continue # Skip actual application in dry run

            # --- Actual Application ---
            # Ensure target directory exists
            if not os.path.exists(target_dir):
                print(f"Creating directory: {target_dir}")
                try:
                    os.makedirs(target_dir, exist_ok=True)
                except OSError as e:
                    print(f"Error: Failed to create directory {target_dir}: {e}. Skipping patch.")
                    failed_count += 1
                    continue

            # Handle backup
            backup_made = False
            if backup and os.path.exists(target_path) and not patch_item.is_new_file():
                backup_path = target_path + ".bak"
                try:
                    print(f"Creating backup: {backup_path}")
                    shutil.copy2(target_path, backup_path) # copy2 preserves metadata
                    backup_made = True
                except Exception as e:
                    print(f"Warning: Failed to create backup for {target_path}: {e}")


            # Apply the patch for this specific file
            # We re-parse just this item to apply individually (allows continuing on errors)
            try:
                single_patch_set = patch.fromstring(str(patch_item).encode('utf-8'))
                if single_patch_set.apply(root=base_path):
                    print("Patch applied successfully.")
                    applied_count += 1
                else:
                    # Apply failed, maybe context mismatch?
                    print("Error: Patch application failed. Check diff context and file content.")
                    failed_count += 1
                    # Attempt to restore backup if one was made for this file
                    if backup_made:
                        try:
                           print(f"Attempting to restore from backup: {backup_path}")
                           shutil.move(backup_path, target_path) # move is safer than copy+delete
                        except Exception as e:
                           print(f"Error: Failed to restore backup {backup_path}. Manual check required: {e}")

            except Exception as e:
                 print(f"Error: An exception occurred during patch application for {relative_path}: {e}")
                 failed_count += 1
                 if backup_made:
                      try:
                           print(f"Attempting to restore from backup due to exception: {backup_path}")
                           shutil.move(backup_path, target_path)
                      except Exception as be:
                           print(f"Error: Failed to restore backup {backup_path} after exception. Manual check required: {be}")


        print("=" * 30)
        print("--- Patching Summary ---")
        print(f"Successfully applied: {applied_count}")
        print(f"Failed:             {failed_count}")
        print(f"Skipped:            {skipped_count}")
        print("=" * 30)
        if failed_count > 0:
            print("Warning: Some patches failed to apply. Please review the output and your files.")
            return False
        elif skipped_count > 0 and failed_count == 0:
             print("Info: Some patch items were skipped, but others applied successfully.")
             return True
        elif applied_count > 0:
            print("All applicable patches applied successfully.")
            return True
        else:
            print("No patches were successfully applied.")
            return False # Indicate nothing really happened or only failures


    except patch.ParseError as e:
        print(f"Error: Failed to parse the diff input. Is it a valid unified diff?")
        print(f"Details: {e}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return False

# --- How to Use ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Apply unified diff patches from LLM output.")
    parser.add_argument("-f", "--file", help="Path to a file containing the unified diff output from the LLM.")
    parser.add_argument("-b", "--basepath", default=".", help="Project base path where patches should be applied (default: current directory).")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without actually applying patches.")
    parser.add_argument("--backup", action="store_true", help="Create '.bak' backups of files before patching.")

    args = parser.parse_args()

    diff_input_text = None
    if args.file:
        try:
            with open(args.file, 'r', encoding='utf-8') as f:
                diff_input_text = f.read()
            print(f"Reading diff from file: {args.file}")
        except FileNotFoundError:
            print(f"Error: Input file not found: {args.file}")
            exit(1)
        except Exception as e:
            print(f"Error reading input file: {e}")
            exit(1)
    else:
        print("No input file provided. Please paste the unified diff output below.")
        print("End input with EOF (Ctrl+D on Linux/macOS, Ctrl+Z then Enter on Windows).")
        try:
            diff_input_text = "".join(line for line in __import__('sys').stdin) # Read all stdin
        except Exception as e:
             print(f"Error reading input from stdin: {e}")
             exit(1)

    if diff_input_text:
        # Remove the surrounding Markdown code block if present
        if diff_input_text.strip().startswith("```diff"):
           diff_input_text = diff_input_text.strip()[7:] # Remove ```diff
        elif diff_input_text.strip().startswith("```"):
             diff_input_text = diff_input_text.strip()[3:] # Remove ```
        if diff_input_text.strip().endswith("```"):
            diff_input_text = diff_input_text.strip()[:-3] # Remove ```

        apply_diff(diff_input_text.strip(), args.basepath, args.dry_run, args.backup)
    else:
        print("No diff input received.")