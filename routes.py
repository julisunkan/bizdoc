from flask import render_template, request, jsonify, redirect, url_for, flash, send_file
from app import app, db
from models import BusinessSettings, Client, Document, DocumentItem
from utils import generate_document_number, export_to_csv, export_to_json, import_from_csv, import_from_json
import json
from datetime import datetime, date
import logging
import io
import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate')
def document_generator():
    clients = Client.query.all()
    business_settings = BusinessSettings.query.first()
    if not business_settings:
        business_settings = BusinessSettings()
        db.session.add(business_settings)
        db.session.commit()
    
    return render_template('document_generator.html', 
                         clients=clients, 
                         business_settings=business_settings)

@app.route('/settings')
def business_settings():
    settings = BusinessSettings.query.first()
    if not settings:
        settings = BusinessSettings()
        db.session.add(settings)
        db.session.commit()
    
    return render_template('business_settings.html', settings=settings)

@app.route('/clients')
def client_management():
    clients = Client.query.all()
    return render_template('client_management.html', clients=clients)

@app.route('/api/business-settings', methods=['GET', 'POST'])
def api_business_settings():
    if request.method == 'GET':
        settings = BusinessSettings.query.first()
        if not settings:
            settings = BusinessSettings()
            db.session.add(settings)
            db.session.commit()
        return jsonify(settings.to_dict())
    
    elif request.method == 'POST':
        data = request.get_json()
        settings = BusinessSettings.query.first()
        if not settings:
            settings = BusinessSettings()
            db.session.add(settings)
        
        # Update settings
        for key, value in data.items():
            if hasattr(settings, key):
                setattr(settings, key, value)
        
        settings.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Settings updated successfully'})

@app.route('/api/clients', methods=['GET', 'POST'])
def api_clients():
    if request.method == 'GET':
        clients = Client.query.all()
        return jsonify([client.to_dict() for client in clients])
    
    elif request.method == 'POST':
        data = request.get_json()
        client = Client(
            name=data.get('name', ''),
            email=data.get('email', ''),
            phone=data.get('phone', ''),
            address=data.get('address', ''),
            company=data.get('company', '')
        )
        db.session.add(client)
        db.session.commit()
        
        return jsonify({'success': True, 'client': client.to_dict()})

@app.route('/api/clients/<int:client_id>', methods=['PUT', 'DELETE'])
def api_client_detail(client_id):
    client = Client.query.get_or_404(client_id)
    
    if request.method == 'PUT':
        data = request.get_json()
        client.name = data.get('name', client.name)
        client.email = data.get('email', client.email)
        client.phone = data.get('phone', client.phone)
        client.address = data.get('address', client.address)
        client.company = data.get('company', client.company)
        client.updated_at = datetime.utcnow()
        
        db.session.commit()
        return jsonify({'success': True, 'client': client.to_dict()})
    
    elif request.method == 'DELETE':
        db.session.delete(client)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Client deleted successfully'})

@app.route('/api/documents', methods=['POST'])
def api_create_document():
    data = request.get_json()
    
    try:
        # Create document
        document = Document(
            document_type=data.get('document_type'),
            document_number=generate_document_number(data.get('document_type')),
            client_id=data.get('client_id'),
            issue_date=datetime.strptime(data.get('issue_date'), '%Y-%m-%d').date(),
            due_date=datetime.strptime(data.get('due_date'), '%Y-%m-%d').date() if data.get('due_date') else None,
            notes=data.get('notes', ''),
            status=data.get('status', 'draft')
        )
        
        db.session.add(document)
        db.session.flush()  # Get the document ID
        
        # Create document items
        subtotal = 0
        for item_data in data.get('items', []):
            total_price = float(item_data['quantity']) * float(item_data['unit_price'])
            item = DocumentItem(
                document_id=document.id,
                description=item_data['description'],
                quantity=float(item_data['quantity']),
                unit_price=float(item_data['unit_price']),
                total_price=total_price,
                order_index=item_data.get('order_index', 0)
            )
            db.session.add(item)
            subtotal += total_price
        
        # Calculate totals
        business_settings = BusinessSettings.query.first()
        tax_rate = business_settings.tax_rate if business_settings else 0.0
        tax_amount = subtotal * (tax_rate / 100)
        total_amount = subtotal + tax_amount
        
        document.subtotal = subtotal
        document.tax_amount = tax_amount
        document.total_amount = total_amount
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'document_number': document.document_number,
            'message': 'Document created successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating document: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export-settings/<format>')
def api_export_settings(format):
    settings = BusinessSettings.query.first()
    if not settings:
        return jsonify({'error': 'No settings found'}), 404
    
    if format == 'csv':
        return export_to_csv(settings.to_dict())
    elif format == 'json':
        return export_to_json(settings.to_dict())
    else:
        return jsonify({'error': 'Invalid format'}), 400

