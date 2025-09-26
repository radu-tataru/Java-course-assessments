/**
 * Authentication utilities for the Java Assessment System
 * Handles token management, user session, and auth checks
 */

class AuthUtils {
    constructor() {
        this.apiUrl = '/api';
        this.tokenKey = 'auth_token';
        this.userKey = 'user_data';
    }

    // Check if user is authenticated
    isAuthenticated() {
        const token = this.getToken();
        const userData = this.getUserData();
        return !!(token && userData);
    }

    // Get stored token
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    // Get stored user data
    getUserData() {
        const data = localStorage.getItem(this.userKey);
        return data ? JSON.parse(data) : null;
    }

    // Store auth data
    setAuthData(token, userData) {
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(userData));
    }

    // Clear auth data (logout)
    clearAuthData() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }

    // Get auth headers for API requests
    getAuthHeaders() {
        const token = this.getToken();
        return token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };
    }

    // Verify token with server
    async verifyToken() {
        console.log('AuthUtils: Verifying token...');
        if (!this.getToken()) {
            console.log('AuthUtils: No token found');
            return false;
        }

        try {
            console.log('AuthUtils: Making request to /api/auth-handler?action=verify');
            const response = await fetch(`${this.apiUrl}/auth-handler?action=verify`, {
                headers: this.getAuthHeaders()
            });

            console.log('AuthUtils: Response status:', response.status);
            const data = await response.json();
            console.log('AuthUtils: Response data:', data);

            if (data.valid) {
                console.log('AuthUtils: Token is valid');
                // Update user data in case it changed
                this.setAuthData(this.getToken(), data.user);
                return true;
            } else {
                console.log('AuthUtils: Token is invalid');
                // Token is invalid, clear auth data
                this.clearAuthData();
                return false;
            }
        } catch (error) {
            console.error('Token verification error:', error);
            return false;
        }
    }

    // Logout user
    async logout() {
        this.clearAuthData();
        window.location.href = 'index.html';
    }

    // Redirect to login if not authenticated
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    // Check if user has specific role
    hasRole(role) {
        const userData = this.getUserData();
        return userData && userData.role === role;
    }

    // Require specific role
    requireRole(role) {
        if (!this.requireAuth()) {
            return false;
        }

        if (!this.hasRole(role)) {
            this.showAccessDenied();
            return false;
        }

        return true;
    }

    // Show access denied message
    showAccessDenied() {
        const message = 'Access denied. You do not have permission to view this page.';

        if (typeof bootstrap !== 'undefined') {
            // Show Bootstrap alert if available
            const alertHTML = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i class="bi bi-shield-exclamation me-2"></i>
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;

            const container = document.querySelector('.container, .container-fluid');
            if (container) {
                container.insertAdjacentHTML('afterbegin', alertHTML);
            }
        } else {
            // Fallback to alert
            alert(message);
        }

        // Redirect to appropriate page after delay
        setTimeout(() => {
            const userData = this.getUserData();
            if (userData?.role === 'teacher') {
                window.location.href = '/src/teacher-dashboard/dashboard.html';
            } else {
                window.location.href = '/src/assessments/step1-assessment.html';
            }
        }, 3000);
    }

    // Create user info display
    createUserInfo() {
        const userData = this.getUserData();
        if (!userData) {
            return '';
        }

        return `
            <div class="user-info d-flex align-items-center">
                <div class="user-avatar me-3">
                    <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white" style="width: 40px; height: 40px;">
                        ${userData.firstName[0]}${userData.lastName[0]}
                    </div>
                </div>
                <div class="user-details">
                    <div class="fw-semibold">${userData.firstName} ${userData.lastName}</div>
                    <div class="text-muted small">${userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}</div>
                </div>
                <div class="ms-3">
                    <button class="btn btn-outline-danger btn-sm" onclick="authUtils.logout()">
                        <i class="bi bi-box-arrow-right me-1"></i>Logout
                    </button>
                </div>
            </div>
        `;
    }

    // Initialize auth check on page load
    async initAuth(autoRedirect = false) {
        if (this.isAuthenticated()) {
            const isValid = await this.verifyToken();
            if (!isValid && autoRedirect) {
                // Redirect to login if token is invalid and autoRedirect is enabled
                window.location.href = 'index.html';
            }
            return isValid;
        }
        return false;
    }

    // Make authenticated API request
    async apiRequest(url, options = {}) {
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                // Token expired or invalid
                this.clearAuthData();
                window.location.href = 'index.html';
                throw new Error('Authentication required');
            }

            return response;
        } catch (error) {
            console.error('API Request error:', error);
            throw error;
        }
    }

    // Format user display name
    getDisplayName() {
        const userData = this.getUserData();
        if (!userData) {
            return 'Guest';
        }
        return `${userData.firstName} ${userData.lastName}`;
    }

    // Get user initials
    getUserInitials() {
        const userData = this.getUserData();
        if (!userData) {
            return 'G';
        }
        return `${userData.firstName[0]}${userData.lastName[0]}`;
    }
}

// Create global instance
const authUtils = new AuthUtils();

// Auto-initialize on DOM load (disabled to prevent redirect loops)
// document.addEventListener('DOMContentLoaded', () => {
//     authUtils.initAuth();
// });

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthUtils;
}

// Add to window for global access
window.AuthUtils = AuthUtils;
window.authUtils = authUtils;