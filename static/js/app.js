// Global utility functions and app initialization

// Show alert messages
function showAlert(message, type = 'info', duration = 5000) {
    // Remove existing alerts
    const existingAlert = document.querySelector('.alert-custom');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-custom alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Insert at the beginning of the main content
    const main = document.querySelector('main');
    if (main) {
        main.insertBefore(alert, main.firstChild);
    }

    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            if (alert && alert.parentNode) {
                alert.remove();
            }
        }, duration);
    }
}

// Format currency
function formatCurrency(amount, currencyCode = 'USD') {
    const currency = CURRENCY_DATA[currencyCode];
    if (!currency) return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formattedAmount = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currency.symbol}${formattedAmount}`;
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Validate form fields
function validateRequired(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('is-invalid');
            isValid = false;
        } else {
            field.classList.remove('is-invalid');
        }
    });

    return isValid;
}

// Initialize tooltips
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeTooltips();

    // Add loading state to buttons
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.btn');
        if (btn && btn.type === 'submit') {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';
            btn.disabled = true;

            // Reset button after 3 seconds (fallback)
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 3000);
        }
    });

    // Handle form submissions with loading states
    document.addEventListener('submit', function(e) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        if (submitBtn) {
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
            submitBtn.disabled = true;

            // Reset button after form processing
            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 2000);
        }
    });

    // Mobile app navigation
    // Set active bottom navigation item
    const currentPath = window.location.pathname;
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');

    bottomNavItems.forEach(item => {
        const href = item.getAttribute('href');
        if (currentPath === href || (href.includes('generate') && currentPath.includes('generate'))) {
            item.classList.add('active');
        }
    });

    // Add touch feedback to interactive elements
    const interactiveElements = document.querySelectorAll('.btn, .card, .bottom-nav-item, .feature-card');

    interactiveElements.forEach(element => {
        element.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.98)';
        });

        element.addEventListener('touchend', function() {
            setTimeout(() => {
                this.style.transform = '';
            }, 100);
        });
    });

    // Prevent default touch behaviors for better app feel
    document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
});

// PWA Install prompt
let deferredPrompt;
const installButton = document.getElementById('installButton');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;

    // Show install button if available
    if (installButton) {
        installButton.style.display = 'block';
    }
});

if (installButton) {
    installButton.addEventListener('click', (e) => {
        // Hide the app provided install promotion
        installButton.style.display = 'none';
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
        });
    });
}

// Service Worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/static/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Online/Offline status
window.addEventListener('online', function() {
    showAlert('You are back online!', 'success');
});

window.addEventListener('offline', function() {
    showAlert('You are now offline. Some features may be limited.', 'warning');
});