@app.route('/api/import-settings', methods=['POST'])
def api_import_settings():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        if file.filename.endswith('.csv'):
            data = import_from_csv(file)
        elif file.filename.endswith('.json'):
            data = import_from_json(file)
        else:
            return jsonify({'error': 'Invalid file format'}), 400
        
        # Update settings
        settings = BusinessSettings.query.first()
        if not settings:
            settings = BusinessSettings()
            db.session.add(settings)
        
        for key, value in data.items():
            if hasattr(settings, key):
                setattr(settings, key, value)
        
        settings.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Settings imported successfully'})
        
    except Exception as e:
        logging.error(f"Error importing settings: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/next-document-number/<document_type>')
def api_next_document_number(document_type):
    number = generate_document_number(document_type)
    return jsonify({'document_number': number})

@app.route('/api/generate-pdf', methods=['POST'])
def api_generate_pdf():
    data = request.get_json()
    
    try:
        # Create PDF buffer
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        
        # Build PDF content
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor('#007AFF'),
            alignment=TA_CENTER
        )
        
        header_style = ParagraphStyle(
            'CustomHeader',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=12,
            textColor=colors.HexColor('#333333')
        )
        
        # Business info
        business_name = data.get('business_name', 'Business Name')
        document_type = data.get('document_type', 'Document').title()
        document_number = data.get('document_number', 'DOC-001')
        
        # Title
        title = Paragraph(f"{business_name}", title_style)
        story.append(title)
        
        # Document type and number
        doc_header = Paragraph(f"{document_type}: {document_number}", header_style)
        story.append(doc_header)
        story.append(Spacer(1, 20))
        
        # Client info
        client_info = data.get('client', {})
        if client_info:
            client_address = client_info.get('address', '').replace('\n', '<br/>')
            client_text = f"""
            <b>Bill To:</b><br/>
            {client_info.get('name', '')}<br/>
            {client_info.get('company', '')}<br/>
            {client_address}<br/>
            {client_info.get('email', '')}<br/>
            {client_info.get('phone', '')}
            """
            client_para = Paragraph(client_text, styles['Normal'])
            story.append(client_para)
            story.append(Spacer(1, 20))
        
        # Date info
        issue_date = data.get('issue_date', '')
        due_date = data.get('due_date', '')
        if issue_date:
            date_text = f"<b>Date:</b> {issue_date}"
            if due_date:
                date_text += f"<br/><b>Due Date:</b> {due_date}"
            date_para = Paragraph(date_text, styles['Normal'])
            story.append(date_para)
            story.append(Spacer(1, 20))
        
        # Items table
        items = data.get('items', [])
        if items:
            table_data = [['Description', 'Qty', 'Unit Price', 'Total']]
            
            for item in items:
                qty = float(item.get('quantity', 0))
                price = float(item.get('unit_price', 0))
                total = qty * price
                currency_symbol = data.get('currency_symbol', '$')
                
                table_data.append([
                    item.get('description', ''),
                    str(qty),
                    f"{currency_symbol}{price:.2f}",
                    f"{currency_symbol}{total:.2f}"
                ])
            
            # Create table
            table = Table(table_data, colWidths=[3*inch, 1*inch, 1.5*inch, 1.5*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f0f0f0')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(table)
            story.append(Spacer(1, 20))
        
        # Totals
        totals = data.get('totals', {})
        if totals:
            currency_symbol = data.get('currency_symbol', '$')
            subtotal = totals.get('subtotal', 0)
            tax_amount = totals.get('tax_amount', 0)
            total = totals.get('total', 0)
            tax_rate = totals.get('tax_rate', 0)
            
            totals_data = [
                ['Subtotal:', f"{currency_symbol}{subtotal:.2f}"]
            ]
            
            if tax_rate > 0:
                totals_data.append([f'Tax ({tax_rate}%):', f"{currency_symbol}{tax_amount:.2f}"])
            
            totals_data.append(['<b>TOTAL:</b>', f"<b>{currency_symbol}{total:.2f}</b>"])
            
            totals_table = Table(totals_data, colWidths=[4*inch, 2*inch])
            totals_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, -1), (-1, -1), 14),
                ('TOPPADDING', (0, -1), (-1, -1), 12),
                ('LINEABOVE', (0, -1), (-1, -1), 2, colors.black)
            ]))
            
            story.append(totals_table)
        
        # Notes
        notes = data.get('notes', '')
        if notes:
            story.append(Spacer(1, 20))
            notes_para = Paragraph(f"<b>Notes:</b><br/>{notes}", styles['Normal'])
            story.append(notes_para)
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        # Save PDF to temp directory
        temp_dir = os.path.join(os.getcwd(), 'temp_pdfs')
        os.makedirs(temp_dir, exist_ok=True)
        
        filename = f"{document_number}.pdf"
        filepath = os.path.join(temp_dir, filename)
        
        with open(filepath, 'wb') as f:
            f.write(buffer.getvalue())
        
        return jsonify({
            'success': True,
            'filename': filename,
            'message': 'PDF generated successfully'
        })
        
    except Exception as e:
        logging.error(f"Error generating PDF: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/download-pdf/<filename>')
def api_download_pdf(filename):
    try:
        temp_dir = os.path.join(os.getcwd(), 'temp_pdfs')
        filepath = os.path.join(temp_dir, filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'PDF file not found'}), 404
        
        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf'
        )
        
    except Exception as e:
        logging.error(f"Error downloading PDF: {str(e)}")
        return jsonify({'error': str(e)}), 500
