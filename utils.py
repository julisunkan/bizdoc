from flask import jsonify, make_response
from models import BusinessSettings, Document
from app import db
import csv
import json
import io

def generate_document_number(document_type):
    """Generate document number with timestamp format: Year-Month-Day-Hour-Minute-Seconds"""
    from datetime import datetime
    
    business_settings = BusinessSettings.query.first()
    
    if document_type == 'invoice':
        prefix = business_settings.invoice_prefix if business_settings else 'INV-'
    elif document_type == 'quote':
        prefix = business_settings.quote_prefix if business_settings else 'QUO-'
    elif document_type == 'receipt':
        prefix = business_settings.receipt_prefix if business_settings else 'REC-'
    else:
        prefix = 'DOC-'
    
    # Generate timestamp in format: Year-Month-Day-Hour-Minute-Seconds
    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    
    return f"{prefix}{timestamp}"

def export_to_csv(data):
    """Export business settings to CSV"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write headers
    writer.writerow(['Field', 'Value'])
    
    # Write data
    for key, value in data.items():
        writer.writerow([key, value])
    
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = 'attachment; filename=business_settings.csv'
    
    return response

def export_to_json(data):
    """Export business settings to JSON"""
    response = make_response(json.dumps(data, indent=2, default=str))
    response.headers['Content-Type'] = 'application/json'
    response.headers['Content-Disposition'] = 'attachment; filename=business_settings.json'
    
    return response

def import_from_csv(file):
    """Import business settings from CSV"""
    data = {}
    content = file.read().decode('utf-8')
    reader = csv.reader(io.StringIO(content))
    
    # Skip header row
    next(reader, None)
    
    for row in reader:
        if len(row) >= 2:
            key, value = row[0], row[1]
            # Convert numeric values
            if key in ['tax_rate']:
                try:
                    data[key] = float(value)
                except ValueError:
                    data[key] = value
            else:
                data[key] = value
    
    return data

def import_from_json(file):
    """Import business settings from JSON"""
    content = file.read().decode('utf-8')
    data = json.loads(content)
    return data
