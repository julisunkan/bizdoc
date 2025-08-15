from flask import render_template, request, jsonify, redirect, url_for, flash
from app import app, db
from models import BusinessSettings, Client, Document, DocumentItem
from utils import generate_document_number, export_to_csv, export_to_json, import_from_csv, import_from_json
import json
from datetime import datetime, date
import logging

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
