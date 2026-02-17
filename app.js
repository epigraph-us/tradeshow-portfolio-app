/* app.js — Vercel Edge Version */
// Using window.EXP_DATA from experiences_data_v5.js
const experiences = window.EXP_DATA.experiences;
const sections = window.EXP_DATA.sections;

// DOM Elements
const mainContainer = document.getElementById('main-content');
const searchInput = document.getElementById('search-input');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const errorMessage = document.getElementById('error-message');
const viewToggle = document.getElementById('view-toggle');

// Modal Elements
const modal = document.getElementById('slideshow-modal');
const modalClose = document.getElementById('modal-close');
const modalPrev = document.getElementById('modal-prev');
const modalNext = document.getElementById('modal-next');
const modalMediaContainer = document.getElementById('modal-media-container');
const modalThumbnails = document.getElementById('modal-thumbnails');

// Icons
const ICONS = {
    search: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    wifi: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="status-icon"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>',
    download: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="status-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
    eye: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="status-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
};

// State
let isCompactView = localStorage.getItem('isCompactView') === 'true';
let searchTerm = '';
let currentSlides = [];
let currentSlideIndex = 0;
const openedWindows = {};

// --- IMAGE LOADING QUEUE ---
const imageQueue = [];
let activeLoads = 0;
const MAX_CONCURRENT_LOADS = 6;

function queueImageLoad(imgElement, src) {
    imageQueue.push({ img: imgElement, src: src });
    processImageQueue();
}

function processImageQueue() {
    while (activeLoads < MAX_CONCURRENT_LOADS && imageQueue.length > 0) {
        const item = imageQueue.shift();
        activeLoads++;
        item.img.onload = function() {
            activeLoads--;
            processImageQueue();
        };
        item.img.onerror = function() {
            activeLoads--;
            try {
                var parent = this.parentElement;
                if (parent) {
                    var letter = this.alt ? this.alt[0] : '?';
                    parent.innerHTML = '<span>' + letter + '</span>';
                    parent.classList.add('placeholder');
                }
            } catch(e) { /* ignore */ }
            processImageQueue();
        };
        item.img.src = item.src;
    }
}

function openExperience(url, name) {
    let win = window.open('', name);

    if (win) {
        win.focus();
        updateStatusUI(name, true);
        monitorWindow(win, name);

        setTimeout(() => {
            try {
                if (win.location.href === 'about:blank') {
                    console.log("Window is blank. Loading URL...");
                    win.location.href = url;
                    showToast(`Opening "${name}"...`);
                } else {
                    console.log("Window already loaded.");
                    showToast(`Switched to "${name}" tab.`);
                }
            } catch (e) {
                console.log("Cross-origin check failed (Expected for external sites):", e);
                showToast(`"${name}" is open. Check your tabs.`);
            }
        }, 200);

    } else {
        console.log("Window lookup returned null. Opening fresh.");
        const newWin = window.open(url, name);
        if (newWin) {
            updateStatusUI(name, true);
            monitorWindow(newWin, name);
            showToast(`Opening "${name}"...`);
        }
    }
}

function updateStatusUI(id, isOpen) {
    const statusEl = document.getElementById(`status-${id}`);
    if (statusEl) {
        if (isOpen) {
            statusEl.style.display = 'flex';
            statusEl.classList.add('active');
        } else {
            statusEl.style.display = 'none';
            statusEl.classList.remove('active');
        }
    }
}

function monitorWindow(win, id) {
    if (window.pollers && window.pollers[id]) {
        clearInterval(window.pollers[id]);
    }
    if (!window.pollers) window.pollers = {};

    console.log(`Starting monitoring for ${id}`);

    const poller = setInterval(() => {
        if (win.closed) {
            console.log(`Window ${id} detected closed.`);
            updateStatusUI(id, false);
            clearInterval(poller);
            delete window.pollers[id];
        }
    }, 1000);

    window.pollers[id] = poller;
}

function isTouchDevice() {
    return (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0));
}

function showToast(message) {
    console.log("Showing toast:", message);

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('visible'), 100);

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

// --- ONLINE/OFFLINE AWARENESS ---
// On Vercel, we're always online. Keep the badge for visual consistency.
let isOnline = true;

