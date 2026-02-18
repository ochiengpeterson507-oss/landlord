// ========== PROPERTIES.JS - COMPLETE WORKING VERSION ==========

let currentUser = null;
let currentPropertyId = null;
let propertiesData = [];
let imageUrls = [];

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Properties page loaded');
    
    // Check authentication
    const user = await checkAuth();
    if (!user) return;
    
    currentUser = user;
    
    // Display user info
    document.getElementById('userName').textContent = user.user_metadata?.full_name || 'Landlord';
    document.getElementById('userEmail').textContent = user.email;
    
    // Load properties
    await loadProperties();
    
    // Load property statistics
    await loadPropertyStats();
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await logout();
    });
    
    // Setup form submission
    setupPropertyForm();
    
    // Check URL parameters for add action
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'add') {
        openPropertyModal();
    }
});

// Setup property form submission
function setupPropertyForm() {
    const form = document.getElementById('property-form');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('save-property-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        
        // Show loading
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline';
        submitBtn.disabled = true;
        
        try {
            // Get form values
            const name = document.getElementById('property-name').value.trim();
            const type = document.getElementById('property-type').value;
            const address = document.getElementById('property-address').value.trim();
            const city = document.getElementById('property-city').value.trim();
            const state = document.getElementById('property-state').value.trim().toUpperCase();
            const zip = document.getElementById('property-zip').value.trim();
            const bedrooms = parseInt(document.getElementById('property-bedrooms').value) || null;
            const bathrooms = parseFloat(document.getElementById('property-bathrooms').value) || null;
            const sqft = parseInt(document.getElementById('property-sqft').value) || null;
            const yearBuilt = parseInt(document.getElementById('property-year').value) || null;
            const purchasePrice = parseFloat(document.getElementById('property-purchase-price').value) || null;
            const currentValue = parseFloat(document.getElementById('property-current-value').value) || null;
            const monthlyRent = parseFloat(document.getElementById('property-monthly-rent').value);
            const status = document.getElementById('property-status').value;
            const description = document.getElementById('property-description').value.trim() || null;
            
            // Get image URLs from textarea
            const imagesText = document.getElementById('property-images-urls').value.trim();
            let images = [];
            if (imagesText) {
                images = imagesText.split('\n').map(url => url.trim()).filter(url => url);
            }
            
            // Add uploaded images
            if (imageUrls.length > 0) {
                images = [...images, ...imageUrls];
            }
            
            // Validate
            if (!name) {
                showError('Please enter property name');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!type) {
                showError('Please select property type');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!address || !city || !state || !zip) {
                showError('Please enter complete address');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!monthlyRent || monthlyRent <= 0) {
                showError('Please enter a valid monthly rent');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            const propertyId = document.getElementById('property-id').value;
            
            // Prepare property data
            const propertyData = {
                landlord_id: currentUser.id,
                name: name,
                property_type: type,
                address: address,
                city: city,
                state: state,
                zip_code: zip,
                bedrooms: bedrooms,
                bathrooms: bathrooms,
                square_feet: sqft,
                year_built: yearBuilt,
                purchase_price: purchasePrice,
                current_value: currentValue,
                monthly_rent: monthlyRent,
                status: status,
                description: description,
                images: images.length > 0 ? images : null,
                updated_at: new Date().toISOString()
            };
            
            let result;
            
            if (propertyId) {
                // Update existing property
                result = await supabaseClient
                    .from('properties')
                    .update(propertyData)
                    .eq('id', propertyId)
                    .eq('landlord_id', currentUser.id);
            } else {
                // Create new property
                result = await supabaseClient
                    .from('properties')
                    .insert([propertyData]);
            }
            
            if (result.error) throw result.error;
            
            showSuccess(propertyId ? 'Property updated successfully!' : 'Property added successfully!');
            
            // Close modal and refresh
            closePropertyModal();
            await loadProperties();
            await loadPropertyStats();
            
        } catch (error) {
            console.error('Error saving property:', error);
            showError(error.message || 'Failed to save property');
        } finally {
            resetButton(submitBtn, btnText, btnLoader);
        }
    });
}

// Handle image upload
function handleImageUpload() {
    const fileInput = document.getElementById('property-images');
    const files = fileInput.files;
    
    if (!files || files.length === 0) return;
    
    // For demo purposes, we'll create object URLs
    // In production, you'd upload to Supabase Storage
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            imageUrls.push(e.target.result);
            updateImagePreview();
        };
        reader.readAsDataURL(file);
    });
}

