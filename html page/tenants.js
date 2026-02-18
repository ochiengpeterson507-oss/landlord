// ========== TENANTS.JS - COMPLETE WORKING VERSION ==========

let currentUser = null;
let currentTenantId = null;
let tenantsData = [];
let propertiesData = [];

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Tenants page loaded');
    
    // Check authentication
    const user = await checkAuth();
    if (!user) return;
    
    currentUser = user;
    
    // Display user info
    document.getElementById('userName').textContent = user.user_metadata?.full_name || 'Landlord';
    document.getElementById('userEmail').textContent = user.email;
    
    // Load properties for dropdown
    await loadProperties();
    
    // Load tenants
    await loadTenants();
    
    // Load tenant summary
    await loadTenantSummary();
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await logout();
    });
    
    // Setup form submission
    setupTenantForm();
    
    // Setup renewal form
    setupRenewalForm();
});

// Load properties for dropdown
async function loadProperties() {
    try {
        const { data: properties, error } = await supabaseClient
            .from('properties')
            .select('id, name, monthly_rent, address')
            .eq('landlord_id', currentUser.id)
            .order('name');
        
        if (error) throw error;
        
        propertiesData = properties || [];
        
        // Populate property dropdown in tenant form
        const propertySelect = document.getElementById('tenant-property');
        if (propertySelect) {
            propertySelect.innerHTML = '<option value="">-- Select a property --</option>';
            
            if (properties && properties.length > 0) {
                properties.forEach(property => {
                    const option = document.createElement('option');
                    option.value = property.id;
                    option.dataset.rent = property.monthly_rent || 0;
                    option.textContent = `${property.name} - $${property.monthly_rent || 0}/mo`;
                    propertySelect.appendChild(option);
                });
            }
        }
        
        // Populate property filter dropdown
        const propertyFilter = document.getElementById('property-filter');
        if (propertyFilter) {
            propertyFilter.innerHTML = '<option value="all">All Properties</option>';
            
            if (properties && properties.length > 0) {
                properties.forEach(property => {
                    const option = document.createElement('option');
                    option.value = property.id;
                    option.textContent = property.name;
                    propertyFilter.appendChild(option);
                });
            }
        }
        
    } catch (error) {
        console.error('Error loading properties:', error);
        showError('Failed to load properties');
    }
}

// Update monthly rent when property is selected
function updatePropertyRent() {
    const propertySelect = document.getElementById('tenant-property');
    const selectedOption = propertySelect.options[propertySelect.selectedIndex];
    const rentInput = document.getElementById('tenant-monthly-rent');
    
    if (selectedOption && selectedOption.value) {
        const monthlyRent = selectedOption.dataset.rent || 0;
        rentInput.value = monthlyRent;
    }
}

// Toggle pet details field
function togglePetDetails() {
    const hasPets = document.getElementById('tenant-pets').checked;
    const petDetailsGroup = document.getElementById('pet-details-group');
    
    if (petDetailsGroup) {
        petDetailsGroup.style.display = hasPets ? 'block' : 'none';
    }
}

