document.addEventListener("DOMContentLoaded", () => {
    // Mobile navigation toggle
    const mobileToggle = document.getElementById("mobileToggle");
    const navMenu = document.getElementById("navMenu");

    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener("click", () => {
            navMenu.classList.toggle("active");
        });

        // Close mobile menu when clicking any nav link
        navMenu.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("active");
            });
        });
    }

    // IntersectionObserver for scroll entry animations on cards and titles
    const animatedElements = document.querySelectorAll(".service-card, .why-card, .contact-item, .section-title");

    if ("IntersectionObserver" in window && animatedElements.length > 0) {
        // Set initial state
        animatedElements.forEach(el => {
            el.style.opacity = "0";
            el.style.transform = "translateY(24px)";
            el.style.transition = "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)";
        });

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = "1";
                    entry.target.style.transform = "translateY(0)";
                    obs.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: "0px 0px -40px 0px"
        });

        animatedElements.forEach(el => observer.observe(el));
    }
});