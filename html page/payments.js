// ========== PAYMENTS.JS - COMPLETE WORKING VERSION ==========

let currentUser = null;
let currentPaymentId = null;
let paymentsData = [];

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Payments page loaded');
    
    // Check authentication
    const user = await checkAuth();
    if (!user) return;
    
    currentUser = user;
    
    // Display user info
    document.getElementById('userName').textContent = user.user_metadata?.full_name || 'Landlord';
    document.getElementById('userEmail').textContent = user.email;
    
    // Set current date for date inputs
    setDefaultDates();
    
    // Load tenants for dropdown
    await loadTenants();
    
    // Load payments
    await loadPayments();
    
    // Load payment summary
    await loadPaymentSummary();
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await logout();
    });
    
    // Setup form submission
    setupPaymentForm();
});

// Set default dates for payment form
function setDefaultDates() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const formattedToday = `${yyyy}-${mm}-${dd}`;
    
    const paymentDate = document.getElementById('payment-date');
    const dueDate = document.getElementById('payment-due-date');
    
    if (paymentDate) paymentDate.value = formattedToday;
    if (dueDate) {
        // Default due date to first of current month
        const firstOfMonth = `${yyyy}-${mm}-01`;
        dueDate.value = firstOfMonth;
    }
}

// Load tenants for dropdown
async function loadTenants() {
    try {
        const { data: tenants, error } = await supabaseClient
            .from('tenants')
            .select(`
                id,
                first_name,
                last_name,
                monthly_rent,
                property_id,
                properties (
                    id,
                    name
                )
            `)
            .eq('landlord_id', currentUser.id)
            .eq('status', 'active');
        
        if (error) throw error;
        
        const select = document.getElementById('payment-tenant');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Select a tenant --</option>';
        
        if (tenants && tenants.length > 0) {
            tenants.forEach(tenant => {
                const option = document.createElement('option');
                option.value = tenant.id;
                option.dataset.rent = tenant.monthly_rent;
                option.dataset.propertyId = tenant.property_id;
                option.dataset.propertyName = tenant.properties?.name || 'Unknown';
                option.textContent = `${tenant.first_name} ${tenant.last_name} - $${tenant.monthly_rent}/mo`;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">No active tenants found</option>';
        }
        
    } catch (error) {
        console.error('Error loading tenants:', error);
        showError('Failed to load tenants');
    }
}

// Load tenant details when selected
function loadTenantDetails() {
    const select = document.getElementById('payment-tenant');
    const selectedOption = select.options[select.selectedIndex];
    const propertyInput = document.getElementById('payment-property');
    const amountInput = document.getElementById('payment-amount');
    
    if (selectedOption && selectedOption.value) {
        const propertyName = selectedOption.dataset.propertyName || 'Unknown';
        propertyInput.value = propertyName;
        
        // Pre-fill amount with monthly rent
        const monthlyRent = parseFloat(selectedOption.dataset.rent) || 0;
        amountInput.value = monthlyRent;
    } else {
        propertyInput.value = '';
        amountInput.value = '';
    }
}

// Toggle late fee field based on status
function toggleLateFee() {
    const status = document.getElementById('payment-status').value;
    const lateFeeGroup = document.getElementById('late-fee-group');
    
    if (lateFeeGroup) {
        lateFeeGroup.style.display = status === 'late' ? 'block' : 'none';
    }
}

// Setup payment form submission
function setupPaymentForm() {
    const form = document.getElementById('payment-form');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('save-payment-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        
        // Show loading
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline';
        submitBtn.disabled = true;
        
        try {
            // Get form values
            const tenantId = document.getElementById('payment-tenant').value;
            const amount = parseFloat(document.getElementById('payment-amount').value);
            const method = document.getElementById('payment-method').value;
            const paymentDate = document.getElementById('payment-date').value;
            const dueDate = document.getElementById('payment-due-date').value;
            const status = document.getElementById('payment-status').value;
            const lateFee = parseFloat(document.getElementById('payment-late-fee')?.value || 0);
            const notes = document.getElementById('payment-notes').value;
            const receiptUrl = document.getElementById('payment-receipt').value;
            
            // Validate
            if (!tenantId) {
                showError('Please select a tenant');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!amount || amount <= 0) {
                showError('Please enter a valid amount');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!method) {
                showError('Please select a payment method');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!paymentDate || !dueDate) {
                showError('Please select payment and due dates');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            // Get tenant details to get property_id
            const tenantSelect = document.getElementById('payment-tenant');
            const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
            const propertyId = selectedOption.dataset.propertyId;
            
            if (!propertyId) {
                showError('Could not determine property for this tenant');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            const paymentId = document.getElementById('payment-id').value;
            
            let result;
            
            if (paymentId) {
                // Update existing payment
                result = await supabaseClient
                    .from('payments')
                    .update({
                        tenant_id: tenantId,
                        property_id: propertyId,
                        amount: amount,
                        payment_method: method,
                        payment_date: paymentDate,
                        due_date: dueDate,
                        status: status,
                        late_fee: lateFee,
                        notes: notes,
                        receipt_url: receiptUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', paymentId)
                    .eq('landlord_id', currentUser.id);
            } else {
                // Create new payment
                result = await supabaseClient
                    .from('payments')
                    .insert([{
                        landlord_id: currentUser.id,
                        tenant_id: tenantId,
                        property_id: propertyId,
                        amount: amount,
                        payment_method: method,
                        payment_date: paymentDate,
                        due_date: dueDate,
                        status: status,
                        late_fee: lateFee,
                        notes: notes,
                        receipt_url: receiptUrl
                    }]);
            }
            
            if (result.error) throw result.error;
            
            showSuccess(paymentId ? 'Payment updated successfully!' : 'Payment recorded successfully!');
            
            // Close modal and refresh
            closePaymentModal();
            await loadPayments();
            await loadPaymentSummary();
            
        } catch (error) {
            console.error('Error saving payment:', error);
            showError(error.message || 'Failed to save payment');
        } finally {
            resetButton(submitBtn, btnText, btnLoader);
        }
    });
}

// Load payments
async function loadPayments() {
    try {
        const { data: payments, error } = await supabaseClient
            .from('payments')
            .select(`
                *,
                tenants (
                    first_name,
                    last_name
                ),
                properties (
                    name
                )
            `)
            .eq('landlord_id', currentUser.id)
            .order('payment_date', { ascending: false });
        
        if (error) throw error;
        
        paymentsData = payments || [];
        displayPayments(paymentsData);
        
    } catch (error) {
        console.error('Error loading payments:', error);
        showError('Failed to load payments');
        document.getElementById('payments-list').innerHTML = `
            <tr>
                <td colspan="8" class="error-message">Error loading payments: ${error.message}</td>
            </tr>
        `;
    }
}

// Display payments in table
function displayPayments(payments) {
    const tbody = document.getElementById('payments-list');
    
    if (!payments || payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">No payments found. Click "Record Payment" to add one.</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = payments.map(payment => {
        const paymentDate = new Date(payment.payment_date).toLocaleDateString();
        const dueDate = new Date(payment.due_date).toLocaleDateString();
        const tenantName = payment.tenants ? 
            `${payment.tenants.first_name} ${payment.tenants.last_name}` : 
            'Unknown Tenant';
        const propertyName = payment.properties?.name || 'Unknown Property';
        
        return `
            <tr>
                <td>${paymentDate}</td>
                <td>${tenantName}</td>
                <td>${propertyName}</td>
                <td>$${payment.amount.toFixed(2)}</td>
                <td>${formatPaymentMethod(payment.payment_method)}</td>
                <td><span class="status-badge status-${payment.status}">${payment.status}</span></td>
                <td>${dueDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" onclick="viewPayment('${payment.id}')" title="View">👁️</button>
                        <button class="action-btn edit" onclick="editPayment('${payment.id}')" title="Edit">✏️</button>
                        ${payment.status !== 'paid' ? 
                            `<button class="action-btn reminder" onclick="openReminderModal('${payment.id}')" title="Send Reminder">📧</button>` : 
                            ''}
                        <button class="action-btn delete" onclick="confirmDelete('${payment.id}')" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Format payment method for display
function formatPaymentMethod(method) {
    const methods = {
        'cash': 'Cash',
        'check': 'Check',
        'bank_transfer': 'Bank Transfer',
        'credit_card': 'Credit Card',
        'venmo': 'Venmo',
        'paypal': 'PayPal',
        'zelle': 'Zelle'
    };
    return methods[method] || method || 'N/A';
}

// Load payment summary
async function loadPaymentSummary() {
    try {
        const { data, error } = await supabaseClient
            .rpc('get_payment_summary', { landlord_id: currentUser.id });
        
        if (error) {
            console.error('RPC error, calculating manually:', error);
            await calculatePaymentSummaryManually();
            return;
        }
        
        if (data && data.length > 0) {
            const summary = data[0];
            document.getElementById('total-collected').textContent = 
                `$${summary.total_collected?.toFixed(2) || '0'}`;
            document.getElementById('pending-amount').textContent = 
                `$${summary.pending_amount?.toFixed(2) || '0'}`;
            document.getElementById('late-count').textContent = 
                summary.late_count || '0';
            document.getElementById('collection-rate').textContent = 
                `${summary.collection_rate?.toFixed(1) || '0'}%`;
        }
        
    } catch (error) {
        console.error('Error loading payment summary:', error);
        await calculatePaymentSummaryManually();
    }
}

// Manual calculation if RPC fails
async function calculatePaymentSummaryManually() {
    try {
        const { data: payments, error } = await supabaseClient
            .from('payments')
            .select('*')
            .eq('landlord_id', currentUser.id);
        
        if (error) throw error;
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        let totalCollected = 0;
        let pendingAmount = 0;
        let lateCount = 0;
        let paidCount = 0;
        
        payments.forEach(payment => {
            const paymentDate = new Date(payment.payment_date);
            if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
                if (payment.status === 'paid') {
                    totalCollected += payment.amount;
                    paidCount++;
                } else if (payment.status === 'pending' || payment.status === 'partial') {
                    pendingAmount += payment.amount;
                }
            }
            
            if (payment.status === 'late') {
                lateCount++;
            }
        });
        
        const totalPayments = payments.length;
        const collectionRate = totalPayments > 0 ? (paidCount / totalPayments) * 100 : 0;
        
        document.getElementById('total-collected').textContent = `$${totalCollected.toFixed(2)}`;
        document.getElementById('pending-amount').textContent = `$${pendingAmount.toFixed(2)}`;
        document.getElementById('late-count').textContent = lateCount;
        document.getElementById('collection-rate').textContent = `${collectionRate.toFixed(1)}%`;
        
    } catch (error) {
        console.error('Manual calculation error:', error);
    }
}

// Filter payments
function filterPayments() {
    const searchTerm = document.getElementById('search-payment')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('status-filter')?.value || 'all';
    const monthFilter = document.getElementById('month-filter')?.value || '';
    const yearFilter = document.getElementById('year-filter')?.value || '';
    
    const filtered = paymentsData.filter(payment => {
        // Search filter
        const tenantName = payment.tenants ? 
            `${payment.tenants.first_name} ${payment.tenants.last_name}`.toLowerCase() : '';
        const propertyName = payment.properties?.name?.toLowerCase() || '';
        const matchesSearch = searchTerm === '' || 
            tenantName.includes(searchTerm) || 
            propertyName.includes(searchTerm);
        
        // Status filter
        const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
        
        // Date filters
        let matchesDate = true;
        if (monthFilter || yearFilter) {
            const paymentDate = new Date(payment.payment_date);
            const paymentMonth = String(paymentDate.getMonth() + 1).padStart(2, '0');
            const paymentYear = paymentDate.getFullYear().toString();
            
            if (monthFilter && paymentMonth !== monthFilter) matchesDate = false;
            if (yearFilter && paymentYear !== yearFilter) matchesDate = false;
        }
        
        return matchesSearch && matchesStatus && matchesDate;
    });
    
    displayPayments(filtered);
}

// Open payment modal for new payment
function openPaymentModal() {
    document.getElementById('modal-title').textContent = 'Record Payment';
    document.getElementById('payment-id').value = '';
    document.getElementById('payment-form').reset();
    document.getElementById('late-fee-group').style.display = 'none';
    setDefaultDates();
    document.getElementById('payment-modal').classList.add('active');
}

// Close payment modal
function closePaymentModal() {
    document.getElementById('payment-modal').classList.remove('active');
    document.getElementById('payment-form').reset();
}

// View payment details
async function viewPayment(paymentId) {
    try {
        const { data: payment, error } = await supabaseClient
            .from('payments')
            .select(`
                *,
                tenants (
                    first_name,
                    last_name,
                    email,
                    phone
                ),
                properties (
                    name,
                    address
                )
            `)
            .eq('id', paymentId)
            .single();
        
        if (error) throw error;
        
        const content = document.getElementById('payment-details-content');
        content.innerHTML = `
            <div class="payment-summary">
                <div class="payment-summary-item">
                    <span class="payment-summary-label">Tenant:</span>
                    <span class="payment-summary-value">${payment.tenants?.first_name} ${payment.tenants?.last_name}</span>
                </div>
                <div class="payment-summary-item">
                    <span class="payment-summary-label">Property:</span>
                    <span class="payment-summary-value">${payment.properties?.name || 'N/A'}</span>
                </div>
                <div class="payment-summary-item">
                    <span class="payment-summary-label">Amount:</span>
                    <span class="payment-summary-value">$${payment.amount.toFixed(2)}</span>
                </div>
                <div class="payment-summary-item">
                    <span class="payment-summary-label">Payment Date:</span>
                    <span class="payment-summary-value">${new Date(payment.payment_date).toLocaleDateString()}</span>
                </div>
                <div class="payment-summary-item">
                    <span class="payment-summary-label">Due Date:</span>
                    <span class="payment-summary-value">${new Date(payment.due_date).toLocaleDateString()}</span>
                </div>
                <div class="payment-summary-item">
                    <span class="payment-summary-label">Method:</span>
                    <span class="payment-summary-value">${formatPaymentMethod(payment.payment_method)}</span>
                </div>
                <div class="payment-summary-item">
                    <span class="payment-summary-label">Status:</span>
                    <span class="payment-summary-value"><span class="status-badge status-${payment.status}">${payment.status}</span></span>
                </div>
                ${payment.late_fee ? `
                <div class="payment-summary-item">
                    <span class="payment-summary-label">Late Fee:</span>
                    <span class="payment-summary-value">$${payment.late_fee.toFixed(2)}</span>
                </div>
                ` : ''}
                ${payment.notes ? `
                <div class="payment-summary-item">
                    <span class="payment-summary-label">Notes:</span>
                    <span class="payment-summary-value">${payment.notes}</span>
                </div>
                ` : ''}
                ${payment.receipt_url ? `
                <div class="payment-summary-item">
                    <span class="payment-summary-label">Receipt:</span>
                    <span class="payment-summary-value"><a href="${payment.receipt_url}" target="_blank">View Receipt</a></span>
                </div>
                ` : ''}
            </div>
        `;
        
        currentPaymentId = paymentId;
        document.getElementById('view-payment-modal').classList.add('active');
        
    } catch (error) {
        console.error('Error viewing payment:', error);
        showError('Failed to load payment details');
    }
}

// Close view modal
function closeViewModal() {
    document.getElementById('view-payment-modal').classList.remove('active');
    currentPaymentId = null;
}

// Edit payment
async function editPayment(paymentId) {
    try {
        const { data: payment, error } = await supabaseClient
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();
        
        if (error) throw error;
        
        // Fill form with payment data
        document.getElementById('modal-title').textContent = 'Edit Payment';
        document.getElementById('payment-id').value = payment.id;
        
        // Set tenant (need to wait for tenants to load first)
        await loadTenants();
        document.getElementById('payment-tenant').value = payment.tenant_id;
        loadTenantDetails();
        
        document.getElementById('payment-amount').value = payment.amount;
        document.getElementById('payment-method').value = payment.payment_method || '';
        document.getElementById('payment-date').value = payment.payment_date;
        document.getElementById('payment-due-date').value = payment.due_date;
        document.getElementById('payment-status').value = payment.status;
        
        if (payment.late_fee) {
            document.getElementById('payment-late-fee').value = payment.late_fee;
            document.getElementById('late-fee-group').style.display = payment.status === 'late' ? 'block' : 'none';
        }
        
        document.getElementById('payment-notes').value = payment.notes || '';
        document.getElementById('payment-receipt').value = payment.receipt_url || '';
        
        document.getElementById('payment-modal').classList.add('active');
        
    } catch (error) {
        console.error('Error loading payment for edit:', error);
        showError('Failed to load payment details');
    }
}

// Edit from view modal
function editPaymentFromView() {
    closeViewModal();
    if (currentPaymentId) {
        editPayment(currentPaymentId);
    }
}

// Confirm delete
function confirmDelete(paymentId) {
    currentPaymentId = paymentId;
    document.getElementById('delete-modal').classList.add('active');
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    currentPaymentId = null;
}

// Delete payment