class DocumentGenerator {
    constructor() {
        this.items = [];
        this.businessSettings = null;
        this.selectedClient = null;
        this.documentType = '';
        this.generatedPdfBlob = null;
        this.generatedPdfFilename = null;
        
        this.init();
    }
    
    async init() {
        await this.loadBusinessSettings();
        this.setupEventListeners();
        this.addInitialItem();
    }
    
    async loadBusinessSettings() {
        try {
            const response = await fetch('/api/business-settings');
            this.businessSettings = await response.json();
        } catch (error) {
            console.error('Error loading business settings:', error);
            this.businessSettings = {
                business_name: 'Your Business Name',
                currency_code: 'USD',
                currency_symbol: '$',
                tax_rate: 0
            };
        }
    }
    
    setupEventListeners() {
        // Document type change
        document.getElementById('documentType').addEventListener('change', (e) => {
            this.documentType = e.target.value;
            this.updateDocumentNumber();
            this.updatePreview();
        });
        
        // Client selection
        document.getElementById('clientSelect').addEventListener('change', (e) => {
            const selectedOption = e.target.selectedOptions[0];
            if (selectedOption.value) {
                this.selectedClient = {
                    id: selectedOption.value,
                    name: selectedOption.dataset.name,
                    email: selectedOption.dataset.email,
                    phone: selectedOption.dataset.phone,
                    address: selectedOption.dataset.address,
                    company: selectedOption.dataset.company
                };
            } else {
                this.selectedClient = null;
            }
            this.updatePreview();
        });
        
        // Date changes
        document.getElementById('issueDate').addEventListener('change', () => this.updatePreview());
        document.getElementById('dueDate').addEventListener('change', () => this.updatePreview());
        document.getElementById('notes').addEventListener('input', () => this.updatePreview());
        
        // Add item button
        document.getElementById('addItemBtn').addEventListener('click', () => this.addItem());
        
        // Generate PDF button
        document.getElementById('generatePdfBtn').addEventListener('click', async () => {
            const button = document.getElementById('generatePdfBtn');
            const originalText = button.innerHTML;
            
            // Show loading state
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating PDF...';
            button.disabled = true;
            
            try {
                await this.generatePDF();
            } catch (error) {
                console.error('PDF generation error:', error);
                showAlert('Error generating PDF: ' + error.message, 'danger');
            } finally {
                // Restore button state
                button.innerHTML = originalText;
                button.disabled = false;
            }
        });
        
        // Save client modal
        document.getElementById('saveClientBtn').addEventListener('click', () => this.saveNewClient());
    }
    
    async updateDocumentNumber() {
        if (!this.documentType) return;
        
        try {
            const response = await fetch(`/api/next-document-number/${this.documentType}`);
            const data = await response.json();
            document.getElementById('documentNumber').value = data.document_number;
        } catch (error) {
            console.error('Error getting document number:', error);
        }
    }
    
    addItem(data = null) {
        const container = document.getElementById('itemsContainer');
        const itemIndex = this.items.length;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-row border rounded p-3 mb-3';
        itemDiv.dataset.index = itemIndex;
        
        itemDiv.innerHTML = `
            <div class="row align-items-end">
                <div class="col-md-4">
                    <label class="form-label">Description *</label>
                    <input type="text" class="form-control item-description" 
                           placeholder="Item description" value="${data?.description || ''}" required>
                </div>
                <div class="col-md-2">
                    <label class="form-label">Quantity</label>
                    <input type="number" class="form-control item-quantity" 
                           min="0" step="0.01" value="${data?.quantity || 1}">
                </div>
                <div class="col-md-2">
                    <label class="form-label">Unit Price</label>
                    <input type="number" class="form-control item-price" 
                           min="0" step="0.01" value="${data?.unit_price || 0}">
                </div>
                <div class="col-md-2">
                    <label class="form-label">Total</label>
                    <input type="text" class="form-control item-total" readonly>
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-outline-danger btn-sm remove-item-btn">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(itemDiv);
        
        // Add event listeners
        const quantityInput = itemDiv.querySelector('.item-quantity');
        const priceInput = itemDiv.querySelector('.item-price');
        const removeBtn = itemDiv.querySelector('.remove-item-btn');
        const descriptionInput = itemDiv.querySelector('.item-description');
        
        [quantityInput, priceInput, descriptionInput].forEach(input => {
            input.addEventListener('input', () => {
                this.updateItemTotal(itemDiv);
                this.updatePreview();
            });
        });
        
        removeBtn.addEventListener('click', () => {
            itemDiv.remove();
            this.updateItemIndices();
            this.updatePreview();
        });
        
        this.items.push({
            description: data?.description || '',
            quantity: data?.quantity || 1,
            unit_price: data?.unit_price || 0
        });
        
        this.updateItemTotal(itemDiv);
    }
    
    addInitialItem() {
        this.addItem();
    }
    
    updateItemTotal(itemDiv) {
        const quantity = parseFloat(itemDiv.querySelector('.item-quantity').value) || 0;
        const price = parseFloat(itemDiv.querySelector('.item-price').value) || 0;
        const total = quantity * price;
        
        itemDiv.querySelector('.item-total').value = this.formatCurrency(total);
    }
    
    updateItemIndices() {
        const itemRows = document.querySelectorAll('.item-row');
        this.items = [];
        
        itemRows.forEach((row, index) => {
            row.dataset.index = index;
            this.items.push({
                description: row.querySelector('.item-description').value,
                quantity: parseFloat(row.querySelector('.item-quantity').value) || 0,
                unit_price: parseFloat(row.querySelector('.item-price').value) || 0
            });
        });
    }
    
    calculateTotals() {
        const subtotal = this.items.reduce((sum, item) => {
            return sum + (item.quantity * item.unit_price);
        }, 0);
        
        const taxRate = this.businessSettings?.tax_rate || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;
        
        return { subtotal, taxAmount, total, taxRate };
    }
    
    formatCurrency(amount) {
        const symbol = this.businessSettings?.currency_symbol || '$';
        const formattedAmount = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${symbol}${formattedAmount}`;
    }
    
