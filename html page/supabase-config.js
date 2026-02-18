// Supabase configuration
const SUPABASE_URL = 'https://oyfzrkstvvuvrujcbksc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95Znpya3N0dnZ1dnJ1amNia3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjg3ODAsImV4cCI6MjA4Njg0NDc4MH0.Jyz9XdKN-1lRAuIAQgPMET3DMsJQkwlqSThArJENG9w';

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check authentication status
async function checkAuth() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    
    if (error || !user) {
        // Not logged in, redirect to login
        if (!window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('index.html')) {
            window.location.href = 'login.html';
        }
        return null;
    }
    
    return user;
}

// Logout function
async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (!error) {
        window.location.href = 'index.html';
    }
    return error;
}