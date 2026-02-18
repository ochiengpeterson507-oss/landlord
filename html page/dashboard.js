// Load dashboard data
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = await checkAuth();
    if (!user) return;
    
    // Display user info
    document.getElementById('userName').textContent = user.user_metadata?.full_name || 'Landlord';
    document.getElementById('userEmail').textContent = user.email;
    
    // Set current date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Load dashboard stats
    await loadDashboardStats(user.id);
    
    // Load recent payments
    await loadRecentPayments(user.id);
    
    // Load maintenance requests
    await loadMaintenanceRequests(user.id);
    
    // Load upcoming tasks
    await loadUpcomingTasks(user.id);
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await logout();
    });
});

async function loadDashboardStats(landlordId) {
    try {
        // Get properties count
        const { count: propertiesCount } = await supabaseClient
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('landlord_id', landlordId);
        
        document.getElementById('totalProperties').textContent = propertiesCount || 0;
        
        // Get active tenants count
        const { count: tenantsCount } = await supabaseClient
            .from('tenants')
            .select('*', { count: 'exact', head: true })
            .eq('landlord_id', landlordId)
            .eq('status', 'active');
        
        document.getElementById('totalTenants').textContent = tenantsCount || 0;
        
        // Get total monthly rent
        const { data: properties } = await supabaseClient
            .from('properties')
            .select('monthly_rent')
            .eq('landlord_id', landlordId)
            .eq('status', 'rented');
        
        const totalMonthlyRent = properties?.reduce((sum, p) => sum + (p.monthly_rent || 0), 0) || 0;
        document.getElementById('monthlyRent').textContent = `$${totalMonthlyRent.toLocaleString()}`;
        
        // Calculate occupancy rate
        const { count: totalProperties } = await supabaseClient
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('landlord_id', landlordId);
        
        const { count: rentedProperties } = await supabaseClient
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('landlord_id', landlordId)
            .eq('status', 'rented');
        
        const occupancyRate = totalProperties > 0 
            ? Math.round((rentedProperties / totalProperties) * 100) 
            : 0;
        
        document.getElementById('occupancyRate').textContent = `${occupancyRate}%`;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadRecentPayments(landlordId) {
    try {
        const { data: payments, error } = await supabaseClient
            .from('payments')
            .select(`
                *,
                tenants (first_name, last_name),
                properties (name)
            `)
            .eq('landlord_id', landlordId)
            .order('payment_date', { ascending: false })
            .limit(5);
        
        const tbody = document.getElementById('recentPayments');
        
        if (error || !payments?.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">No recent payments</td></tr>';
            return;
        }
        
        tbody.innerHTML = payments.map(payment => `
            <tr>
                <td>${payment.tenants?.first_name} ${payment.tenants?.last_name}</td>
                <td>${payment.properties?.name || 'N/A'}</td>
                <td>$${payment.amount.toLocaleString()}</td>
                <td><span class="status-badge status-${payment.status}">${payment.status}</span></td>
                <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading payments:', error);
    }
}

async function loadMaintenanceRequests(landlordId) {
    try {
        const { data: requests, error } = await supabaseClient
            .from('maintenance_requests')
            .select(`
                *,
                tenants (first_name, last_name),
                properties (name)
            `)
            .eq('landlord_id', landlordId)
            .neq('status', 'completed')
            .order('priority', { ascending: false })
            .limit(5);
        
        const container = document.getElementById('maintenanceRequests');
        
        if (error || !requests?.length) {
            container.innerHTML = '<div class="no-data">No open maintenance requests</div>';
            return;
        }
        
        container.innerHTML = requests.map(request => `
            <div class="request-item priority-${request.priority}">
                <div class="request-header">
                    <h4>${request.title}</h4>
                    <span class="priority-badge">${request.priority}</span>
                </div>
                <p>${request.properties?.name} - ${request.tenants?.first_name} ${request.tenants?.last_name}</p>
                <small>Opened: ${new Date(request.created_at).toLocaleDateString()}</small>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading maintenance requests:', error);
    }
}

async function loadUpcomingTasks(landlordId) {
    try {
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        // Get upcoming lease expirations
        const { data: expiringLeases, error } = await supabaseClient
            .from('tenants')
            .select(`
                first_name,
                last_name,
                lease_end,
                properties (name)
            `)
            .eq('landlord_id', landlordId)
            .eq('status', 'active')
            .lte('lease_end', thirtyDaysFromNow.toISOString().split('T')[0])
            .gte('lease_end', today.toISOString().split('T')[0]);
        
        const container = document.getElementById('upcomingTasks');
        
        if (!expiringLeases?.length) {
            container.innerHTML = '<div class="no-data">No upcoming tasks</div>';
            return;
        }
        
        container.innerHTML = expiringLeases.map(lease => {
            const daysLeft = Math.ceil((new Date(lease.lease_end) - today) / (1000 * 60 * 60 * 24));
            return `
                <div class="task-item">
                    <div class="task-icon">📅</div>
                    <div class="task-details">
                        <h4>Lease Expiring: ${lease.first_name} ${lease.last_name}</h4>
                        <p>${lease.properties?.name} - Ends in ${daysLeft} days</p>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}