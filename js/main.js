// Mobile menu toggle
(function () {
    var toggle = document.querySelector(".mobile-menu-toggle");
    var mobileMenu = document.getElementById("mobile-menu");
    var closeBtn = document.getElementById("mobile-menu-close");
    if (!toggle || !mobileMenu || !closeBtn) return;

    var lines = toggle.querySelectorAll(".hamburger-line");
    var links = mobileMenu.querySelectorAll("a");

    function closeMenu() {
        mobileMenu.classList.remove("active");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
        lines[0].style.transform = "none";
        lines[1].style.opacity = "1";
        lines[2].style.transform = "none";
    }

    function openMenu() {
        mobileMenu.classList.add("active");
        toggle.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
        lines[0].style.transform = "rotate(45deg) translate(5px, 5px)";
        lines[1].style.opacity = "0";
        lines[2].style.transform = "rotate(-45deg) translate(5px, -5px)";
    }

    toggle.addEventListener("click", function () {
        if (mobileMenu.classList.contains("active")) closeMenu();
        else openMenu();
    });
    closeBtn.addEventListener("click", closeMenu);
    for (var i = 0; i < links.length; i++) links[i].addEventListener("click", closeMenu);
})();

// Scroll reveals
(function () {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
        for (var i = 0; i < items.length; i++) items[i].classList.add("is-visible");
        return;
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    for (var j = 0; j < items.length; j++) observer.observe(items[j]);
})();

// The rally: hover or tap the court to pick up the pace
(function () {
    var rally = document.getElementById("rally");
    if (!rally) return;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    var hint = rally.querySelector(".rally-hint");
    var timer = null;

    function fast(on) {
        rally.classList.toggle("fast", on);
        if (on && hint) hint.style.opacity = "0";
    }

    rally.addEventListener("mouseenter", function () { fast(true); });
    rally.addEventListener("mouseleave", function () { fast(false); });

    // On touch there is no hover, so a tap gives a few seconds of fast play
    rally.addEventListener("touchstart", function () {
        fast(true);
        clearTimeout(timer);
        timer = setTimeout(function () { fast(false); }, 4000);
    }, { passive: true });
})();

// Footer year
(function () {
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
})();
