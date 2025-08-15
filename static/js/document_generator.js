class DocumentGenerator {
    constructor() {
        this.items = [];
        this.businessSettings = null;
        this.selectedClient = null;
        this.documentType = '';
        
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
        
        // Form submission
        document.getElementById('documentForm').addEventListener('submit', (e) => this.saveDocument(e));
        
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
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const documentNumber = document.getElementById('documentNumber').value;
        const issueDate = document.getElementById('issueDate').value;
        const dueDate = document.getElementById('dueDate').value;
        const notes = document.getElementById('notes').value;
        
        const { subtotal, taxAmount, total, taxRate } = this.calculateTotals();
        const documentTitle = this.documentType.charAt(0).toUpperCase() + this.documentType.slice(1);
        
        // Set vibrant color scheme
        doc.setTextColor(44, 62, 80);  // Dark blue-gray text
        doc.setDrawColor(52, 152, 219);  // Blue borders
        
        // Add business logo if available
        let logoHeight = 0;
        if (this.businessSettings.logo_url) {
            try {
                const logoData = await this.loadImageAsBase64(this.businessSettings.logo_url);
                if (logoData) {
                    // Add logo (max width 40, max height 20)
                    const logoWidth = 40;
                    const logoHeightCalc = 20;
                    doc.addImage(logoData, 'PNG', 20, 10, logoWidth, logoHeightCalc);
                    logoHeight = logoHeightCalc + 5;
                }
            } catch (error) {
                console.warn('Could not load logo:', error);
            }
        }
        
        // Modern header design
        const businessNameY = Math.max(30, 15 + logoHeight);
        
        // Clean header with subtle background
        doc.setFillColor(248, 249, 250);
        doc.rect(15, businessNameY - 12, 180, 20, 'F');
        doc.setDrawColor(220, 221, 225);
        doc.setLineWidth(0.5);
        doc.rect(15, businessNameY - 12, 180, 20, 'D');
        
        // Business name with professional typography
        doc.setTextColor(33, 37, 41);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(this.businessSettings.business_name, 20, businessNameY);
        
        // Document title with elegant styling
        doc.setTextColor(108, 117, 125);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(documentTitle.toUpperCase(), 190, businessNameY, { align: 'right' });
        
        // Document number with emphasis
        doc.setTextColor(220, 53, 69);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(documentNumber, 190, businessNameY + 6, { align: 'right' });
        
        // Reset font
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        // Business information section with organized layout
        let yPos = businessNameY + 20;
        doc.setTextColor(73, 80, 87);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        // Business details in clean format
        if (this.businessSettings.address) {
            const addressLines = this.businessSettings.address.split('\n');
            addressLines.forEach(line => {
                doc.text(line.trim(), 20, yPos);
                yPos += 4;
            });
        }
        if (this.businessSettings.email) {
            doc.text(this.businessSettings.email, 20, yPos);
            yPos += 4;
        }
        if (this.businessSettings.phone) {
            doc.text(this.businessSettings.phone, 20, yPos);
            yPos += 4;
        }
        
        // Elegant separator line
        const lineY = Math.max(70, yPos + 8);
        doc.setDrawColor(220, 221, 225);
        doc.setLineWidth(1);
        doc.line(20, lineY, 190, lineY);
        
        // Client information with professional styling
        yPos = lineY + 12;
        
        // Bill To section header
        doc.setFillColor(248, 249, 250);
        doc.rect(20, yPos - 3, 80, 8, 'F');
        doc.setTextColor(33, 37, 41);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('BILL TO', 22, yPos + 2);
        yPos += 12;
        
        // Client details with consistent formatting
        doc.setTextColor(73, 80, 87);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(this.selectedClient.name, 20, yPos);
        yPos += 5;
        
        doc.setFont('helvetica', 'normal');
        if (this.selectedClient.company) {
            doc.text(this.selectedClient.company, 20, yPos);
            yPos += 4;
        }
        if (this.selectedClient.address) {
            const clientAddressLines = this.selectedClient.address.split('\n');
            clientAddressLines.forEach(line => {
                doc.text(line.trim(), 20, yPos);
                yPos += 4;
            });
        }
        if (this.selectedClient.email) {
            doc.text(this.selectedClient.email, 20, yPos);
            yPos += 4;
        }
        if (this.selectedClient.phone) {
            doc.text(this.selectedClient.phone, 20, yPos);
        }
        
        // Date information with aligned layout
        let dateY = lineY + 12;
        
        // Date section styling
        doc.setFillColor(248, 249, 250);
        doc.rect(130, dateY - 3, 60, 20, 'F');
        
        doc.setTextColor(73, 80, 87);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        
        if (issueDate) {
            doc.text('DATE:', 132, dateY + 2);
            doc.setFont('helvetica', 'normal');
            doc.text(formatDate(issueDate), 165, dateY + 2, { align: 'left' });
            dateY += 6;
        }
        if (dueDate) {
            doc.setFont('helvetica', 'bold');
            doc.text('DUE DATE:', 132, dateY + 2);
            doc.setFont('helvetica', 'normal');
            doc.text(formatDate(dueDate), 165, dateY + 2, { align: 'left' });
        }
        
        // Modern table system with precise measurements
        const tableStartY = Math.max(110, yPos + 20);
        const tableX = 20;
        const tableWidth = 170;
        const rowHeight = 10;
        
        // Fixed table layout with precise column widths
        const cols = {
            desc: { x: tableX, w: 80 },
            qty: { x: tableX + 80, w: 25 },
            price: { x: tableX + 105, w: 35 },
            total: { x: tableX + 140, w: 30 }
        };
        
        // Helper function for proper number formatting with fixed widths
        const formatNumberForTable = (value, isQuantity = false) => {
            if (isQuantity) {
                return parseFloat(value).toLocaleString('en-US', { 
                    minimumFractionDigits: 0, 
                    maximumFractionDigits: 2 
                });
            } else {
                // Currency formatting
                const numericValue = parseFloat(value);
                const symbol = this.businessSettings?.currency_symbol || '$';
                return symbol + numericValue.toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                });
            }
        };
        
        // Helper function to fit text with proper truncation
        const fitTextInColumn = (text, maxWidth, fontSize = 9) => {
            doc.setFontSize(fontSize);
            let fitted = text.toString();
            while (doc.getTextWidth(fitted) > maxWidth - 4 && fitted.length > 1) {
                fitted = fitted.slice(0, -1);
            }
            if (fitted !== text.toString() && fitted.length > 3) {
                fitted = fitted.slice(0, -3) + '...';
            }
            return fitted;
        };
        
        // Bold table header with fixed grid
        doc.setFillColor(33, 37, 41);  // Dark header
        doc.rect(tableX, tableStartY - 12, tableWidth, 12, 'F');
        
        // Strong column borders
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1);
        doc.line(cols.qty.x, tableStartY - 12, cols.qty.x, tableStartY);
        doc.line(cols.price.x, tableStartY - 12, cols.price.x, tableStartY);
        doc.line(cols.total.x, tableStartY - 12, cols.total.x, tableStartY);
        
        // Bold header text with better positioning
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('DESCRIPTION', cols.desc.x + 3, tableStartY - 4);
        doc.text('QTY', cols.qty.x + cols.qty.w - 3, tableStartY - 4, { align: 'right' });
        doc.text('UNIT PRICE', cols.price.x + cols.price.w - 3, tableStartY - 4, { align: 'right' });
        doc.text('AMOUNT', cols.total.x + cols.total.w - 3, tableStartY - 4, { align: 'right' });
        
        // Draw data rows
        doc.setFont(undefined, 'normal');
        let rowY = tableStartY + 2;
        
        this.items.forEach((item, index) => {
            // Strong alternating row backgrounds
            if (index % 2 === 0) {
                doc.setFillColor(248, 249, 250);
                doc.rect(tableX, rowY, tableWidth, rowHeight, 'F');
            }
            
            // Strong grid borders
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.5);
            doc.rect(tableX, rowY, tableWidth, rowHeight, 'D');
            
            // Bold column separators
            doc.setLineWidth(1);
            doc.line(cols.qty.x, rowY, cols.qty.x, rowY + rowHeight);
            doc.line(cols.price.x, rowY, cols.price.x, rowY + rowHeight);
            doc.line(cols.total.x, rowY, cols.total.x, rowY + rowHeight);
            
            const textY = rowY + 7;
            doc.setTextColor(33, 37, 41);
            
            // Description with bold font
            const desc = fitTextInColumn(item.description || '-', cols.desc.w);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(desc, cols.desc.x + 3, textY);
            
            // Quantity - right aligned with bold formatting
            const qtyFormatted = formatNumberForTable(item.quantity, true);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(qtyFormatted, cols.qty.x + cols.qty.w - 3, textY, { align: 'right' });
            
            // Price - right aligned with bold currency formatting
            const priceFormatted = formatNumberForTable(item.unit_price);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(priceFormatted, cols.price.x + cols.price.w - 3, textY, { align: 'right' });
            
            // Total - right aligned with strong emphasis
            const totalFormatted = formatNumberForTable(item.quantity * item.unit_price);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(220, 53, 69);  // Red color for emphasis
            doc.text(totalFormatted, cols.total.x + cols.total.w - 3, textY, { align: 'right' });
            
            rowY += rowHeight;
        });
        
        // Professional totals section
        const totalsStartY = rowY + 15;
        const totalsWidth = 55;
        const totalsX = tableX + tableWidth - totalsWidth;
        
        doc.setTextColor(73, 80, 87);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        // Subtotal row with proper formatting
        let currentTotalY = totalsStartY;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Subtotal:', totalsX, currentTotalY);
        const subtotalFormatted = formatNumberForTable(subtotal);
        doc.text(subtotalFormatted, totalsX + totalsWidth - 2, currentTotalY, { align: 'right' });
        
        // Tax row if applicable
        if (taxRate > 0) {
            currentTotalY += 7;
            doc.text(`Tax (${taxRate}%):`, totalsX, currentTotalY);
            const taxFormatted = formatNumberForTable(taxAmount);
            doc.text(taxFormatted, totalsX + totalsWidth - 2, currentTotalY, { align: 'right' });
        }
        
        // Total separator line
        currentTotalY += 10;
        doc.setDrawColor(33, 37, 41);
        doc.setLineWidth(2);
        doc.line(totalsX, currentTotalY - 3, totalsX + totalsWidth, currentTotalY - 3);
        
        // Final total with strong emphasis
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(220, 53, 69);
        doc.text('TOTAL:', totalsX, currentTotalY + 3);
        const finalTotalFormatted = formatNumberForTable(total);
        doc.text(finalTotalFormatted, totalsX + totalsWidth - 2, currentTotalY + 3, { align: 'right' });
        
        // Reset text color
        doc.setTextColor(33, 37, 41);
        
        // Update currentY for subsequent elements
        let currentY = currentTotalY + 15;
        
        // Notes
        if (notes) {
            currentY += 20;
            doc.setFont(undefined, 'bold');
            doc.text('Notes:', 20, currentY);
            doc.setFont(undefined, 'normal');
            
            const noteLines = notes.split('\n');
            noteLines.forEach(line => {
                currentY += 8;
                doc.text(line, 20, currentY);
            });
        }
        
        // Add signature if available
        if (this.businessSettings.signature_url) {
            try {
                const signatureData = await this.loadImageAsBase64(this.businessSettings.signature_url);
                if (signatureData) {
                    // Add signature (max width 60, max height 30)
                    const signatureWidth = 60;
                    const signatureHeight = 30;
                    const signatureY = Math.max(currentY + 20, doc.internal.pageSize.height - 50);
                    
                    doc.addImage(signatureData, 'PNG', 20, signatureY, signatureWidth, signatureHeight);
                    
                    // Add signature label
                    doc.setFontSize(8);
                    doc.text('Authorized Signature', 20, signatureY + signatureHeight + 5);
                }
            } catch (error) {
                console.warn('Could not load signature:', error);
            }
        }
        
        // Save PDF
        const filename = `${documentNumber}.pdf`;
        doc.save(filename);
        
        showAlert('PDF generated successfully!', 'success');
    }
    
    async loadImageAsBase64(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                ctx.drawImage(img, 0, 0);
                
                try {
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
            
            img.src = url;
        });
    }
    
    async saveDocument(e) {
        e.preventDefault();
        
        console.log('Save document called');
        console.log('Document type:', this.documentType);
        console.log('Selected client:', this.selectedClient);
        console.log('Items:', this.items);
        
        // Validate document type and client
        if (!this.documentType) {
            showAlert('Please select a document type', 'warning');
            return;
        }
        
        if (!this.selectedClient || !this.selectedClient.id) {
            showAlert('Please select a client', 'warning');
            return;
        }
        
        // Update items from current form state
        this.updateItemIndices();
        
        // Validate items
        if (this.items.length === 0 || !this.items.some(item => item.description.trim())) {
            showAlert('Please add at least one item with a description', 'warning');
            return;
        }
        
        const formData = {
            document_type: this.documentType,
            client_id: parseInt(this.selectedClient.id),
            issue_date: document.getElementById('issueDate').value,
            due_date: document.getElementById('dueDate').value || null,
            notes: document.getElementById('notes').value || '',
            status: 'draft',
            items: this.items.filter(item => item.description.trim()) // Only include items with descriptions
        };
        
        console.log('Sending form data:', formData);
        
        try {
            const response = await fetch('/api/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            console.log('Server response:', result);
            
            if (result.success) {
                showAlert(`${this.documentType.charAt(0).toUpperCase() + this.documentType.slice(1)} saved successfully! Document number: ${result.document_number}`, 'success');
                
                // Reset form after a delay
                setTimeout(() => {
                    document.getElementById('documentForm').reset();
                    document.getElementById('itemsContainer').innerHTML = '';
                    this.items = [];
                    this.selectedClient = null;
                    this.documentType = '';
                    document.getElementById('documentType').value = '';
                    document.getElementById('clientSelect').value = '';
                    this.addInitialItem();
                    this.updatePreview();
                }, 2000);
            } else {
                showAlert('Error saving document: ' + (result.error || result.message || 'Unknown error'), 'danger');
            }
        } catch (error) {
            console.error('Error saving document:', error);
            showAlert('Error saving document: ' + error.message, 'danger');
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
