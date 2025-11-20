import pandas as pd
import json
import sys

try:
    # Read Excel file
    excel_file = 'Web2ERP_Eslesme_Mapping.xlsx'
    
    # Try to read all sheets
    xls = pd.ExcelFile(excel_file)
    print(f"Available sheets: {xls.sheet_names}")
    
    # Read each sheet and display structure
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        print(f"\n=== Sheet: {sheet_name} ===")
        print(f"Columns: {list(df.columns)}")
        print(f"Rows: {len(df)}")
        print("\nFirst 5 rows:")
        print(df.head())
        
        # Save to JSON for processing
        output_file = f'mapping_{sheet_name.lower().replace(" ", "_")}.json'
        df.to_json(output_file, orient='records', force_ascii=False, indent=2)
        print(f"Saved to: {output_file}")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
