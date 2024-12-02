class MusicApp {
    constructor() {
        this.currentUser = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('global-search').addEventListener('input', this.handleGlobalSearch.bind(this));
        document.getElementById('logout-btn').addEventListener('click', this.logout.bind(this));
    }

    async login(username, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const userData = await response.json();
                this.currentUser = userData;
                this.updateUserInterface();
                this.loadDashboard();
            } else {
                this.showErrorModal('Login failed. Please check your credentials.');
            }
        } catch (error) {
            this.showErrorModal('Network error. Please try again.');
        }
    }

    showErrorModal(message) {
        const modalBody = document.getElementById('modal-body');
        modalBody.textContent = message;
        const modal = new bootstrap.Modal(document.getElementById('modal'));
        modal.show();
    }

    logout() {
        this.currentUser = null;
        window.location.href = '/login';
    }

    updateUserInterface() {
        if (this.currentUser) {
            document.getElementById('username').textContent = this.currentUser.fullName;
        }
    }

    loadDashboard() {
        fetch('/api/dashboard')
            .then((response) => response.json())
            .then((dashboardData) => {
                this.renderDashboard(dashboardData);
            })
            .catch((error) => console.error('Dashboard load failed:', error));
    }

    renderDashboard(dashboardData) {
        const content = document.getElementById('app-content');
        content.innerHTML = `
            <div>Content rendered dynamically</div>
        `;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const musicApp = new MusicApp();
});