// Setup tenant form submission
function setupTenantForm() {
    const form = document.getElementById('tenant-form');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('save-tenant-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        
        // Show loading
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline';
        submitBtn.disabled = true;
        
        try {
            // Get form values
            const firstName = document.getElementById('tenant-firstname').value.trim();
            const lastName = document.getElementById('tenant-lastname').value.trim();
            const email = document.getElementById('tenant-email').value.trim();
            const phone = document.getElementById('tenant-phone').value.trim();
            const propertyId = document.getElementById('tenant-property').value;
            const leaseStart = document.getElementById('tenant-lease-start').value;
            const leaseEnd = document.getElementById('tenant-lease-end').value;
            const monthlyRent = parseFloat(document.getElementById('tenant-monthly-rent').value);
            const deposit = parseFloat(document.getElementById('tenant-deposit').value) || 0;
            const emergencyContact = document.getElementById('tenant-emergency-contact').value.trim();
            const emergencyPhone = document.getElementById('tenant-emergency-phone').value.trim();
            const hasPets = document.getElementById('tenant-pets').checked;
            const petDetails = document.getElementById('tenant-pet-details').value.trim();
            const notes = document.getElementById('tenant-notes').value.trim();
            const status = document.getElementById('tenant-status').value;
            
            // Validate
            if (!firstName || !lastName) {
                showError('Please enter tenant name');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!email) {
                showError('Please enter email address');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!phone) {
                showError('Please enter phone number');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!propertyId) {
                showError('Please select a property');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!leaseStart || !leaseEnd) {
                showError('Please select lease dates');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (new Date(leaseEnd) <= new Date(leaseStart)) {
                showError('Lease end date must be after start date');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!monthlyRent || monthlyRent <= 0) {
                showError('Please enter a valid monthly rent');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            const tenantId = document.getElementById('tenant-id').value;
            
            // Prepare tenant data
            const tenantData = {
                landlord_id: currentUser.id,
                property_id: propertyId,
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                emergency_contact: emergencyContact || null,
                emergency_phone: emergencyPhone || null,
                lease_start: leaseStart,
                lease_end: leaseEnd,
                monthly_rent: monthlyRent,
                security_deposit: deposit,
                pets: hasPets,
                pet_details: hasPets ? petDetails : null,
                notes: notes || null,
                status: status
            };
            
            let result;
            
            if (tenantId) {
                // Update existing tenant
                result = await supabaseClient
                    .from('tenants')
                    .update(tenantData)
                    .eq('id', tenantId)
                    .eq('landlord_id', currentUser.id);
            } else {
                // Create new tenant
                result = await supabaseClient
                    .from('tenants')
                    .insert([tenantData]);
            }
            
            if (result.error) throw result.error;
            
            showSuccess(tenantId ? 'Tenant updated successfully!' : 'Tenant added successfully!');
            
            // Close modal and refresh
            closeTenantModal();
            await loadTenants();
            await loadTenantSummary();
            
        } catch (error) {
            console.error('Error saving tenant:', error);
            showError(error.message || 'Failed to save tenant');
        } finally {
            resetButton(submitBtn, btnText, btnLoader);
        }
    });
}

// Load tenants
async function loadTenants() {
    try {
        const { data: tenants, error } = await supabaseClient
            .from('tenants')
            .select(`
                *,
                properties (
                    id,
                    name,
                    address
                )
            `)
            .eq('landlord_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        tenantsData = tenants || [];
        displayTenants(tenantsData);
        
    } catch (error) {
        console.error('Error loading tenants:', error);
        showError('Failed to load tenants');
        document.getElementById('tenants-list').innerHTML = `
            <tr>
                <td colspan="8" class="error-message">Error loading tenants: ${error.message}</td>
            </tr>
        `;
    }
}

// Display tenants in table
function displayTenants(tenants) {
    const tbody = document.getElementById('tenants-list');
    
    if (!tenants || tenants.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">No tenants found. Click "Add Tenant" to add one.</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = tenants.map(tenant => {
        const fullName = `${tenant.first_name} ${tenant.last_name}`;
        const propertyName = tenant.properties?.name || 'Unknown Property';
        const leaseStart = new Date(tenant.lease_start).toLocaleDateString();
        const leaseEnd = new Date(tenant.lease_end).toLocaleDateString();
        const leaseStatus = getLeaseStatus(tenant.lease_start, tenant.lease_end);
        
        return `
            <tr>
                <td>
                    <strong>${fullName}</strong>
                    ${tenant.pets ? '<span class="pets-badge">🐾 Pets</span>' : ''}
                </td>
                <td>${propertyName}</td>
                <td>${tenant.email}</td>
                <td>${tenant.phone}</td>
                <td>
                    ${leaseStart} - ${leaseEnd}
                    <br>
                    <span class="lease-badge ${leaseStatus.class}">${leaseStatus.text}</span>
                </td>
                <td><strong>$${tenant.monthly_rent.toFixed(2)}</strong></td>
                <td><span class="tenant-status ${tenant.status}">${tenant.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" onclick="viewTenant('${tenant.id}')" title="View">👁️</button>
                        <button class="action-btn edit" onclick="editTenant('${tenant.id}')" title="Edit">✏️</button>
                        <button class="action-btn payment" onclick="recordPayment('${tenant.id}')" title="Record Payment">💰</button>
                        ${isLeaseExpiringSoon(tenant.lease_end) ? 
                            `<button class="action-btn" style="background:#f59e0b;color:white;" onclick="renewLease('${tenant.id}')" title="Renew Lease">📅</button>` : 
                            ''}
                        <button class="action-btn delete" onclick="confirmDelete('${tenant.id}')" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Get lease status
function getLeaseStatus(startDate, endDate) {
    const today = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (today > end) {
        return { text: 'Expired', class: 'lease-expired' };
    }
    
    const daysUntilEnd = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilEnd <= 30) {
        return { text: 'Expiring Soon', class: 'lease-expiring-soon' };
    }
    
    return { text: 'Active', class: 'lease-valid' };
}

// Check if lease is expiring soon (within 30 days)
function isLeaseExpiringSoon(endDate) {
    const today = new Date();
    const end = new Date(endDate);
    const daysUntilEnd = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return daysUntilEnd <= 30 && daysUntilEnd > 0;
}

// Load tenant summary
async function loadTenantSummary() {
    try {
        const { data: tenants, error } = await supabaseClient
            .from('tenants')
            .select('status, monthly_rent')
            .eq('landlord_id', currentUser.id);
        
        if (error) throw error;
        
        const totalTenants = tenants.length;
        const activeTenants = tenants.filter(t => t.status === 'active').length;
        const pendingTenants = tenants.filter(t => t.status === 'pending').length;
        const totalMonthlyRent = tenants
            .filter(t => t.status === 'active')
            .reduce((sum, t) => sum + (t.monthly_rent || 0), 0);
        
        document.getElementById('total-tenants').textContent = totalTenants;
        document.getElementById('active-tenants').textContent = activeTenants;
        document.getElementById('pending-tenants').textContent = pendingTenants;
        document.getElementById('total-rent').textContent = `$${totalMonthlyRent.toFixed(2)}`;
        
    } catch (error) {
        console.error('Error loading tenant summary:', error);
    }
}

// Filter tenants
function filterTenants() {
    const searchTerm = document.getElementById('search-tenant')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('status-filter')?.value || 'all';
    const propertyFilter = document.getElementById('property-filter')?.value || 'all';
    
    const filtered = tenantsData.filter(tenant => {
        // Search filter
        const fullName = `${tenant.first_name} ${tenant.last_name}`.toLowerCase();
        const email = tenant.email.toLowerCase();
        const phone = tenant.phone.toLowerCase();
        const matchesSearch = searchTerm === '' || 
            fullName.includes(searchTerm) || 
            email.includes(searchTerm) || 
            phone.includes(searchTerm);
        
        // Status filter
        const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
        
        // Property filter
        const matchesProperty = propertyFilter === 'all' || tenant.property_id === propertyFilter;
        
        return matchesSearch && matchesStatus && matchesProperty;
    });
    
    displayTenants(filtered);
}

// Open tenant modal for new tenant
function openTenantModal() {
    document.getElementById('tenant-modal-title').textContent = 'Add Tenant';
    document.getElementById('tenant-id').value = '';
    document.getElementById('tenant-form').reset();
    document.getElementById('pet-details-group').style.display = 'none';
    
    // Set default dates
    const today = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(today.getFullYear() + 1);
    
    const formatDate = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };
    
    document.getElementById('tenant-lease-start').value = formatDate(today);
    document.getElementById('tenant-lease-end').value = formatDate(oneYearFromNow);
    
    document.getElementById('tenant-modal').classList.add('active');
}

// Close tenant modal
function closeTenantModal() {
    document.getElementById('tenant-modal').classList.remove('active');
    document.getElementById('tenant-form').reset();
}

// View tenant details
async function viewTenant(tenantId) {
    try {
        const { data: tenant, error } = await supabaseClient
            .from('tenants')
            .select(`
                *,
                properties (
                    name,
                    address
                )
            `)
            .eq('id', tenantId)
            .single();
        
        if (error) throw error;
        
        currentTenantId = tenantId;
        
        const content = document.getElementById('tenant-details-content');
        const leaseStatus = getLeaseStatus(tenant.lease_start, tenant.lease_end);
        
        content.innerHTML = `
            <div class="tenant-details-grid">
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Full Name</div>
                    <div class="tenant-detail-value">${tenant.first_name} ${tenant.last_name}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Status</div>
                    <div class="tenant-detail-value"><span class="tenant-status ${tenant.status}">${tenant.status}</span></div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Email</div>
                    <div class="tenant-detail-value">${tenant.email}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Phone</div>
                    <div class="tenant-detail-value">${tenant.phone}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Property</div>
                    <div class="tenant-detail-value">${tenant.properties?.name || 'N/A'}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Property Address</div>
                    <div class="tenant-detail-value">${tenant.properties?.address || 'N/A'}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Lease Period</div>
                    <div class="tenant-detail-value">
                        ${new Date(tenant.lease_start).toLocaleDateString()} - 
                        ${new Date(tenant.lease_end).toLocaleDateString()}
                        <br>
                        <span class="lease-badge ${leaseStatus.class}">${leaseStatus.text}</span>
                    </div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Monthly Rent</div>
                    <div class="tenant-detail-value">$${tenant.monthly_rent.toFixed(2)}</div>
                </div>
                ${tenant.security_deposit ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Security Deposit</div>
                    <div class="tenant-detail-value">$${tenant.security_deposit.toFixed(2)}</div>
                </div>
                ` : ''}
                ${tenant.emergency_contact ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Emergency Contact</div>
                    <div class="tenant-detail-value">${tenant.emergency_contact}</div>
                </div>
                ` : ''}
                ${tenant.emergency_phone ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Emergency Phone</div>
                    <div class="tenant-detail-value">${tenant.emergency_phone}</div>
                </div>
                ` : ''}
                ${tenant.pets ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Pets</div>
                    <div class="tenant-detail-value">${tenant.pet_details || 'Yes'}</div>
                </div>
                ` : ''}
                ${tenant.notes ? `
                <div class="tenant-detail-item" style="grid-column: span 2;">
                    <div class="tenant-detail-label">Notes</div>
                    <div class="tenant-detail-value">${tenant.notes}</div>
                </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('view-tenant-name').textContent = `${tenant.first_name} ${tenant.last_name}`;
        document.getElementById('view-tenant-modal').classList.add('active');
        
    } catch (error) {
        console.error('Error viewing tenant:', error);
        showError('Failed to load tenant details');
    }
}

// Close view modal
function closeViewTenantModal() {
    document.getElementById('view-tenant-modal').classList.remove('active');
    currentTenantId = null;
}

// Edit tenant
async function editTenant(tenantId) {
    try {
        const { data: tenant, error } = await supabaseClient
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .single();
        
        if (error) throw error;
        
        // Fill form with tenant data
        document.getElementById('tenant-modal-title').textContent = 'Edit Tenant';
        document.getElementById('tenant-id').value = tenant.id;
        document.getElementById('tenant-firstname').value = tenant.first_name;
        document.getElementById('tenant-lastname').value = tenant.last_name;
        document.getElementById('tenant-email').value = tenant.email;
        document.getElementById('tenant-phone').value = tenant.phone;
        document.getElementById('tenant-property').value = tenant.property_id;
        document.getElementById('tenant-lease-start').value = tenant.lease_start;
        document.getElementById('tenant-lease-end').value = tenant.lease_end;
        document.getElementById('tenant-monthly-rent').value = tenant.monthly_rent;
        document.getElementById('tenant-deposit').value = tenant.security_deposit || '';
        document.getElementById('tenant-emergency-contact').value = tenant.emergency_contact || '';
        document.getElementById('tenant-emergency-phone').value = tenant.emergency_phone || '';
        document.getElementById('tenant-pets').checked = tenant.pets || false;
        document.getElementById('tenant-pet-details').value = tenant.pet_details || '';
        document.getElementById('tenant-notes').value = tenant.notes || '';
        document.getElementById('tenant-status').value = tenant.status;
        
        // Show/hide pet details
        togglePetDetails();
        
        document.getElementById('tenant-modal').classList.add('active');
        
    } catch (error) {
        console.error('Error loading tenant for edit:', error);
        showError('Failed to load tenant details');
    }
}

// Edit from view modal
function editTenantFromView() {
    closeViewTenantModal();
    if (currentTenantId) {
        editTenant(currentTenantId);
    }
}

// Record payment for tenant
function recordPayment(tenantId) {
    window.location.href = `payments.html?tenant=${tenantId}`;
}

// Record payment from view
function recordPaymentFromView() {
    if (currentTenantId) {
        recordPayment(currentTenantId);
    }
}

// Confirm delete
function confirmDelete(tenantId) {
    currentTenantId = tenantId;
    document.getElementById('delete-modal').classList.add('active');
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    currentTenantId = null;
}

// Delete tenant
document.getElementById('confirm-delete').addEventListener('click', async function() {
    if (!currentTenantId) return;
    
    try {
        // Check if tenant has payments
        const { data: payments, error: paymentError } = await supabaseClient
            .from('payments')
            .select('id')
            .eq('tenant_id', currentTenantId)
            .limit(1);
        
        if (paymentError) throw paymentError;
        
        if (payments && payments.length > 0) {
            const confirm = window.confirm('This tenant has payment records. Deleting will also remove all payment history. Continue?');
            if (!confirm) {
                closeDeleteModal();
                return;
            }
        }
        
        const { error } = await supabaseClient
            .from('tenants')
            .delete()
            .eq('id', currentTenantId)
            .eq('landlord_id', currentUser.id);
        
        if (error) throw error;
        
        showSuccess('Tenant deleted successfully');
        
        // Refresh data
        await loadTenants();
        await loadTenantSummary();
        
        closeDeleteModal();
        
    } catch (error) {
        console.error('Error deleting tenant:', error);
        showError('Failed to delete tenant');
        closeDeleteModal();
    }
});

// Delete from view
function deleteTenantFromView() {
    closeViewTenantModal();
    if (currentTenantId) {
        confirmDelete(currentTenantId);
    }
}

// Setup renewal form
function setupRenewalForm() {
    const form = document.getElementById('renewal-form');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const tenantId = document.getElementById('renewal-tenant-id').value;
        const newStart = document.getElementById('new-lease-start').value;
        const newEnd = document.getElementById('new-lease-end').value;
        const newRent = parseFloat(document.getElementById('new-monthly-rent').value);
        
        if (!tenantId || !newStart || !newEnd || !newRent) {
            showError('Please fill in all fields');
            return;
        }
        
        try {
            const { error } = await supabaseClient
                .from('tenants')
                .update({
                    lease_start: newStart,
                    lease_end: newEnd,
                    monthly_rent: newRent,
                    status: 'active'
                })
                .eq('id', tenantId)
                .eq('landlord_id', currentUser.id);
            
            if (error) throw error;
            
            showSuccess('Lease renewed successfully!');
            closeRenewalModal();
            await loadTenants();
            await loadTenantSummary();
            
        } catch (error) {
            console.error('Error renewing lease:', error);
            showError('Failed to renew lease');
        }
    });
}

// Renew lease
function renewLease(tenantId) {
    const tenant = tenantsData.find(t => t.id === tenantId);
    if (!tenant) return;
    
    document.getElementById('renewal-tenant-id').value = tenantId;
    
    const today = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(today.getFullYear() + 1);
    
    const formatDate = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };
    
    document.getElementById('new-lease-start').value = formatDate(today);
    document.getElementById('new-lease-end').value = formatDate(oneYearFromNow);
    document.getElementById('new-monthly-rent').value = tenant.monthly_rent;
    
    document.getElementById('renewal-modal').classList.add('active');
}

// Close renewal modal
function closeRenewalModal() {
    document.getElementById('renewal-modal').classList.remove('active');
    document.getElementById('renewal-form').reset();
}

// Helper function to reset button
function resetButton(btn, btnText, btnLoader) {
    if (btnText) btnText.style.display = 'inline';
    if (btnLoader) btnLoader.style.display = 'none';
    if (btn) btn.disabled = false;
}

// Show error message
function showError(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
        `;
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #ef4444;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        font-weight: 500;
        min-width: 300px;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Show success message
function showSuccess(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
        `;
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        font-weight: 500;
        min-width: 300px;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}