function setOnlineStatus(online) {
    isOnline = online;
    var statusEl = document.getElementById('connection-status');
    var labelEl = document.getElementById('connection-label');

    if (statusEl) {
        if (isOnline) {
            statusEl.classList.remove('offline');
            statusEl.classList.add('online');
            if (labelEl) labelEl.textContent = 'Online';
        } else {
            statusEl.classList.remove('online');
            statusEl.classList.add('offline');
            if (labelEl) labelEl.textContent = 'Offline';
        }
    }

    document.querySelectorAll('.card[data-online-only="true"]').forEach(function(card) {
        if (isOnline) {
            card.classList.remove('offline-unavailable');
        } else {
            card.classList.add('offline-unavailable');
        }
    });
}

function updateConnectionStatus() {
    // On Vercel: use navigator.onLine (reliable when truly hosted online)
    setOnlineStatus(navigator.onLine);
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// Initialize
function init() {
    try {
        console.log("Initializing App...");
        if (!experiences || !sections) {
            throw new Error("Data not loaded. Check experiences_data.js");
        }

        renderAllSections();
        setupModalListeners();
        initViewToggle();
        updateConnectionStatus();

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchTerm = e.target.value.toLowerCase();
                renderAllSections();
            });
        }

        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
            }, 500);
        }

    } catch (e) {
        showError(e);
    }
}

function showError(e) {
    console.error(e);
    if (loadingText) loadingText.style.display = 'none';
    if (errorMessage) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = `Error loading experiences: ${e.message}`;
    }
}

