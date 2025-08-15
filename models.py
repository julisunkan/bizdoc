from app import db
from datetime import datetime
import json

class BusinessSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    business_name = db.Column(db.String(200), nullable=False, default="Your Business Name")
    address = db.Column(db.Text, default="")
    phone = db.Column(db.String(50), default="")
    email = db.Column(db.String(120), default="")
    website = db.Column(db.String(200), default="")
    logo_url = db.Column(db.String(500), default="")
    signature_url = db.Column(db.String(500), default="")
    tax_rate = db.Column(db.Float, default=0.0)
    currency_code = db.Column(db.String(10), default="USD")
    currency_symbol = db.Column(db.String(10), default="$")
    invoice_prefix = db.Column(db.String(20), default="INV-")
    quote_prefix = db.Column(db.String(20), default="QUO-")
    receipt_prefix = db.Column(db.String(20), default="REC-")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'business_name': self.business_name,
            'address': self.address,
            'phone': self.phone,
            'email': self.email,
            'website': self.website,
            'logo_url': self.logo_url,
            'signature_url': self.signature_url,
            'tax_rate': self.tax_rate,
            'currency_code': self.currency_code,
            'currency_symbol': self.currency_symbol,
            'invoice_prefix': self.invoice_prefix,
            'quote_prefix': self.quote_prefix,
            'receipt_prefix': self.receipt_prefix
        }

class Client(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(120), default="")
    phone = db.Column(db.String(50), default="")
    address = db.Column(db.Text, default="")
    company = db.Column(db.String(200), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'address': self.address,
            'company': self.company
        }

class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_type = db.Column(db.String(20), nullable=False)  # invoice, quote, receipt
    document_number = db.Column(db.String(50), nullable=False, unique=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.id'), nullable=False)
    client = db.relationship('Client', backref=db.backref('documents', lazy=True))
    issue_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    due_date = db.Column(db.Date)
    subtotal = db.Column(db.Float, default=0.0)
    tax_amount = db.Column(db.Float, default=0.0)
    total_amount = db.Column(db.Float, default=0.0)
    notes = db.Column(db.Text, default="")
    status = db.Column(db.String(20), default="draft")  # draft, sent, paid, cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DocumentItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('document.id'), nullable=False)
    document = db.relationship('Document', backref=db.backref('items', lazy=True, cascade='all, delete-orphan'))
    description = db.Column(db.String(500), nullable=False)
    quantity = db.Column(db.Float, default=1.0)
    unit_price = db.Column(db.Float, default=0.0)
    total_price = db.Column(db.Float, default=0.0)
    order_index = db.Column(db.Integer, default=0)
