window.addEventListener("load", () => {

    const hero = document.querySelector(".hero-left");

    hero.animate(
        [
            { opacity: 0, transform: "translateY(40px)" },
            { opacity: 1, transform: "translateY(0px)" }
        ],
        {
            duration: 1200,
            easing: "ease-out",
            fill: "forwards"
        }
    );

});