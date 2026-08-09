/* ==========================================================================
   Nascent Phoenix - Quiet Emotional Storytelling Platform
   JavaScript Engine (Complete Features & Individual Card Canvas Animations)
   ========================================================================== */

(function () {
  'use strict';

  // State Management
  const state = {
    storiesData: null,
    currentMoodId: 'love',
    currentStory: null,
    savedStoryIds: JSON.parse(localStorage.getItem('np_saved_stories') || '[]'),
    fontSizeIndex: 1, // 0: 1.05rem, 1: 1.2rem, 2: 1.35rem
    fontSizeValues: ['1.05rem', '1.2rem', '1.35rem'],
    isAudioPlaying: false,
    audioContext: null,
    audioNodes: null,
    theme: localStorage.getItem('np_theme') || 'light', // light, dark, sepia
    storyOpenTime: 0
  };

  // Canvas Engines (Background, Live Reader Overlay, and Individual Story Cards)
  let canvas, ctx;
  let modalCanvas, modalCtx;
  let particles = [];
  let modalParticles = [];
  let cardInstances = []; // Holds individual mini-canvas particle instances for each card on the deck
  let mouse = { x: -100, y: -100, isMoving: false };
  let animationFrameId = null;

  /* --------------------------------------------------------------------------
     1. Initialization
     -------------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCanvas();
    loadStoriesData();
    setupEventListeners();
    updateSavedBadge();
  });

  function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
  }

  function toggleTheme() {
    if (state.theme === 'light') state.theme = 'dark';
    else if (state.theme === 'dark') state.theme = 'sepia';
    else state.theme = 'light';

    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('np_theme', state.theme);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (!themeBtn) return;
    if (state.theme === 'dark') {
      themeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>`;
      themeBtn.setAttribute('title', 'Switch to Warm Sepia Bedtime Theme');
    } else if (state.theme === 'sepia') {
      themeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>`;
      themeBtn.setAttribute('title', 'Switch to Soft Cream Theme');
    } else {
      themeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>`;
      themeBtn.setAttribute('title', 'Switch to Muted Charcoal Theme');
    }
  }

  /* --------------------------------------------------------------------------
     2. Story Data Handling
     -------------------------------------------------------------------------- */
  async function loadStoriesData() {
    try {
      const response = await fetch('assets/data/stories.json');
      if (!response.ok) throw new Error('Network response failed');
      state.storiesData = await response.json();
    } catch (err) {
      console.warn('Loading fallback stories data:', err);
      state.storiesData = getFallbackStories();
    }
    renderMoodPills();
    selectMood(state.currentMoodId);
  }

  function renderMoodPills() {
    const container = document.getElementById('mood-pills-bar');
    if (!container || !state.storiesData) return;

    container.innerHTML = '';
    state.storiesData.moods.forEach(mood => {
      const pill = document.createElement('button');
      pill.className = `mood-pill ${mood.id === state.currentMoodId ? 'active' : ''}`;
      pill.dataset.moodId = mood.id;
      pill.style.setProperty('--mood-accent-color', mood.accent);
      pill.style.setProperty('--mood-aura-color', mood.bgAura);

      pill.innerHTML = `
        <span class="mood-dot"></span>
        <span class="mood-name">${mood.name}</span>
      `;

      pill.addEventListener('click', () => selectMood(mood.id));
      container.appendChild(pill);
    });
  }

  function selectMood(moodId) {
    if (!state.storiesData) return;
    const mood = state.storiesData.moods.find(m => m.id === moodId);
    if (!mood) return;

    state.currentMoodId = moodId;

    // Update active pill UI
    document.querySelectorAll('.mood-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.moodId === moodId);
    });

    // Update CSS custom properties
    document.documentElement.style.setProperty('--current-mood-accent', mood.accent);
    document.documentElement.style.setProperty('--current-mood-aura', mood.bgAura);

    // Update Deck Info
    const moodTitleEl = document.getElementById('deck-mood-title');
    const moodTaglineEl = document.getElementById('deck-mood-tagline');
    if (moodTitleEl) moodTitleEl.textContent = mood.name;
    if (moodTaglineEl) moodTaglineEl.textContent = mood.tagline;

    // Render Cards & Mini Canvases
    renderStoryCards(mood.stories, mood);

    // Reset Main Canvas Particles for new mood
    initMoodParticles(moodId);

    // Update audio tone if playing
    if (state.isAudioPlaying) {
      stopAudio();
      startAudio();
    }
  }

  function renderStoryCards(stories, mood) {
    const track = document.getElementById('carousel-track');
    if (!track) return;

    track.innerHTML = '';
    cardInstances = []; // Reset card mini-canvas particle instances

    stories.forEach((story, idx) => {
      const card = document.createElement('article');
      card.className = 'story-card';
      card.style.animationDelay = `${idx * 0.1}s`;
      card.style.setProperty('--card-accent', mood.accent);
      card.style.setProperty('--card-aura', mood.bgAura);

      const isSaved = state.savedStoryIds.includes(story.id);

      // Embedded Live Mini-Canvas inside story card
      card.innerHTML = `
        <canvas class="card-mini-canvas" width="340" height="380"></canvas>
        <div class="card-top">
          <div class="card-top-left">
            <span class="card-read-time">${story.readTime}</span>
            <button class="save-story-btn ${isSaved ? 'saved' : ''}" data-story-id="${story.id}" title="${isSaved ? 'Remove from Saved' : 'Save for Quiet Nights'}">
              <svg viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          <span class="card-mood-badge">${mood.name}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${story.title}</h3>
          <p class="card-excerpt">${story.excerpt}</p>
        </div>
        <div class="card-footer">
          <span class="card-action-text">
            Read story
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </span>
        </div>
      `;

      // Instantiate Card Mini-Canvas Engine
      const cCanvas = card.querySelector('.card-mini-canvas');
      if (cCanvas) {
        const cCtx = cCanvas.getContext('2d');
        const cParticles = [];
        for (let i = 0; i < 18; i++) {
          const p = createParticleForMood(mood.id, cCanvas);
          p.alpha = Math.random() * 0.45 + 0.2;
          cParticles.push(p);
        }
        cardInstances.push({
          canvas: cCanvas,
          ctx: cCtx,
          particles: cParticles
        });
      }

      // Save bookmark toggle button listener
      const saveBtn = card.querySelector('.save-story-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSaveStory(story.id);
        });
      }

      // Card 3D Tilt Physics
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        card.style.transform = `perspective(1000px) rotateX(${-y / 20}deg) rotateY(${x / 20}deg) translateY(-4px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
      });

      card.addEventListener('click', () => openStoryModal(story, mood));
      track.appendChild(card);
    });

    const wrapper = document.getElementById('carousel-track-wrapper');
    if (wrapper) wrapper.scrollLeft = 0;
    updateCarouselNavState();
  }

  /* --------------------------------------------------------------------------
     3. Story Reading Modal & Mood Closing Transitions
     -------------------------------------------------------------------------- */
  function openStoryModal(story, mood) {
    state.currentStory = story;
    state.storyOpenTime = Date.now();

    const modal = document.getElementById('reading-modal');
    const container = document.getElementById('modal-container');
    if (!modal || !container) return;

    // Reset closing animation classes
    container.className = 'modal-container';
    modal.style.setProperty('--modal-accent', mood.accent);

    document.getElementById('reading-mood-badge').textContent = mood.name;
    document.getElementById('reading-title').textContent = story.title;
    document.getElementById('reading-subtitle').textContent = story.subtitle || '';
    
    // Paragraphs
    const bodyEl = document.getElementById('reading-body');
    const paragraphs = story.content.split('\n\n').filter(p => p.trim().length > 0);
    bodyEl.innerHTML = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');

    // Reflection Box
    document.getElementById('reflection-quote').textContent = story.reflection || 'Take a breath. Carry this light with you.';

    updateReadingProgress(0);

    // Show Modal
    modal.classList.add('active');
    modal.scrollTop = 0;
    document.body.style.overflow = 'hidden';

    resizeCanvas();
    initModalParticles(mood.id);
  }

  function closeStoryModal() {
    const modal = document.getElementById('reading-modal');
    const container = document.getElementById('modal-container');
    if (!modal || !container) return;

    // Apply Mood-Matched Exit Animation Transition
    const moodId = state.currentMoodId || 'love';
    container.classList.add(`closing-${moodId}`);

    // Elapsed Time Notification ("Time Spent in Peace")
    const elapsedMs = Date.now() - state.storyOpenTime;
    const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    
    setTimeout(() => {
      modal.classList.remove('active');
      container.className = 'modal-container';
      document.body.style.overflow = '';

      if (elapsedMs > 20000) { // show toast if read for > 20s
        showPeaceToast(`You spent ${elapsedMinutes} quiet ${elapsedMinutes === 1 ? 'minute' : 'minutes'} with yourself tonight.`);
      }
    }, 450);
  }

  function updateFontSize(direction) {
    if (direction === 'increase' && state.fontSizeIndex < 2) state.fontSizeIndex++;
    if (direction === 'decrease' && state.fontSizeIndex > 0) state.fontSizeIndex--;
    if (direction === 'reset') state.fontSizeIndex = 1;

    const size = state.fontSizeValues[state.fontSizeIndex];
    document.documentElement.style.setProperty('--user-font-size', size);
  }

  function updateReadingProgress(progressPercent) {
    const bar = document.getElementById('reading-progress-bar');
    if (bar) bar.style.width = `${progressPercent}%`;
  }

  /* --------------------------------------------------------------------------
     4. Saved Stories Local Bookmark System
     -------------------------------------------------------------------------- */
  function toggleSaveStory(storyId) {
    const idx = state.savedStoryIds.indexOf(storyId);
    if (idx >= 0) {
      state.savedStoryIds.splice(idx, 1);
    } else {
      state.savedStoryIds.push(storyId);
    }
    localStorage.setItem('np_saved_stories', JSON.stringify(state.savedStoryIds));
    
    updateSavedBadge();
    if (state.storiesData) {
      const mood = state.storiesData.moods.find(m => m.id === state.currentMoodId);
      if (mood) renderStoryCards(mood.stories, mood);
    }
  }

  function updateSavedBadge() {
    const badge = document.getElementById('saved-badge');
    if (!badge) return;
    const count = state.savedStoryIds.length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function openSavedDrawer() {
    const drawer = document.getElementById('saved-drawer-modal');
    const list = document.getElementById('saved-drawer-list');
    if (!drawer || !list || !state.storiesData) return;

    list.innerHTML = '';
    const allStories = [];
    state.storiesData.moods.forEach(m => {
      m.stories.forEach(s => {
        if (state.savedStoryIds.includes(s.id)) {
          allStories.push({ story: s, mood: m });
        }
      });
    });

    if (allStories.length === 0) {
      list.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem 0;">No stories bookmarked yet. Click the heart icon on any card to save it for quiet nights.</p>`;
    } else {
      allStories.forEach(({ story, mood }) => {
        const item = document.createElement('div');
        item.className = 'saved-item-card';
        item.innerHTML = `
          <span style="font-size: 0.75rem; color: ${mood.accent}; font-weight: 600; text-transform: uppercase;">${mood.name} • ${story.readTime}</span>
          <h4 class="saved-item-title">${story.title}</h4>
          <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.4;">${story.excerpt}</p>
        `;
        item.addEventListener('click', () => {
          closeSavedDrawer();
          openStoryModal(story, mood);
        });
        list.appendChild(item);
      });
    }

    drawer.classList.add('active');
  }

  function closeSavedDrawer() {
    const drawer = document.getElementById('saved-drawer-modal');
    if (drawer) drawer.classList.remove('active');
  }

  function showPeaceToast(message) {
    const toast = document.getElementById('peace-toast');
    const msgEl = document.getElementById('toast-message');
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    toast.classList.add('active');

    setTimeout(() => {
      toast.classList.remove('active');
    }, 4500);
  }

  /* --------------------------------------------------------------------------
     5. Event Listeners & Navigation
     -------------------------------------------------------------------------- */
  function setupEventListeners() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    const audioBtn = document.getElementById('audio-toggle-btn');
    if (audioBtn) audioBtn.addEventListener('click', toggleAudio);

    const savedBtn = document.getElementById('saved-stories-btn');
    const closeSavedBtn = document.getElementById('close-saved-drawer-btn');
    const savedDrawer = document.getElementById('saved-drawer-modal');

    if (savedBtn) savedBtn.addEventListener('click', openSavedDrawer);
    if (closeSavedBtn) closeSavedBtn.addEventListener('click', closeSavedDrawer);
    if (savedDrawer) {
      savedDrawer.addEventListener('click', (e) => {
        if (e.target === savedDrawer) closeSavedDrawer();
      });
    }

    const closeBtn = document.getElementById('close-modal-btn');
    const finishBtn = document.getElementById('finish-reading-btn');
    const modalOverlay = document.getElementById('reading-modal');

    if (closeBtn) closeBtn.addEventListener('click', closeStoryModal);
    if (finishBtn) finishBtn.addEventListener('click', closeStoryModal);
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeStoryModal();
      });

      modalOverlay.addEventListener('scroll', () => {
        const totalHeight = modalOverlay.scrollHeight - modalOverlay.clientHeight;
        if (totalHeight > 0) {
          const percent = (modalOverlay.scrollTop / totalHeight) * 100;
          updateReadingProgress(percent);
        }
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('reading-modal');
      const drawer = document.getElementById('saved-drawer-modal');

      if (e.key === 'Escape') {
        closeStoryModal();
        closeSavedDrawer();
      } else if (!modal?.classList.contains('active') && !drawer?.classList.contains('active')) {
        const wrapper = document.getElementById('carousel-track-wrapper');
        if (e.key === 'ArrowRight' && wrapper) {
          wrapper.scrollBy({ left: 360, behavior: 'smooth' });
        } else if (e.key === 'ArrowLeft' && wrapper) {
          wrapper.scrollBy({ left: -360, behavior: 'smooth' });
        }
      }
    });

    const fontInc = document.getElementById('font-increase-btn');
    const fontDec = document.getElementById('font-decrease-btn');
    if (fontInc) fontInc.addEventListener('click', () => updateFontSize('increase'));
    if (fontDec) fontDec.addEventListener('click', () => updateFontSize('decrease'));

    const prevBtn = document.getElementById('carousel-prev-btn');
    const nextBtn = document.getElementById('carousel-next-btn');
    const wrapper = document.getElementById('carousel-track-wrapper');

    if (prevBtn && wrapper) {
      prevBtn.addEventListener('click', () => {
        wrapper.scrollBy({ left: -360, behavior: 'smooth' });
      });
    }
    if (nextBtn && wrapper) {
      nextBtn.addEventListener('click', () => {
        wrapper.scrollBy({ left: 360, behavior: 'smooth' });
      });
    }
    if (wrapper) {
      wrapper.addEventListener('scroll', updateCarouselNavState);

      let isDown = false;
      let startX, scrollLeft;

      wrapper.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - wrapper.offsetLeft;
        scrollLeft = wrapper.scrollLeft;
      });
      wrapper.addEventListener('mouseleave', () => { isDown = false; });
      wrapper.addEventListener('mouseup', () => { isDown = false; });
      wrapper.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - wrapper.offsetLeft;
        const walk = (x - startX) * 1.5;
        wrapper.scrollLeft = scrollLeft - walk;
      });
    }

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.isMoving = true;
    });
  }

  function updateCarouselNavState() {
    const wrapper = document.getElementById('carousel-track-wrapper');
    const prevBtn = document.getElementById('carousel-prev-btn');
    const nextBtn = document.getElementById('carousel-next-btn');
    if (!wrapper || !prevBtn || !nextBtn) return;

    const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
    prevBtn.disabled = wrapper.scrollLeft <= 5;
    nextBtn.disabled = wrapper.scrollLeft >= maxScroll - 5;
  }

  /* --------------------------------------------------------------------------
     6. Per-Mood Web Audio Ambient Synthesizer
     -------------------------------------------------------------------------- */
  function toggleAudio() {
    if (state.isAudioPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  }

  function startAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!state.audioContext) {
        state.audioContext = new AudioCtx();
      }
      if (state.audioContext.state === 'suspended') {
        state.audioContext.resume();
      }

      const mood = state.currentMoodId || 'love';

      // Pink noise rain rustle
      const bufferSize = 2 * state.audioContext.sampleRate;
      const noiseBuffer = state.audioContext.createBuffer(1, bufferSize, state.audioContext.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.018;
        b6 = white * 0.115926;
      }

      const whiteNoise = state.audioContext.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = state.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(mood === 'sad' ? 450 : 650, state.audioContext.currentTime);

      // Low Sine Pad drone tailored to mood pitch
      const osc = state.audioContext.createOscillator();
      osc.type = 'sine';
      
      const pitchMap = {
        love: 220,      // A3 warm chord
        sad: 110,       // A2 deep rain bass
        inspiring: 136.1,// Om tone
        heartbroken: 146.8, // D3 soft violet tone
        funny: 196,     // G3 bright tone
        calm: 174,      // Solfeggio 174 Hz pain/anxiety relief
        nostalgic: 220
      };
      
      osc.frequency.setValueAtTime(pitchMap[mood] || 136.1, state.audioContext.currentTime);

      const oscGain = state.audioContext.createGain();
      oscGain.gain.setValueAtTime(0.018, state.audioContext.currentTime);

      const masterGain = state.audioContext.createGain();
      masterGain.gain.setValueAtTime(0.65, state.audioContext.currentTime);

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      masterGain.connect(state.audioContext.destination);

      whiteNoise.start();
      osc.start();

      state.audioNodes = { whiteNoise, osc, masterGain };
      state.isAudioPlaying = true;
      updateAudioBtnUI();
    } catch (e) {
      console.warn('Audio context init failed:', e);
    }
  }

  function stopAudio() {
    if (state.audioNodes) {
      try {
        state.audioNodes.whiteNoise.stop();
        state.audioNodes.osc.stop();
      } catch (e) {}
      state.audioNodes = null;
    }
    state.isAudioPlaying = false;
    updateAudioBtnUI();
  }

  function updateAudioBtnUI() {
    const btn = document.getElementById('audio-toggle-btn');
    if (!btn) return;
    btn.classList.toggle('active', state.isAudioPlaying);
    btn.setAttribute('title', state.isAudioPlaying ? 'Mute Mood Soundscape' : 'Enable Mood Soundscape');
    const pulse = btn.querySelector('.audio-pulse');
    if (pulse) pulse.style.display = state.isAudioPlaying ? 'block' : 'none';
  }

  /* --------------------------------------------------------------------------
     7. Multi-Canvas Dynamic Particle Engine
     -------------------------------------------------------------------------- */
  function initCanvas() {
    canvas = document.getElementById('bg-canvas');
    modalCanvas = document.getElementById('modal-canvas');

    if (canvas) ctx = canvas.getContext('2d');
    if (modalCanvas) modalCtx = modalCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    initMoodParticles('love');
    animate();
  }

  function resizeCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas) { canvas.width = w; canvas.height = h; }
    if (modalCanvas) { modalCanvas.width = w; modalCanvas.height = h; }
  }

  function initMoodParticles(moodId) {
    particles = [];
    const num = Math.min(Math.floor(window.innerWidth / 18), 50);

    for (let i = 0; i < num; i++) {
      particles.push(createParticleForMood(moodId, canvas));
    }
  }

  function initModalParticles(moodId) {
    modalParticles = [];
    const num = Math.min(Math.floor(window.innerWidth / 16), 40);

    for (let i = 0; i < num; i++) {
      const p = createParticleForMood(moodId, modalCanvas);
      p.alpha = Math.random() * 0.4 + 0.25;
      p.size = p.size * 1.25;
      modalParticles.push(p);
    }
  }

  function createParticleForMood(moodId, targetCanvas) {
    const w = targetCanvas ? targetCanvas.width : window.innerWidth;
    const h = targetCanvas ? targetCanvas.height : window.innerHeight;

    const base = {
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() * 3 + 1.2,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.45 + 0.18,
      pulse: Math.random() * 0.015 + 0.005
    };

    switch (moodId) {
      case 'love':
        base.speedY = -Math.random() * 0.45 - 0.15;
        base.color = '217, 138, 125';
        base.size = Math.random() * 4.5 + 2.2;
        break;

      case 'sad':
        base.speedY = Math.random() * 1.8 + 0.9;
        base.speedX = -0.3;
        base.size = Math.random() * 2.5 + 1.2;
        base.color = '108, 125, 147';
        break;

      case 'inspiring':
        base.speedY = -Math.random() * 0.9 - 0.4;
        base.speedX = (Math.random() - 0.5) * 0.6;
        base.color = '214, 149, 54';
        base.size = Math.random() * 4 + 1.8;
        break;

      case 'heartbroken':
        base.speedX = Math.random() * 0.5 + 0.12;
        base.speedY = (Math.random() - 0.5) * 0.25;
        base.color = '142, 122, 147';
        base.size = Math.random() * 3.5 + 1.2;
        break;

      case 'funny':
        base.size = Math.random() * 9 + 4.5;
        base.speedX = (Math.random() - 0.5) * 0.9;
        base.speedY = (Math.random() - 0.5) * 0.9;
        base.color = '229, 122, 96';
        base.alpha = Math.random() * 0.35 + 0.15;
        break;

      case 'calm':
        base.size = Math.random() * 5.5 + 3.2;
        base.speedX = (Math.random() - 0.5) * 0.22;
        base.speedY = (Math.random() - 0.5) * 0.22;
        base.color = '113, 146, 128';
        break;

      case 'nostalgic':
      default:
        base.size = Math.random() * 3.5 + 1.2;
        base.speedX = (Math.random() - 0.5) * 0.35;
        base.speedY = (Math.random() - 0.5) * 0.35;
        base.color = '184, 114, 88';
        break;
    }

    return base;
  }

  function renderParticleSet(context, targetCanvas, pList) {
    if (!context || !targetCanvas || !pList.length) return;

    context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    pList.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;

      if (p.y < -10) p.y = targetCanvas.height + 10;
      if (p.y > targetCanvas.height + 10) p.y = -10;
      if (p.x < -10) p.x = targetCanvas.width + 10;
      if (p.x > targetCanvas.width + 10) p.x = -10;

      p.alpha += p.pulse;
      if (p.alpha > 0.7 || p.alpha < 0.12) p.pulse = -p.pulse;

      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fillStyle = `rgba(${p.color}, ${p.alpha})`;
      context.fill();
    });
  }

  function animate() {
    // 1. Render main background canvas
    if (ctx && canvas) {
      renderParticleSet(ctx, canvas, particles);
    }

    // 2. Render live reading modal overlay canvas if active
    const modal = document.getElementById('reading-modal');
    if (modalCtx && modalCanvas && modal && modal.classList.contains('active')) {
      renderParticleSet(modalCtx, modalCanvas, modalParticles);
    }

    // 3. Render individual mini-canvas animations for every story card on the deck
    if (cardInstances.length > 0) {
      cardInstances.forEach(item => {
        renderParticleSet(item.ctx, item.canvas, item.particles);
      });
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  /* --------------------------------------------------------------------------
     8. Fallback Data Safeguard
     -------------------------------------------------------------------------- */
  function getFallbackStories() {
    return {
      moods: [
        {
          id: 'love',
          name: 'Love',
          tagline: 'Warmth for the tender and open heart',
          accent: '#D98A7D',
          bgAura: 'rgba(217, 138, 125, 0.15)',
          stories: [
            {
              id: 'love-1',
              title: 'The Teacup on the Windowsill',
              subtitle: 'A small gesture across a quiet morning',
              readTime: '5 min read',
              excerpt: 'Steam rose gently from the porcelain mug...',
              content: 'Long before the first amber rays of sunlight crept over the misty eastern hills, Clara found herself standing in the quiet chill of the kitchen...',
              reflection: 'Notice the warmth in your hands right now.'
            }
          ]
        }
      ]
    };
  }

})();