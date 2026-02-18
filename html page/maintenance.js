// ========== MAINTENANCE.JS - COMPLETE WORKING VERSION ==========

let currentUser = null;
let currentRequestId = null;
let requestsData = [];
let propertiesData = [];
let tenantsData = [];

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Maintenance page loaded');
    
    // Check authentication
    const user = await checkAuth();
    if (!user) return;
    
    currentUser = user;
    
    // Display user info
    document.getElementById('userName').textContent = user.user_metadata?.full_name || 'Landlord';
    document.getElementById('userEmail').textContent = user.email;
    
    // Load properties for dropdown
    await loadProperties();
    
    // Load maintenance requests
    await loadRequests();
    
    // Load priority summary
    await loadPrioritySummary();
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await logout();
    });
    
    // Setup form submission
    setupRequestForm();
    
    // Setup delete button
    setupDeleteButton();
    
    // Setup cost form
    setupCostForm();
    
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'add') {
        openRequestModal();
    }
});

// Load properties for dropdown
async function loadProperties() {
    try {
        const { data: properties, error } = await supabaseClient
            .from('properties')
            .select('id, name')
            .eq('landlord_id', currentUser.id)
            .order('name');
        
        if (error) throw error;
        
        propertiesData = properties || [];
        
        // Populate property dropdown in request form
        const propertySelect = document.getElementById('request-property');
        if (propertySelect) {
            propertySelect.innerHTML = '<option value="">-- Select property --</option>';
            
            if (properties && properties.length > 0) {
                properties.forEach(property => {
                    const option = document.createElement('option');
                    option.value = property.id;
                    option.textContent = property.name;
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

// Load tenants for selected property
async function loadTenantsForProperty() {
    const propertyId = document.getElementById('request-property').value;
    const tenantSelect = document.getElementById('request-tenant');
    
    if (!propertyId) {
        tenantSelect.innerHTML = '<option value="">-- Select tenant --</option>';
        return;
    }
    
    try {
        const { data: tenants, error } = await supabaseClient
            .from('tenants')
            .select('id, first_name, last_name')
            .eq('property_id', propertyId)
            .eq('status', 'active');
        
        if (error) throw error;
        
        tenantsData = tenants || [];
        
        tenantSelect.innerHTML = '<option value="">-- Select tenant --</option>';
        
        if (tenants && tenants.length > 0) {
            tenants.forEach(tenant => {
                const option = document.createElement('option');
                option.value = tenant.id;
                option.textContent = `${tenant.first_name} ${tenant.last_name}`;
                tenantSelect.appendChild(option);
            });
        } else {
            tenantSelect.innerHTML = '<option value="">No active tenants found</option>';
        }
        
    } catch (error) {
        console.error('Error loading tenants:', error);
        showError('Failed to load tenants');
    }
}

// Setup request form submission
function setupRequestForm() {
    const form = document.getElementById('request-form');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('save-request-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        
        // Show loading
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline';
        submitBtn.disabled = true;
        
        try {
            // Get form values
            const title = document.getElementById('request-title').value.trim();
            const propertyId = document.getElementById('request-property').value;
            const tenantId = document.getElementById('request-tenant').value;
            const priority = document.getElementById('request-priority').value;
            const status = document.getElementById('request-status').value;
            const description = document.getElementById('request-description').value.trim();
            const assignedTo = document.getElementById('request-assigned').value.trim() || null;
            const estimatedCost = parseFloat(document.getElementById('request-estimate').value) || null;
            const actualCost = parseFloat(document.getElementById('request-actual').value) || null;
            const completedDate = document.getElementById('request-completed').value || null;
            const notes = document.getElementById('request-notes').value.trim() || null;
            
            // Validate
            if (!title) {
                showError('Please enter a title');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!propertyId) {
                showError('Please select a property');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!tenantId) {
                showError('Please select a tenant');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!description) {
                showError('Please enter a description');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            const requestId = document.getElementById('request-id').value;
            
            // Prepare request data
            const requestData = {
                landlord_id: currentUser.id,
                property_id: propertyId,
                tenant_id: tenantId,
                title: title,
                description: description,
                priority: priority,
                status: status,
                assigned_to: assignedTo,
                estimated_cost: estimatedCost,
                actual_cost: actualCost,
                completed_date: completedDate,
                notes: notes,
                updated_at: new Date().toISOString()
            };
            
            let result;
            
            if (requestId) {
                // Update existing request
                result = await supabaseClient
                    .from('maintenance_requests')
                    .update(requestData)
                    .eq('id', requestId)
                    .eq('landlord_id', currentUser.id);
            } else {
                // Create new request
                result = await supabaseClient
                    .from('maintenance_requests')
                    .insert([requestData]);
            }
            
            if (result.error) throw result.error;
            
            showSuccess(requestId ? 'Request updated successfully!' : 'Request created successfully!');
            
            // Close modal and refresh
            closeRequestModal();
            await loadRequests();
            await loadPrioritySummary();
            
        } catch (error) {
            console.error('Error saving request:', error);
            showError(error.message || 'Failed to save request');
        } finally {
            resetButton(submitBtn, btnText, btnLoader);
        }
    });
}

// Load maintenance requests
async function loadRequests() {
    try {
        const { data: requests, error } = await supabaseClient
            .from('maintenance_requests')
            .select(`
                *,
                properties (
                    name
                ),
                tenants (
                    first_name,
                    last_name
                )
            `)
            .eq('landlord_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        requestsData = requests || [];
        displayRequests(requestsData);
        
    } catch (error) {
        console.error('Error loading requests:', error);
        showError('Failed to load requests');
        document.getElementById('requests-grid').innerHTML = `
            <div class="error-message" style="grid-column: 1/-1; text-align: center; padding: 2rem;">
                Error loading requests: ${error.message}
            </div>
        `;
    }
}

// Display requests in grid
function displayRequests(requests) {
    const grid = document.getElementById('requests-grid');
    
    if (!requests || requests.length === 0) {
        grid.innerHTML = `
            <div class="no-data" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <h3>No maintenance requests found</h3>
                <p>Click "New Request" to create one.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = requests.map(request => {
        const createdDate = new Date(request.created_at).toLocaleDateString();
        const tenantName = request.tenants ? 
            `${request.tenants.first_name} ${request.tenants.last_name}` : 
            'Unknown Tenant';
        const propertyName = request.properties?.name || 'Unknown Property';
        
        return `
            <div class="request-card priority-${request.priority}">
                <div class="request-header">
                    <h3 class="request-title">${request.title}</h3>
                    <span class="request-badge badge-${request.priority}">${request.priority}</span>
                </div>
                <div class="request-body">
                    <div class="request-meta">
                        <span class="request-meta-item">🏢 ${propertyName}</span>
                        <span class="request-meta-item">👤 ${tenantName}</span>
                    </div>
                    <div class="request-meta">
                        <span class="request-meta-item">📅 ${createdDate}</span>
                        ${request.assigned_to ? `<span class="request-meta-item">🔧 ${request.assigned_to}</span>` : ''}
                    </div>
                    <p class="request-description">${request.description}</p>
                    ${request.estimated_cost ? `
                        <div class="cost-display">
                            <span class="cost-label">Est. Cost:</span> $${request.estimated_cost.toFixed(2)}
                        </div>
                    ` : ''}
                </div>
                <div class="request-footer">
                    <span class="request-status badge-${request.status}">${request.status.replace('_', ' ')}</span>
                    <div class="request-actions">
                        <button class="request-action-btn view" onclick="viewRequest('${request.id}')" title="View">👁️</button>
                        <button class="request-action-btn edit" onclick="editRequest('${request.id}')" title="Edit">✏️</button>
                        ${request.status !== 'completed' ? 
                            `<button class="request-action-btn complete" onclick="markRequestCompleted('${request.id}')" title="Mark Completed">✓</button>` : 
                            ''}
                        <button class="request-action-btn delete" onclick="confirmDelete('${request.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Load priority summary
async function loadPrioritySummary() {
    try {
        const { data: requests, error } = await supabaseClient
            .from('maintenance_requests')
            .select('priority, status')
            .eq('landlord_id', currentUser.id);
        
        if (error) throw error;
        
        const emergency = requests.filter(r => r.priority === 'emergency' && r.status !== 'completed').length;
        const high = requests.filter(r => r.priority === 'high' && r.status !== 'completed').length;
        const medium = requests.filter(r => r.priority === 'medium' && r.status !== 'completed').length;
        const low = requests.filter(r => r.priority === 'low' && r.status !== 'completed').length;
        
        document.getElementById('emergency-count').textContent = emergency;
        document.getElementById('high-count').textContent = high;
        document.getElementById('medium-count').textContent = medium;
        document.getElementById('low-count').textContent = low;
        
    } catch (error) {
        console.error('Error loading priority summary:', error);
    }
}

// Filter requests
function filterRequests() {
    const searchTerm = document.getElementById('search-request')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('status-filter')?.value || 'all';
    const priorityFilter = document.getElementById('priority-filter')?.value || 'all';
    const propertyFilter = document.getElementById('property-filter')?.value || 'all';
    
    const filtered = requestsData.filter(request => {
        // Search filter
        const title = request.title.toLowerCase();
        const description = request.description.toLowerCase();
        const tenantName = request.tenants ? 
            `${request.tenants.first_name} ${request.tenants.last_name}`.toLowerCase() : '';
        const propertyName = request.properties?.name?.toLowerCase() || '';
        const matchesSearch = searchTerm === '' || 
            title.includes(searchTerm) || 
            description.includes(searchTerm) || 
            tenantName.includes(searchTerm) || 
            propertyName.includes(searchTerm);
        
        // Status filter
        const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
        
        // Priority filter
        const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter;
        
        // Property filter
        const matchesProperty = propertyFilter === 'all' || request.property_id === propertyFilter;
        
        return matchesSearch && matchesStatus && matchesPriority && matchesProperty;
    });
    
    displayRequests(filtered);
}

// Open request modal for new request
function openRequestModal() {
    document.getElementById('request-modal-title').textContent = 'New Maintenance Request';
    document.getElementById('request-id').value = '';
    document.getElementById('request-form').reset();
    document.getElementById('request-tenant').innerHTML = '<option value="">-- Select tenant --</option>';
    
    document.getElementById('request-modal').classList.add('active');
}

// Close request modal
function closeRequestModal() {
    document.getElementById('request-modal').classList.remove('active');
    document.getElementById('request-form').reset();
}

// View request details
async function viewRequest(requestId) {
    try {
        const { data: request, error } = await supabaseClient
            .from('maintenance_requests')
            .select(`
                *,
                properties (
                    name,
                    address
                ),
                tenants (
                    first_name,
                    last_name,
                    email,
                    phone
                )
            `)
            .eq('id', requestId)
            .single();
        
        if (error) throw error;
        
        currentRequestId = requestId;
        
        const createdDate = new Date(request.created_at).toLocaleDateString();
        const updatedDate = request.updated_at ? new Date(request.updated_at).toLocaleDateString() : null;
        const completedDate = request.completed_date ? new Date(request.completed_date).toLocaleDateString() : null;
        
        const content = document.getElementById('request-details-content');
        content.innerHTML = `
            <div class="tenant-details-grid">
                <div class="tenant-detail-item" style="grid-column: span 2;">
                    <div class="tenant-detail-label">Title</div>
                    <div class="tenant-detail-value">${request.title}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Priority</div>
                    <div class="tenant-detail-value">
                        <span class="request-badge badge-${request.priority}">${request.priority}</span>
                    </div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Status</div>
                    <div class="tenant-detail-value">
                        <span class="request-status badge-${request.status}">${request.status.replace('_', ' ')}</span>
                    </div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Property</div>
                    <div class="tenant-detail-value">${request.properties?.name || 'N/A'}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Property Address</div>
                    <div class="tenant-detail-value">${request.properties?.address || 'N/A'}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Tenant</div>
                    <div class="tenant-detail-value">${request.tenants?.first_name} ${request.tenants?.last_name}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Tenant Contact</div>
                    <div class="tenant-detail-value">${request.tenants?.email || ''} ${request.tenants?.phone || ''}</div>
                </div>
                <div class="tenant-detail-item" style="grid-column: span 2;">
                    <div class="tenant-detail-label">Description</div>
                    <div class="tenant-detail-value">${request.description}</div>
                </div>
                ${request.assigned_to ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Assigned To</div>
                    <div class="tenant-detail-value">${request.assigned_to}</div>
                </div>
                ` : ''}
                ${request.estimated_cost ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Estimated Cost</div>
                    <div class="tenant-detail-value">$${request.estimated_cost.toFixed(2)}</div>
                </div>
                ` : ''}
                ${request.actual_cost ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Actual Cost</div>
                    <div class="tenant-detail-value">$${request.actual_cost.toFixed(2)}</div>
                </div>
                ` : ''}
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Created</div>
                    <div class="tenant-detail-value">${createdDate}</div>
                </div>
                ${updatedDate ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Last Updated</div>
                    <div class="tenant-detail-value">${updatedDate}</div>
                </div>
                ` : ''}
                ${completedDate ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Completed</div>
                    <div class="tenant-detail-value">${completedDate}</div>
                </div>
                ` : ''}
                ${request.notes ? `
                <div class="tenant-detail-item" style="grid-column: span 2;">
                    <div class="tenant-detail-label">Notes</div>
                    <div class="tenant-detail-value">${request.notes}</div>
                </div>
                ` : ''}
            </div>
        `;
        
        // Update action buttons based on status
        const actionsDiv = document.getElementById('view-request-actions');
        if (request.status === 'completed') {
            actionsDiv.innerHTML = `
                <button class="btn btn-outline" onclick="closeViewRequestModal()">Close</button>
                <button class="btn btn-primary" onclick="editRequestFromView()">Edit</button>
                <button class="btn btn-danger" onclick="deleteRequestFromView()">Delete</button>
            `;
        } else {
            actionsDiv.innerHTML = `
                <button class="btn btn-outline" onclick="closeViewRequestModal()">Close</button>
                <button class="btn btn-primary" onclick="editRequestFromView()">Edit</button>
                <button class="btn btn-success" onclick="markRequestCompleted('${request.id}')">Mark Completed</button>
                <button class="btn btn-danger" onclick="deleteRequestFromView()">Delete</button>
            `;
        }
        
        document.getElementById('view-request-title').textContent = request.title;
        document.getElementById('view-request-modal').classList.add('active');
        
    } catch (error) {
        console.error('Error viewing request:', error);
        showError('Failed to load request details');
    }
}

// Close view modal
function closeViewRequestModal() {
    document.getElementById('view-request-modal').classList.remove('active');
    currentRequestId = null;
}

// Edit request
async function editRequest(requestId) {
    try {
        const { data: request, error } = await supabaseClient
            .from('maintenance_requests')
            .select('*')
            .eq('id', requestId)
            .single();
        
        if (error) throw error;
        
        // Fill form with request data
        document.getElementById('request-modal-title').textContent = 'Edit Request';
        document.getElementById('request-id').value = request.id;
        document.getElementById('request-title').value = request.title;
        document.getElementById('request-property').value = request.property_id;
        
        // Load tenants for this property
        await loadTenantsForProperty();
        document.getElementById('request-tenant').value = request.tenant_id;
        
        document.getElementById('request-priority').value = request.priority;
        document.getElementById('request-status').value = request.status;
        document.getElementById('request-description').value = request.description;
        document.getElementById('request-assigned').value = request.assigned_to || '';
        document.getElementById('request-estimate').value = request.estimated_cost || '';
        document.getElementById('request-actual').value = request.actual_cost || '';
        document.getElementById('request-completed').value = request.completed_date || '';
        document.getElementById('request-notes').value = request.notes || '';
        
        document.getElementById('request-modal').classList.add('active');
        
    } catch (error) {
        console.error('Error loading request for edit:', error);
        showError('Failed to load request details');
    }
}

// Edit from view modal
function editRequestFromView() {
    closeViewRequestModal();
    if (currentRequestId) {
        editRequest(currentRequestId);
    }
}

// Mark request as completed
async function markRequestCompleted(requestId) {
    if (!requestId && currentRequestId) {
        requestId = currentRequestId;
    }
    
    if (!requestId) return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { error } = await supabaseClient
            .from('maintenance_requests')
            .update({
                status: 'completed',
                completed_date: today,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .eq('landlord_id', currentUser.id);
        
        if (error) throw error;
        
        showSuccess('Request marked as completed');
        
        // Refresh data
        closeViewRequestModal();
        await loadRequests();
        await loadPrioritySummary();
        
    } catch (error) {
        console.error('Error completing request:', error);
        showError('Failed to mark request as completed');
    }
}

// Confirm delete
function confirmDelete(requestId) {
    currentRequestId = requestId;
    const request = requestsData.find(r => r.id === requestId);
    
    const deleteMessage = document.getElementById('delete-message');
    if (deleteMessage) {
        deleteMessage.textContent = `Are you sure you want to delete "${request?.title}"? This action cannot be undone.`;
    }
    
    document.getElementById('delete-modal').classList.add('active');
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    currentRequestId = null;
}

// Setup delete button
function setupDeleteButton() {
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    if (confirmDeleteBtn) {
        // Remove any existing event listeners
        const newConfirmDeleteBtn = confirmDeleteBtn.cloneNode(true);
        confirmDeleteBtn.parentNode.replaceChild(newConfirmDeleteBtn, confirmDeleteBtn);
        
        // Add new event listener
        newConfirmDeleteBtn.addEventListener('click', async function() {
            if (!currentRequestId) {
                closeDeleteModal();
                return;
            }
            
            // Show loading state
            const originalText = this.textContent;
            this.textContent = 'Deleting...';
            this.disabled = true;
            
            try {
                console.log('Attempting to delete request:', currentRequestId);
                
                const { error } = await supabaseClient
                    .from('maintenance_requests')
                    .delete()
                    .eq('id', currentRequestId)
                    .eq('landlord_id', currentUser.id);
                
                if (error) throw error;
                
                showSuccess('Request deleted successfully');
                
                // Refresh data
                await loadRequests();
                await loadPrioritySummary();
                
                // Close any open modals
                closeDeleteModal();
                closeViewRequestModal();
                
            } catch (error) {
                console.error('Error deleting request:', error);
                showError('Failed to delete request: ' + error.message);
            } finally {
                this.textContent = originalText;
                this.disabled = false;
                currentRequestId = null;
            }
        });
    }
}

// Delete from view
function deleteRequestFromView() {
    closeViewRequestModal();
    if (currentRequestId) {
        confirmDelete(currentRequestId);
    }
}

// Setup cost form
function setupCostForm() {
    const form = document.getElementById('cost-form');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const requestId = document.getElementById('cost-request-id').value;
        const actualCost = parseFloat(document.getElementById('actual-cost').value);
        const notes = document.getElementById('cost-notes').value.trim();
        
        if (!requestId || !actualCost) return;
        
        try {
            const { error } = await supabaseClient
                .from('maintenance_requests')
                .update({
                    actual_cost: actualCost,
                    notes: notes || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId)
                .eq('landlord_id', currentUser.id);
            
            if (error) throw error;
            
            showSuccess('Cost added successfully');
            
            closeCostModal();
            await loadRequests();
            
        } catch (error) {
            console.error('Error adding cost:', error);
            showError('Failed to add cost');
        }
    });
}

// Open cost modal
function openCostModal(requestId) {
    document.getElementById('cost-request-id').value = requestId;
    document.getElementById('cost-form').reset();
    document.getElementById('cost-modal').classList.add('active');
}

// Close cost modal
function closeCostModal() {
    document.getElementById('cost-modal').classList.remove('active');
    document.getElementById('cost-form').reset();
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

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    const deleteModal = document.getElementById('delete-modal');
    const viewModal = document.getElementById('view-request-modal');
    const costModal = document.getElementById('cost-modal');
    
    if (e.target === deleteModal) {
        closeDeleteModal();
    }
    if (e.target === viewModal) {
        closeViewRequestModal();
    }
    if (e.target === costModal) {
        closeCostModal();
    }
});