// Update image preview
function updateImagePreview() {
    const preview = document.getElementById('image-preview');
    const urlsTextarea = document.getElementById('property-images-urls');
    
    // Get existing URLs from textarea
    const textUrls = urlsTextarea.value.split('\n').map(url => url.trim()).filter(url => url);
    const allImages = [...textUrls, ...imageUrls];
    
    if (allImages.length === 0) {
        preview.innerHTML = '';
        return;
    }
    
    preview.innerHTML = allImages.map(url => `
        <div class="image-preview-item">
            <img src="${url}" alt="Property image">
        </div>
    `).join('');
}

// Load properties
async function loadProperties() {
    try {
        const { data: properties, error } = await supabaseClient
            .from('properties')
            .select('*')
            .eq('landlord_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        propertiesData = properties || [];
        displayProperties(propertiesData);
        
    } catch (error) {
        console.error('Error loading properties:', error);
        showError('Failed to load properties');
        document.getElementById('properties-grid').innerHTML = `
            <div class="error-message">Error loading properties: ${error.message}</div>
        `;
    }
}

// Display properties in grid
function displayProperties(properties) {
    const grid = document.getElementById('properties-grid');
    
    if (!properties || properties.length === 0) {
        grid.innerHTML = `
            <div class="no-data" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <h3>No properties found</h3>
                <p>Click "Add Property" to get started.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = properties.map(property => {
        const imageUrl = property.images && property.images.length > 0 
            ? property.images[0] 
            : null;
        
        return `
            <div class="property-card">
                <div class="property-image ${!imageUrl ? 'property-image-placeholder' : ''}">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${property.name}">` : '🏢'}
                    <span class="property-status-badge property-status ${property.status}">${property.status}</span>
                </div>
                <div class="property-details">
                    <h3 class="property-name">${property.name}</h3>
                    <div class="property-address">
                        📍 ${property.address}, ${property.city}, ${property.state} ${property.zip_code}
                    </div>
                    <div class="property-specs">
                        ${property.bedrooms ? `<span class="property-spec">🛏️ ${property.bedrooms} bed</span>` : ''}
                        ${property.bathrooms ? `<span class="property-spec">🚿 ${property.bathrooms} bath</span>` : ''}
                        ${property.square_feet ? `<span class="property-spec">📏 ${property.square_feet.toLocaleString()} sqft</span>` : ''}
                    </div>
                    <div class="property-rent">
                        $${property.monthly_rent.toFixed(2)} <span>/month</span>
                    </div>
                    <div class="property-actions">
                        <button class="property-action-btn view" onclick="viewProperty('${property.id}')">👁️ View</button>
                        <button class="property-action-btn edit" onclick="editProperty('${property.id}')">✏️ Edit</button>
                        <button class="property-action-btn delete" onclick="confirmDelete('${property.id}')">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Load property statistics
async function loadPropertyStats() {
    try {
        const { data: properties, error } = await supabaseClient
            .from('properties')
            .select('status, current_value, monthly_rent')
            .eq('landlord_id', currentUser.id);
        
        if (error) throw error;
        
        const total = properties.length;
        const available = properties.filter(p => p.status === 'available').length;
        const rented = properties.filter(p => p.status === 'rented').length;
        const totalValue = properties.reduce((sum, p) => sum + (p.current_value || 0), 0);
        const monthlyRent = properties.reduce((sum, p) => sum + (p.monthly_rent || 0), 0);
        
        document.getElementById('total-properties').textContent = total;
        document.getElementById('available-properties').textContent = available;
        document.getElementById('rented-properties').textContent = rented;
        document.getElementById('total-property-value').textContent = `$${totalValue.toLocaleString()}`;
        
    } catch (error) {
        console.error('Error loading property stats:', error);
    }
}

// Filter properties
function filterProperties() {
    const searchTerm = document.getElementById('search-property')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('status-filter')?.value || 'all';
    const typeFilter = document.getElementById('type-filter')?.value || 'all';
    
    const filtered = propertiesData.filter(property => {
        // Search filter
        const name = property.name.toLowerCase();
        const address = `${property.address} ${property.city} ${property.state}`.toLowerCase();
        const matchesSearch = searchTerm === '' || 
            name.includes(searchTerm) || 
            address.includes(searchTerm);
        
        // Status filter
        const matchesStatus = statusFilter === 'all' || property.status === statusFilter;
        
        // Type filter
        const matchesType = typeFilter === 'all' || property.property_type === typeFilter;
        
        return matchesSearch && matchesStatus && matchesType;
    });
    
    displayProperties(filtered);
}

// Open property modal for new property
function openPropertyModal() {
    document.getElementById('property-modal-title').textContent = 'Add Property';
    document.getElementById('property-id').value = '';
    document.getElementById('property-form').reset();
    document.getElementById('image-preview').innerHTML = '';
    document.getElementById('property-images-urls').value = '';
    imageUrls = [];
    
    document.getElementById('property-modal').classList.add('active');
}

// Close property modal
function closePropertyModal() {
    document.getElementById('property-modal').classList.remove('active');
    document.getElementById('property-form').reset();
    imageUrls = [];
}

// View property details
async function viewProperty(propertyId) {
    try {
        const { data: property, error } = await supabaseClient
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .single();
        
        if (error) throw error;
        
        currentPropertyId = propertyId;
        
        // Get tenant count for this property
        const { count: tenantCount, error: tenantError } = await supabaseClient
            .from('tenants')
            .select('*', { count: 'exact', head: true })
            .eq('property_id', propertyId)
            .eq('status', 'active');
        
        const content = document.getElementById('property-details-content');
        
        // Generate image gallery
        const images = property.images || [];
        const imageGallery = images.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.5rem; margin-bottom: 1.5rem;">
                ${images.map(img => `
                    <img src="${img}" alt="Property" style="width: 100%; height: 100px; object-fit: cover; border-radius: 0.375rem;">
                `).join('')}
            </div>
        ` : '';
        
        content.innerHTML = `
            ${imageGallery}
            <div class="tenant-details-grid">
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Property Name</div>
                    <div class="tenant-detail-value">${property.name}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Status</div>
                    <div class="tenant-detail-value">
                        <span class="property-status ${property.status}">${property.status}</span>
                    </div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Type</div>
                    <div class="tenant-detail-value">${property.property_type}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Address</div>
                    <div class="tenant-detail-value">${property.address}, ${property.city}, ${property.state} ${property.zip_code}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Monthly Rent</div>
                    <div class="tenant-detail-value">$${property.monthly_rent.toFixed(2)}</div>
                </div>
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Active Tenants</div>
                    <div class="tenant-detail-value">${tenantCount || 0}</div>
                </div>
                ${property.bedrooms ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Bedrooms</div>
                    <div class="tenant-detail-value">${property.bedrooms}</div>
                </div>
                ` : ''}
                ${property.bathrooms ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Bathrooms</div>
                    <div class="tenant-detail-value">${property.bathrooms}</div>
                </div>
                ` : ''}
                ${property.square_feet ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Square Feet</div>
                    <div class="tenant-detail-value">${property.square_feet.toLocaleString()}</div>
                </div>
                ` : ''}
                ${property.year_built ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Year Built</div>
                    <div class="tenant-detail-value">${property.year_built}</div>
                </div>
                ` : ''}
                ${property.purchase_price ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Purchase Price</div>
                    <div class="tenant-detail-value">$${property.purchase_price.toLocaleString()}</div>
                </div>
                ` : ''}
                ${property.current_value ? `
                <div class="tenant-detail-item">
                    <div class="tenant-detail-label">Current Value</div>
                    <div class="tenant-detail-value">$${property.current_value.toLocaleString()}</div>
                </div>
                ` : ''}
                ${property.description ? `
                <div class="tenant-detail-item" style="grid-column: span 2;">
                    <div class="tenant-detail-label">Description</div>
                    <div class="tenant-detail-value">${property.description}</div>
                </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('view-property-name').textContent = property.name;
        document.getElementById('view-property-modal').classList.add('active');
        
    } catch (error) {
        console.error('Error viewing property:', error);
        showError('Failed to load property details');
    }
}

// Close view modal
function closeViewPropertyModal() {
    document.getElementById('view-property-modal').classList.remove('active');
    currentPropertyId = null;
}

// Edit property
async function editProperty(propertyId) {
    try {
        const { data: property, error } = await supabaseClient
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .single();
        
        if (error) throw error;
        
        // Fill form with property data
        document.getElementById('property-modal-title').textContent = 'Edit Property';
        document.getElementById('property-id').value = property.id;
        document.getElementById('property-name').value = property.name;
        document.getElementById('property-type').value = property.property_type;
        document.getElementById('property-address').value = property.address;
        document.getElementById('property-city').value = property.city;
        document.getElementById('property-state').value = property.state;
        document.getElementById('property-zip').value = property.zip_code;
        document.getElementById('property-bedrooms').value = property.bedrooms || '';
        document.getElementById('property-bathrooms').value = property.bathrooms || '';
        document.getElementById('property-sqft').value = property.square_feet || '';
        document.getElementById('property-year').value = property.year_built || '';
        document.getElementById('property-purchase-price').value = property.purchase_price || '';
        document.getElementById('property-current-value').value = property.current_value || '';
        document.getElementById('property-monthly-rent').value = property.monthly_rent;
        document.getElementById('property-status').value = property.status;
        document.getElementById('property-description').value = property.description || '';
        
        // Set images
        if (property.images && property.images.length > 0) {
            document.getElementById('property-images-urls').value = property.images.join('\n');
            imageUrls = [];
            updateImagePreview();
        }
        
        document.getElementById('property-modal').classList.add('active');
        
    } catch (error) {
        console.error('Error loading property for edit:', error);
        showError('Failed to load property details');
    }
}

// Edit from view modal
function editPropertyFromView() {
    closeViewPropertyModal();
    if (currentPropertyId) {
        editProperty(currentPropertyId);
    }
}

// View tenants for this property
async function viewTenants() {
    if (!currentPropertyId) return;
    
    try {
        const { data: tenants, error } = await supabaseClient
            .from('tenants')
            .select('first_name, last_name, email, phone, lease_start, lease_end, status, monthly_rent')
            .eq('property_id', currentPropertyId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const content = document.getElementById('tenants-list-content');
        
        if (!tenants || tenants.length === 0) {
            content.innerHTML = '<p class="no-data">No tenants found for this property.</p>';
        } else {
            content.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Lease Period</th>
                            <th>Rent</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tenants.map(tenant => `
                            <tr>
                                <td>${tenant.first_name} ${tenant.last_name}</td>
                                <td>${tenant.email}</td>
                                <td>${tenant.phone}</td>
                                <td>${new Date(tenant.lease_start).toLocaleDateString()} - ${new Date(tenant.lease_end).toLocaleDateString()}</td>
                                <td>$${tenant.monthly_rent}</td>
                                <td><span class="tenant-status ${tenant.status}">${tenant.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        closeViewPropertyModal();
        document.getElementById('tenants-modal').classList.add('active');
        
    } catch (error) {
        console.error('Error loading tenants:', error);
        showError('Failed to load tenants');
    }
}

// Close tenants modal
function closeTenantsModal() {
    document.getElementById('tenants-modal').classList.remove('active');
}

// Confirm delete
function confirmDelete(propertyId) {
    currentPropertyId = propertyId;
    const property = propertiesData.find(p => p.id === propertyId);
    
    // Check if property has tenants
    const message = document.getElementById('delete-message');
    if (property && property.status === 'rented') {
        message.textContent = 'This property has active tenants. Deleting it will affect tenant records. Are you sure?';
    } else {
        message.textContent = 'Are you sure you want to delete this property? This action cannot be undone.';
    }
    
    document.getElementById('delete-modal').classList.add('active');
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    currentPropertyId = null;
}

// Delete property
document.getElementById('confirm-delete').addEventListener('click', async function() {
    if (!currentPropertyId) return;
    
    try {
        // Check if property has tenants
        const { count: tenantCount, error: countError } = await supabaseClient
            .from('tenants')
            .select('*', { count: 'exact', head: true })
            .eq('property_id', currentPropertyId);
        
        if (countError) throw countError;
        
        if (tenantCount && tenantCount > 0) {
            const confirm = window.confirm(`This property has ${tenantCount} tenant(s). Deleting will also remove all associated records. Continue?`);
            if (!confirm) {
                closeDeleteModal();
                return;
            }
        }
        
        const { error } = await supabaseClient
            .from('properties')
            .delete()
            .eq('id', currentPropertyId)
            .eq('landlord_id', currentUser.id);
        
        if (error) throw error;
        
        showSuccess('Property deleted successfully');
        
        // Refresh data
        await loadProperties();
        await loadPropertyStats();
        
        closeDeleteModal();
        
    } catch (error) {
        console.error('Error deleting property:', error);
        showError('Failed to delete property');
        closeDeleteModal();
    }
});

// Delete from view
function deletePropertyFromView() {
    closeViewPropertyModal();
    if (currentPropertyId) {
        confirmDelete(currentPropertyId);
    }
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