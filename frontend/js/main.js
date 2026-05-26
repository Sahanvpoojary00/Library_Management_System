document.addEventListener('DOMContentLoaded', () => {
  // 1. Setup Custom Follower Cursor
  initCustomCursor();

  // 2. Initialize AOS (Animate On Scroll)
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 1000,
      easing: 'ease-out-cubic',
      once: true,
      offset: 60
    });
  }

  // 3. Initialize Lenis (Smooth Scroll)
  if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  // 4. GSAP Intro Sequences & Animations
  if (typeof gsap !== 'undefined') {
    // Brand Logo Animation sequence
    const logoTl = gsap.timeline({ repeat: 0 });
    logoTl.from('.dot-1', { x: -30, y: -30, rotation: -135, opacity: 0, duration: 0.8, ease: 'back.out(1.7)' })
          .from('.dot-2', { x: 30, y: -30, rotation: 135, opacity: 0, duration: 0.8, ease: 'back.out(1.7)' }, '-=0.6')
          .from('.dot-3', { x: -30, y: 30, rotation: 135, opacity: 0, duration: 0.8, ease: 'back.out(1.7)' }, '-=0.6')
          .from('.dot-4', { x: 30, y: 30, rotation: -135, opacity: 0, duration: 0.8, ease: 'back.out(1.7)' }, '-=0.6')
          .to('.logo-grid', { rotation: 360, duration: 1.2, ease: 'power3.inOut' }, '-=0.4');

    // Hero Section Animation timeline
    if (document.querySelector('.hero-section')) {
      const heroTl = gsap.timeline();
      heroTl.from('.navbar', { y: -100, opacity: 0, duration: 1.2, ease: 'power4.out' })
            .from('.hero-badge', { scale: 0.8, opacity: 0, duration: 0.6, ease: 'back.out(2)' }, '-=0.6')
            .from('.hero-content h1', { y: 60, opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.4')
            .from('.hero-content p', { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.6')
            .from('.hero-content .btn', { y: 30, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.15 }, '-=0.6')
            .from('.hero-visual', { scale: 0.95, opacity: 0, duration: 1.2, ease: 'power3.out' }, '-=0.8');

      // Mouse Parallax Depth Listening
      const heroSec = document.querySelector('.hero-section');
      heroSec.addEventListener('mousemove', (e) => {
        const x = (window.innerWidth / 2 - e.clientX) / 35;
        const y = (window.innerHeight / 2 - e.clientY) / 35;

        gsap.to('.depth-1', { x: x * 0.4, y: y * 0.4, ease: 'power2.out', duration: 0.6 });
        gsap.to('.depth-2', { x: x * 0.8, y: y * 0.8, ease: 'power2.out', duration: 0.6 });
        gsap.to('.depth-3', { x: x * 1.3, y: y * 1.3, ease: 'power2.out', duration: 0.6 });
      });
    }

    // Auth Card entrance
    if (document.querySelector('.auth-card')) {
      gsap.from('.auth-card', {
        scale: 0.93,
        opacity: 0,
        duration: 1.2,
        ease: 'power4.out'
      });
    }

    // Dashboard Load sequence
    if (document.querySelector('.dashboard-container')) {
      gsap.from('.sidebar', {
        x: -110,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
      });
      gsap.from('.main-content > *', {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out'
      });
    }
  }

  // 5. Interactive Features Showcase switcher
  const showcaseTabs = document.querySelectorAll('.showcase-tab');
  showcaseTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const activeTab = document.querySelector('.showcase-tab.active');
      const activePanel = document.querySelector('.showcase-panel.active');
      const targetId = tab.dataset.target;
      const targetPanel = document.getElementById(targetId);

      if (activeTab === tab) return;

      activeTab.classList.remove('active');
      tab.classList.add('active');

      if (typeof gsap !== 'undefined') {
        gsap.to(activePanel, {
          opacity: 0,
          y: -15,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: () => {
            activePanel.classList.remove('active');
            targetPanel.classList.add('active');
            gsap.fromTo(targetPanel, 
              { opacity: 0, y: 15 }, 
              { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
            );
          }
        });
      } else {
        activePanel.classList.remove('active');
        targetPanel.classList.add('active');
      }
    });
  });

  // 6. IntersectionObserver stats counter
  const statsCounterSec = document.querySelector('.stats-counter-grid');
  if (statsCounterSec) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counterValues = entry.target.querySelectorAll('.counter-value[data-target]');
          counterValues.forEach(el => {
            const targetVal = parseInt(el.dataset.target, 10);
            const counterObj = { val: 0 };
            
            if (typeof gsap !== 'undefined') {
              gsap.to(counterObj, {
                val: targetVal,
                duration: 2,
                ease: 'power3.out',
                onUpdate: () => {
                  el.textContent = Math.floor(counterObj.val).toLocaleString() + (el.dataset.suffix || '');
                }
              });
            } else {
              el.textContent = targetVal.toLocaleString() + (el.dataset.suffix || '');
            }
          });
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    counterObserver.observe(statsCounterSec);
  }
});

// Custom Follow-Cursor Implementation
function initCustomCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) {
    return;
  }

  const cursor = document.createElement('div');
  cursor.className = 'custom-cursor';
  const follower = document.createElement('div');
  follower.className = 'custom-cursor-follower';

  document.body.appendChild(cursor);
  document.body.appendChild(follower);

  let mouseX = 0, mouseY = 0;
  let followX = 0, followY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    cursor.style.left = mouseX + 'px';
    cursor.style.top = mouseY + 'px';
  });

  function updateFollower() {
    const dx = mouseX - followX;
    const dy = mouseY - followY;
    
    followX += dx * 0.15;
    followY += dy * 0.15;
    
    follower.style.left = followX + 'px';
    follower.style.top = followY + 'px';
    
    requestAnimationFrame(updateFollower);
  }
  updateFollower();

  // Hover animations on trigger targets
  const hoverTargets = 'a, button, .auth-tab, .btn, .menu-link, .close-modal, tr, .showcase-tab';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(hoverTargets)) {
      cursor.classList.add('hover');
      follower.classList.add('hover');
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(hoverTargets)) {
      cursor.classList.remove('hover');
      follower.classList.remove('hover');
    }
  });
}