    updatePreview() {
        const preview = document.getElementById('documentPreview');
        
        // Always update items from current form state before preview
        this.updateItemIndices();
        
        if (!this.documentType || !this.selectedClient) {
            preview.innerHTML = '<p class="text-muted text-center">Select document type and client to see preview</p>';
            return;
        }
        
        const documentNumber = document.getElementById('documentNumber').value;
        const issueDate = document.getElementById('issueDate').value;
        const dueDate = document.getElementById('dueDate').value;
        const notes = document.getElementById('notes').value;
        
        const { subtotal, taxAmount, total, taxRate } = this.calculateTotals();
        
        const documentTitle = this.documentType.charAt(0).toUpperCase() + this.documentType.slice(1);
        
        preview.innerHTML = `
            <div class="document-preview-content">
                <!-- Business Logo -->
                ${this.businessSettings.logo_url ? `
                    <div class="mb-3">
                        <img src="${this.businessSettings.logo_url}" alt="Business Logo" style="max-width: 200px; max-height: 80px; object-fit: contain;">
                    </div>
                ` : ''}
                
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        <h3 style="color: #000;">${this.businessSettings.business_name}</h3>
                        <div class="text-muted">
                            ${this.businessSettings.address ? `<div>${this.businessSettings.address.replace(/\n/g, '<br>')}</div>` : ''}
                            ${this.businessSettings.email ? `<div>Email: ${this.businessSettings.email}</div>` : ''}
                            ${this.businessSettings.phone ? `<div>Phone: ${this.businessSettings.phone}</div>` : ''}
                        </div>
                    </div>
                    <div class="text-end">
                        <h4 class="mb-1" style="color: #000;">${documentTitle.toUpperCase()}</h4>
                        <div class="text-muted">${documentNumber}</div>
                    </div>
                </div>
                
                <hr style="border-color: #000;">
                
                <div class="row mb-4">
                    <div class="col-md-6">
                        <h6 style="color: #000;"><strong>BILL TO:</strong></h6>
                        <div>
                            <strong>${this.selectedClient.name}</strong><br>
                            ${this.selectedClient.company ? `${this.selectedClient.company}<br>` : ''}
                            ${this.selectedClient.address ? `${this.selectedClient.address.replace(/\n/g, '<br>')}<br>` : ''}
                            ${this.selectedClient.email ? `${this.selectedClient.email}<br>` : ''}
                            ${this.selectedClient.phone ? this.selectedClient.phone : ''}
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="text-md-end">
                            <div><strong>DATE:</strong> ${issueDate ? formatDate(issueDate) : ''}</div>
                            ${dueDate ? `<div><strong>DUE DATE:</strong> ${formatDate(dueDate)}</div>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="table-responsive mb-4">
                    <table class="table table-bordered" style="border-color: #000; table-layout: fixed;">
                        <thead style="background-color: #f0f0f0;">
                            <tr>
                                <th style="border-color: #000; width: 50%;"><strong>DESCRIPTION</strong></th>
                                <th style="border-color: #000; width: 15%; text-align: center;"><strong>QTY</strong></th>
                                <th style="border-color: #000; width: 17.5%; text-align: center;"><strong>PRICE</strong></th>
                                <th style="border-color: #000; width: 17.5%; text-align: right;"><strong>TOTAL</strong></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.items.filter(item => item.description.trim()).map(item => `
                                <tr>
                                    <td style="border-color: #000; word-wrap: break-word; overflow-wrap: break-word;">${item.description || '-'}</td>
                                    <td style="border-color: #000; text-align: center;">${item.quantity}</td>
                                    <td style="border-color: #000; text-align: center;">${this.formatCurrency(item.unit_price)}</td>
                                    <td style="border-color: #000; text-align: right;">${this.formatCurrency(item.quantity * item.unit_price)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        ${notes ? `<div><strong>Notes:</strong><br>${notes.replace(/\n/g, '<br>')}</div>` : ''}
                    </div>
                    <div class="col-md-6">
                        <table class="table table-sm">
                            <tr>
                                <td><strong>Subtotal:</strong></td>
                                <td class="text-end">${this.formatCurrency(subtotal)}</td>
                            </tr>
                            ${taxRate > 0 ? `
                            <tr>
                                <td><strong>Tax (${taxRate}%):</strong></td>
                                <td class="text-end">${this.formatCurrency(taxAmount)}</td>
                            </tr>
                            ` : ''}
                            <tr style="border: 2px solid #000;">
                                <td><strong>TOTAL:</strong></td>
                                <td class="text-end"><strong>${this.formatCurrency(total)}</strong></td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Business Signature -->
                ${this.businessSettings.signature_url ? `
                    <div class="mt-4 d-flex justify-content-start">
                        <div>
                            <img src="${this.businessSettings.signature_url}" alt="Authorized Signature" style="max-width: 200px; max-height: 100px; object-fit: contain;">
                            <div class="text-muted small mt-2">Authorized Signature</div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    async generatePDF() {
        if (!this.documentType || !this.selectedClient) {
            showAlert('Please select document type and client', 'warning');
            return;
        }
        
        const documentNumber = document.getElementById('documentNumber').value;
        const issueDate = document.getElementById('issueDate').value;
        const dueDate = document.getElementById('dueDate').value;
        const notes = document.getElementById('notes').value;
        
        const { subtotal, taxAmount, total, taxRate } = this.calculateTotals();
        
        // Prepare data for server-side PDF generation
        const pdfData = {
            business_name: this.businessSettings.business_name,
            document_type: this.documentType,
            document_number: documentNumber,
            client: this.selectedClient,
            issue_date: issueDate,
            due_date: dueDate,
            notes: notes,
            items: this.items.filter(item => item.description.trim()),
            totals: {
                subtotal: subtotal,
                tax_amount: taxAmount,
                total: total,
                tax_rate: taxRate
            },
            currency_symbol: this.businessSettings.currency_symbol || '$'
        };
        
        try {
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(pdfData)
            });
            
            if (response.ok) {
                // Create download link
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `${documentNumber}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                showAlert('PDF downloaded successfully!', 'success');
            } else {
                const errorData = await response.json();
                showAlert('Error generating PDF: ' + (errorData.error || 'Unknown error'), 'danger');
            }
        } catch (error) {
            console.error('PDF generation error:', error);
            showAlert('Error generating PDF: ' + error.message, 'danger');
        }
    }
    
    
    
    async saveNewClient() {
        const formData = {
            name: document.getElementById('clientName').value,
            email: document.getElementById('clientEmail').value,
            phone: document.getElementById('clientPhone').value,
            company: document.getElementById('clientCompany').value,
            address: document.getElementById('clientAddress').value
        };
        
        if (!formData.name.trim()) {
            showAlert('Client name is required', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                showAlert('Client added successfully!', 'success');
                
                // Add to select dropdown
                const clientSelect = document.getElementById('clientSelect');
                const option = document.createElement('option');
                option.value = result.client.id;
                option.textContent = `${result.client.name}${result.client.company ? ' - ' + result.client.company : ''}`;
                option.dataset.name = result.client.name;
                option.dataset.email = result.client.email;
                option.dataset.phone = result.client.phone;
                option.dataset.address = result.client.address;
                option.dataset.company = result.client.company;
                
                clientSelect.appendChild(option);
                clientSelect.value = result.client.id;
                
                // Update selected client
                this.selectedClient = result.client;
                this.updatePreview();
                
                // Close modal and reset form
                const modal = bootstrap.Modal.getInstance(document.getElementById('clientModal'));
                modal.hide();
                document.getElementById('clientForm').reset();
            } else {
                showAlert('Error adding client', 'danger');
            }
        } catch (error) {
            showAlert('Error adding client: ' + error.message, 'danger');
        }
    }
}
