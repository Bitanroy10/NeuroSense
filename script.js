document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        // Toggle Icon between Bars and X
        if(navLinks.classList.contains('active')) {
            hamburger.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        } else {
            hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
        }
    });

    // Close mobile menu when a link is clicked
    document.querySelectorAll('.nav-links li a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
        });
    });

    // Simple Contact Form submission intercept
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            alert(`Thank you, ${name}! Your objective request for Neurosense has been received.`);
            contactForm.reset();
        });
    }
});