// Render Logic
function renderAllSections() {
    if (!mainContainer) return;
    mainContainer.innerHTML = '';
    let totalItems = 0;

    sections.forEach(sectionName => {
        const sectionItems = experiences.filter(exp => exp.section === sectionName);

        const filteredItems = sectionItems.filter(exp => {
            if (!searchTerm) return true;
            return exp.title.toLowerCase().includes(searchTerm) ||
                (exp.description && exp.description.toLowerCase().includes(searchTerm)) ||
                exp.tags.some(t => t.toLowerCase().includes(searchTerm));
        });

        if (filteredItems.length > 0) {
            renderSection(sectionName, filteredItems);
            totalItems += filteredItems.length;
        }
    });

    if (totalItems === 0 && searchTerm) {
        mainContainer.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #666; font-size: 1.2rem;">
                No results found for "${searchTerm}"
            </div>
        `;
    }
}

function renderSection(title, items) {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'section-container';

    const titleEl = document.createElement('h2');
    titleEl.className = 'section-title';
    titleEl.textContent = title;
    sectionEl.appendChild(titleEl);

    const gridEl = document.createElement('div');
    gridEl.className = isCompactView ? 'grid compact' : 'grid';

    items.forEach(exp => {
        const card = createCard(exp);
        gridEl.appendChild(card);
    });

    sectionEl.appendChild(gridEl);
    mainContainer.appendChild(sectionEl);
}

function createCard(exp) {
    const card = document.createElement('a');

    const hasSlides = exp.slides && exp.slides.length > 0;

    if (hasSlides) {
        card.href = "#";
        card.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(exp.slides);
        });
    } else {
        const targetUrl = exp.isOfflineReady ? exp.localPath : exp.onlineUrl;
        const targetId = exp.id;

        card.href = targetUrl;

        card.addEventListener('click', (e) => {
            e.preventDefault();
            openExperience(targetUrl, targetId);
        });
    }

    card.className = 'card';

    const isOnlineOnly = !exp.isOfflineReady && !hasSlides;
    if (isOnlineOnly) {
        card.setAttribute('data-online-only', 'true');
        if (!isOnline) {
            card.classList.add('offline-unavailable');
        }
    }

    const statusHTML = `
        <div class="status-indicator" id="status-${exp.id}" style="display: none;" title="Open">
            ${ICONS.eye}
        </div>
    `;

    const typeBadge = isOnlineOnly
        ? `${exp.type} <span class="wifi-badge">WiFi</span>`
        : (hasSlides ? `${exp.type} (Slides)` : exp.type);

    const tagsHTML = exp.tags.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('');

    const hasThumbnail = exp.thumbnail && !exp.thumbnail.includes('placeholder');
    const microSrc = exp.microThumb || '';
    const placeholderLetter = exp.title ? exp.title[0] : '?';

    if (hasThumbnail && microSrc) {
        card.innerHTML = `
            <div class="type-badge">${typeBadge}</div>
            ${statusHTML}
            <div class="card-image">
                <img src="${microSrc}" alt="${exp.title}" style="filter:blur(3px);transform:scale(1.1);" data-fullsrc="${exp.thumbnail}">
            </div>
            <div class="card-content">
                <h2>${exp.title}</h2>
                <p>${exp.description}</p>
                <div class="tags">${tagsHTML}</div>
            </div>
        `;

        var imgEl = card.querySelector('.card-image img');
        if (imgEl) {
            queueImageLoad(imgEl, exp.thumbnail);
            imgEl.addEventListener('load', function onFullLoad() {
                imgEl.removeEventListener('load', onFullLoad);
                imgEl.style.filter = '';
                imgEl.style.transform = '';
            });
        }
    } else if (hasThumbnail) {
        card.innerHTML = `
            <div class="type-badge">${typeBadge}</div>
            ${statusHTML}
            <div class="card-image placeholder"><span>${placeholderLetter}</span></div>
            <div class="card-content">
                <h2>${exp.title}</h2>
                <p>${exp.description}</p>
                <div class="tags">${tagsHTML}</div>
            </div>
        `;
        var imgEl2 = document.createElement('img');
        imgEl2.alt = exp.title;
        var cardImageDiv = card.querySelector('.card-image');
        queueImageLoad(imgEl2, exp.thumbnail);
        imgEl2.addEventListener('load', function() {
            if (cardImageDiv) {
                cardImageDiv.classList.remove('placeholder');
                cardImageDiv.innerHTML = '';
                cardImageDiv.appendChild(imgEl2);
            }
        });
    } else {
        card.innerHTML = `
            <div class="type-badge">${typeBadge}</div>
            ${statusHTML}
            <div class="card-image placeholder"><span>${placeholderLetter}</span></div>
            <div class="card-content">
                <h2>${exp.title}</h2>
                <p>${exp.description}</p>
                <div class="tags">${tagsHTML}</div>
            </div>
        `;
    }

    return card;
}

// --- MODAL LOGIC ---

function setupModalListeners() {
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalPrev) modalPrev.addEventListener('click', prevSlide);
    if (modalNext) modalNext.addEventListener('click', nextSlide);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('visible')) return;
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') prevSlide();
        if (e.key === 'ArrowRight') nextSlide();
    });
}

function openModal(slides) {
    if (!slides || slides.length === 0) return;
    currentSlides = slides;
    currentSlideIndex = 0;

    renderSlide();
    renderThumbnails();

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.add('visible');
    });
}

function closeModal() {
    modal.classList.remove('visible');
    setTimeout(() => {
        modal.classList.add('hidden');
        modalMediaContainer.innerHTML = '';
    }, 300);
}

function renderSlide() {
    const slide = currentSlides[currentSlideIndex];
    modalMediaContainer.innerHTML = '';

    if (slide.type === 'video') {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;';

        const loader = document.createElement('div');
        loader.className = 'video-loader';
        loader.innerHTML = '<div class="video-loader-spinner"></div><p>Loading video...</p>';
        wrapper.appendChild(loader);

        const video = document.createElement('video');
        video.controls = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.style.opacity = '0';
        video.style.transition = 'opacity 0.3s ease';

        video.addEventListener('canplay', function onCanPlay() {
            video.removeEventListener('canplay', onCanPlay);
            loader.style.display = 'none';
            video.style.opacity = '1';
            video.play().catch(function(e) {
                console.log('Autoplay prevented (expected on iPad):', e.message);
            });
        });

        let retryCount = 0;
        video.addEventListener('error', function onError() {
            if (retryCount < 2) {
                retryCount++;
                console.log('Video load error, retry ' + retryCount + '/2: ' + slide.path);
                loader.innerHTML = '<div class="video-loader-spinner"></div><p>Retrying... (' + retryCount + '/2)</p>';
                setTimeout(function() {
                    video.src = slide.path;
                    video.load();
                }, 1000);
            } else {
                console.error('Video failed after retries:', slide.path);
                loader.innerHTML = '<p style="color:#ff6b6b;">Video failed to load.<br>Tap to retry.</p>';
                loader.style.cursor = 'pointer';
                loader.addEventListener('click', function() {
                    retryCount = 0;
                    loader.innerHTML = '<div class="video-loader-spinner"></div><p>Loading video...</p>';
                    loader.style.cursor = '';
                    video.src = slide.path;
                    video.load();
                });
            }
        });

        video.src = slide.path;
        wrapper.appendChild(video);
        modalMediaContainer.appendChild(wrapper);
    } else {
        const img = document.createElement('img');
        img.src = slide.path;
        modalMediaContainer.appendChild(img);
    }

    updateThumbnailActiveState();
}

function renderThumbnails() {
    modalThumbnails.innerHTML = '';
    currentSlides.forEach((slide, index) => {
        let thumbSrc = slide.thumbnail;

        if (thumbSrc) {
            const img = document.createElement('img');
            img.src = thumbSrc;
            img.className = 'modal-thumb';
            if (index === currentSlideIndex) img.classList.add('active');

            let elementToAdd;

            if (slide.type === 'video') {
                const wrapper = document.createElement('div');
                wrapper.className = 'video-thumb-container';
                wrapper.appendChild(img);
                elementToAdd = wrapper;
            } else {
                elementToAdd = img;
            }

            elementToAdd.addEventListener('click', () => {
                currentSlideIndex = index;
                renderSlide();
            });
            modalThumbnails.appendChild(elementToAdd);

        } else if (slide.type === 'video') {
            const div = document.createElement('div');
            div.className = 'modal-thumb modal-thumb-video';
            div.style.backgroundColor = '#333';
            if (index === currentSlideIndex) div.classList.add('active');

            div.addEventListener('click', () => {
                currentSlideIndex = index;
                renderSlide();
            });
            modalThumbnails.appendChild(div);
        }
    });
}

function updateThumbnailActiveState() {
    const thumbs = modalThumbnails.children;
    for (let i = 0; i < thumbs.length; i++) {
        const child = thumbs[i];
        const target = (child.tagName === 'DIV' && child.classList.contains('video-thumb-container'))
            ? child.querySelector('img')
            : child;

        if (i === currentSlideIndex) target.classList.add('active');
        else target.classList.remove('active');
    }
}

function nextSlide() {
    currentSlideIndex = (currentSlideIndex + 1) % currentSlides.length;
    renderSlide();
}

function prevSlide() {
    currentSlideIndex = (currentSlideIndex - 1 + currentSlides.length) % currentSlides.length;
    renderSlide();
}

function initViewToggle() {
    if (!viewToggle) return;

    updateToggleIcon();

    viewToggle.addEventListener('click', () => {
        isCompactView = !isCompactView;
        localStorage.setItem('isCompactView', isCompactView);

        document.querySelectorAll('.grid').forEach(grid => {
            if (isCompactView) grid.classList.add('compact');
            else grid.classList.remove('compact');
        });

        updateToggleIcon();
        showToast(isCompactView ? 'Compact View' : 'Standard View');
    });
}

function updateToggleIcon() {
    if (!viewToggle) return;
    const gridIcon = viewToggle.querySelector('.icon-grid');
    const listIcon = viewToggle.querySelector('.icon-list');

    if (isCompactView) {
        if (gridIcon) gridIcon.style.display = 'block';
        if (listIcon) listIcon.style.display = 'none';
        viewToggle.title = "Switch to Standard View";
    } else {
        if (gridIcon) gridIcon.style.display = 'none';
        if (listIcon) listIcon.style.display = 'block';
        viewToggle.title = "Switch to Compact View";
    }
}

// Run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.onerror = function (msg, url, line) {
    if (msg && msg.indexOf('null is not an object') === -1 &&
        msg && msg.indexOf('IMG ERROR') === -1) {
        showError({ message: `${msg} (Line ${line})` });
    } else {
        console.warn('Suppressed non-critical error:', msg);
    }
};
