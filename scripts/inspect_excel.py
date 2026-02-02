import pandas as pd
import os

file_path = r"C:\Users\kgene\Desktop\subtracker-V3-main\transactions.xlsx"
print(f"Reading file: {file_path}")

try:
    # Try reading with openpyxl engine explicit, usually required for xlsx
    df = pd.read_excel(file_path, engine='openpyxl')
    print("Headers:", list(df.columns))
    if not df.empty:
        print("First row:", df.iloc[0].to_dict())
    print("Total Rows:", len(df))
except ImportError:
    print("Error: openpyxl not installed? installing...")
    # This might fail if pip is not in path or permission denied, but worth a try or just fail and ask user
    print("Please ensure openpyxl is installed: pip install openpyxl")
except Exception as e:
    print(f"Error reading excel: {e}")
